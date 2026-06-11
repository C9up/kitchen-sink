import { afterAll, beforeAll, describe, expect, it } from "@c9up/helix";
import type { TestClient } from "@c9up/ream/testing";
import { createClient, forceExitAfter } from "./_helpers.js";

let client: TestClient;

beforeAll(async () => {
	client = createClient();
	await client.boot();
}, 30_000);

afterAll(async () => {
	await client?.close();
	forceExitAfter();
});

const goodSignup = {
	email: "alice@example.com",
	password: "hunter2-strong-1",
	displayName: "Alice",
	locale: "fr" as const,
};

describe("kitchen-sink > E2E > auth > signup", () => {
	it("creates the user, hashes the password, returns a JWT", async () => {
		const res = await client.post("/auth/signup").json(goodSignup).send();
		expect(res.status).toBe(201);
		const body = res.json() as {
			ok: boolean;
			user: { id: string; email: string; displayName: string };
			token: string;
		};
		expect(body.ok).toBe(true);
		expect(body.user.email).toBe("alice@example.com");
		expect(body.user.id).toMatch(/^[0-9a-f-]{36}$/);
		// JWT structure: 3 dot-separated segments.
		expect(body.token.split(".").length).toBe(3);
	});

	it("rejects duplicate email with 409", async () => {
		const res = await client.post("/auth/signup").json(goodSignup).send();
		expect(res.status).toBe(409);
	});

	it("rejects weak password with 422 and a rune error list", async () => {
		const res = await client
			.post("/auth/signup")
			.json({ ...goodSignup, email: "bob@example.com", password: "shorty" })
			.send();
		expect(res.status).toBe(422);
		const body = res.json() as {
			ok: boolean;
			errors: Array<{ field: string }>;
		};
		expect(body.ok).toBe(false);
		expect(body.errors.some((e) => e.field === "password")).toBe(true);
	});

	it("rejects invalid email with 422", async () => {
		const res = await client
			.post("/auth/signup")
			.json({ ...goodSignup, email: "not-an-email" })
			.send();
		expect(res.status).toBe(422);
	});
});

describe("kitchen-sink > E2E > auth > login + me + logout", () => {
	it("login → /me round-trip works with valid creds", async () => {
		const login = await client
			.post("/auth/login")
			.json({ email: goodSignup.email, password: goodSignup.password })
			.send();
		expect(login.status).toBe(200);
		const token = (login.json() as { token: string }).token;
		expect(typeof token).toBe("string");

		const me = await client
			.get("/me")
			.header("authorization", `Bearer ${token}`)
			.send();
		expect(me.status).toBe(200);
		expect((me.json() as { user: { email: string } }).user.email).toBe(
			goodSignup.email,
		);
	});

	it("login with bad password returns 401", async () => {
		const res = await client
			.post("/auth/login")
			.json({ email: goodSignup.email, password: "wrong" })
			.send();
		expect(res.status).toBe(401);
	});

	it("login with unknown email returns 401 (same shape as bad password)", async () => {
		const res = await client
			.post("/auth/login")
			.json({ email: "nobody@example.com", password: "whatever-long" })
			.send();
		expect(res.status).toBe(401);
	});

	it("/me without auth header returns 401", async () => {
		const res = await client.get("/me").send();
		expect(res.status).toBe(401);
	});

	it("logout revokes the token via blacklist", async () => {
		const login = await client
			.post("/auth/login")
			.json({ email: goodSignup.email, password: goodSignup.password })
			.send();
		const token = (login.json() as { token: string }).token;

		const before = await client
			.get("/me")
			.header("authorization", `Bearer ${token}`)
			.send();
		expect(before.status).toBe(200);

		const logout = await client
			.post("/auth/logout")
			.header("authorization", `Bearer ${token}`)
			.send();
		expect(logout.status).toBe(200);
		expect((logout.json() as { revoked: boolean }).revoked).toBe(true);

		const after = await client
			.get("/me")
			.header("authorization", `Bearer ${token}`)
			.send();
		expect(after.status).toBe(401);
	});
});
