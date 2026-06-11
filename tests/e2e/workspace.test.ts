import { afterAll, beforeAll, describe, expect, it } from "@c9up/helix";
import type { TestClient } from "@c9up/ream/testing";
import { createClient, forceExitAfter } from "./_helpers.js";

let client: TestClient;
let aliceToken: string;
let bobToken: string;
let workspaceId: string;
let invitationToken: string;

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

beforeAll(async () => {
	client = createClient();
	await client.boot();

	// Two pre-baked users so each describe block builds on shared state.
	// Phase 2 will swap this for a factory + per-test reset; phase 1's
	// flows are small enough that linear setup is the cheapest path.
	const alice = await client
		.post("/auth/signup")
		.json({
			email: "alice@example.com",
			password: "hunter2-strong-1",
			displayName: "Alice",
			locale: "fr",
		})
		.send();
	aliceToken = (alice.json() as { token: string }).token;

	const bob = await client
		.post("/auth/signup")
		.json({
			email: "bob@example.com",
			password: "secret-123-strong",
			displayName: "Bob",
			locale: "en",
		})
		.send();
	bobToken = (bob.json() as { token: string }).token;
}, 30_000);

afterAll(async () => {
	await client?.close();
	forceExitAfter();
});

describe("kitchen-sink > E2E > workspace > create + list", () => {
	it("alice creates a workspace and gets an owner membership", async () => {
		const res = await client
			.post("/workspaces")
			.header("authorization", `Bearer ${aliceToken}`)
			.json({ name: "Acme HQ" })
			.send();
		expect(res.status).toBe(201);
		const body = res.json() as {
			workspace: { id: string; name: string; slug: string; ownerId: string };
		};
		expect(body.workspace.name).toBe("Acme HQ");
		expect(body.workspace.slug).toBe("acme-hq");
		expect(body.workspace.id).toMatch(/^[0-9a-f-]{36}$/);
		workspaceId = body.workspace.id;
	});

	it("alice's workspace list now contains the created workspace as owner", async () => {
		const res = await client
			.get("/workspaces")
			.header("authorization", `Bearer ${aliceToken}`)
			.send();
		expect(res.status).toBe(200);
		const body = res.json() as {
			workspaces: Array<{ id: string; role: string }>;
		};
		expect(body.workspaces).toHaveLength(1);
		expect(body.workspaces[0].id).toBe(workspaceId);
		expect(body.workspaces[0].role).toBe("owner");
	});

	it("bob (non-member) cannot see alice's workspace", async () => {
		const res = await client
			.get("/workspaces")
			.header("authorization", `Bearer ${bobToken}`)
			.send();
		expect(res.status).toBe(200);
		expect((res.json() as { workspaces: unknown[] }).workspaces).toHaveLength(
			0,
		);
	});

	it("anonymous requests are rejected with 401", async () => {
		expect((await client.get("/workspaces").send()).status).toBe(401);
		expect(
			(await client.post("/workspaces").json({ name: "X" }).send()).status,
		).toBe(401);
	});

	it("invalid workspace name is rejected with 422", async () => {
		const res = await client
			.post("/workspaces")
			.header("authorization", `Bearer ${aliceToken}`)
			.json({ name: "A" })
			.send();
		expect(res.status).toBe(422);
	});

	it("a second workspace named 'Acme HQ' gets a suffixed slug", async () => {
		const res = await client
			.post("/workspaces")
			.header("authorization", `Bearer ${aliceToken}`)
			.json({ name: "Acme HQ" })
			.send();
		expect(res.status).toBe(201);
		expect((res.json() as { workspace: { slug: string } }).workspace.slug).toBe(
			"acme-hq-2",
		);
	});
});

describe("kitchen-sink > E2E > workspace > invite + accept", () => {
	it("alice invites bob as admin → invitation issued with a 64-char token", async () => {
		const res = await client
			.post(`/workspaces/${workspaceId}/invite`)
			.header("authorization", `Bearer ${aliceToken}`)
			.json({ email: "bob@example.com", role: "admin" })
			.send();
		expect(res.status).toBe(201);
		const body = res.json() as {
			invitation: { token: string; expiresAt: string; role: string };
		};
		expect(body.invitation.token).toMatch(/^[0-9a-f]{64}$/);
		expect(body.invitation.role).toBe("admin");
		expect(new Date(body.invitation.expiresAt).getTime()).toBeGreaterThan(
			Date.now(),
		);
		invitationToken = body.invitation.token;
	});

	it("bob accepts → gets an admin membership", async () => {
		const res = await client
			.post(`/invitations/${invitationToken}/accept`)
			.header("authorization", `Bearer ${bobToken}`)
			.send();
		expect(res.status).toBe(201);
		expect((res.json() as { role: string }).role).toBe("admin");

		const list = await client
			.get("/workspaces")
			.header("authorization", `Bearer ${bobToken}`)
			.send();
		const wsList = (
			list.json() as { workspaces: Array<{ id: string; role: string }> }
		).workspaces;
		expect(wsList.some((w) => w.id === workspaceId && w.role === "admin")).toBe(
			true,
		);
	});

	it("re-accepting the same invitation returns 410", async () => {
		const res = await client
			.post(`/invitations/${invitationToken}/accept`)
			.header("authorization", `Bearer ${bobToken}`)
			.send();
		expect(res.status).toBe(410);
	});

	it("unknown token returns 404", async () => {
		const fake = "0".repeat(64);
		const res = await client
			.post(`/invitations/${fake}/accept`)
			.header("authorization", `Bearer ${bobToken}`)
			.send();
		expect(res.status).toBe(404);
	});

	it("non-member cannot invite (403)", async () => {
		const eveSignup = await client
			.post("/auth/signup")
			.json({
				email: "eve@example.com",
				password: "another-strong-1",
				displayName: "Eve",
				locale: "fr",
			})
			.send();
		const eveToken = (eveSignup.json() as { token: string }).token;
		const res = await client
			.post(`/workspaces/${workspaceId}/invite`)
			.header("authorization", `Bearer ${eveToken}`)
			.json({ email: "mallory@example.com", role: "member" })
			.send();
		expect(res.status).toBe(403);
	});

	it("invalid role is rejected with 422", async () => {
		const res = await client
			.post(`/workspaces/${workspaceId}/invite`)
			.header("authorization", `Bearer ${aliceToken}`)
			.json({ email: "carol@example.com", role: "owner" })
			.send();
		expect(res.status).toBe(422);
	});
});

// Suppress lint warning on the helper — kept for symmetry with phase 2 where
// per-user `withAuth(token)` wrappers will be wired through helix's auth
// strategy surface.
void auth;
