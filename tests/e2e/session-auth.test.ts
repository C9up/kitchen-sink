import { afterAll, beforeAll, describe, expect, it } from "@c9up/helix";
import type { TestClient } from "@c9up/ream/testing";
import { createClient, forceExitAfter } from "./_helpers.js";

/**
 * Dual-guard E2E: the cookie/session surface alongside the JWT API.
 *
 * Proves the AdonisJS web-kit ergonomics: a session cookie authenticates a
 * plain GET (a `<a href>` download) with no Bearer token — the server knows
 * WHO is downloading. And the session login POST is CSRF-protected (signed
 * double-submit; bootstrapped by the XSRF-TOKEN cookie seeded on the GET).
 */

let client: TestClient;

const creds = { email: "session-user@example.com", password: "session-pass-123" };

beforeAll(async () => {
	client = createClient();
	await client.boot();
	// Create the user (JWT signup endpoint — just need the row to exist).
	await client
		.post("/auth/signup")
		.json({ ...creds, displayName: "Session User", locale: "en" })
		.send();
}, 30_000);

afterAll(async () => {
	await client?.close();
	forceExitAfter();
});

/** Pull a cookie value out of a response's `Set-Cookie` header. */
function setCookie(
	res: { headers: Record<string, string> },
	name: string,
): string | undefined {
	const raw = res.headers["set-cookie"] ?? "";
	return raw.match(new RegExp(`(?:^|[;,\\s])${name}=([^;]+)`))?.[1];
}

describe("kitchen-sink > E2E > dual-guard > session/cookie", () => {
	it("rejects /download without a session (guard('session') → 401)", async () => {
		const res = await client.get("/download/42").send();
		expect(res.status).toBe(401);
	});

	it("rejects session login POST with no CSRF token (403)", async () => {
		const res = await client.post("/login").json(creds).send();
		expect(res.status).toBe(403);
	});

	it("seeds XSRF on GET, logs in by cookie, and the download knows who", async () => {
		// 1. GET seeds the signed XSRF-TOKEN cookie (CSRF bootstrap).
		const seed = await client.get("/login").send();
		const xsrf = setCookie(seed, "XSRF-TOKEN");
		expect(xsrf).toBeTruthy();
		if (!xsrf) throw new Error("no XSRF-TOKEN seeded");

		// 2. Login: echo the token as header + cookie (signed double-submit).
		const login = await client
			.post("/login")
			.header("X-XSRF-TOKEN", xsrf)
			.cookie("XSRF-TOKEN", xsrf)
			.json(creds)
			.send();
		expect(login.status).toBe(200);
		const body = login.json() as { ok: boolean; user: { id: string } };
		expect(body.ok).toBe(true);
		const session = setCookie(login, "ream_session");
		expect(session).toBeTruthy();
		if (!session) throw new Error("no session cookie issued");

		// 3. Download with ONLY the session cookie — no Bearer token. The server
		//    identifies the downloader from the cookie (the PHP-session feel).
		const dl = await client
			.get("/download/42")
			.cookie("ream_session", session)
			.send();
		expect(dl.status).toBe(200);
		expect(dl.headers["content-disposition"]).toContain("doc-42.txt");
		expect(dl.body).toContain(body.user.id);
	});
});
