/**
 * Live components — SERVER-side e2e through the real Ignitor + relay: a page
 * route mounts + server-renders a live session; the inbound-event route
 * dispatches client events to it. (The browser half — SSE patch → DOM — is
 * unit-proven in aurora; here we verify the real server integration.)
 */
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

/** Load the page as a new visitor: the mounted id and that visitor's session. */
async function mountAsVisitor(): Promise<{ id: string; session: string }> {
	const page = await client.get("/live-counter").send();
	const id = /data-live-id="([^"]+)"/.exec(page.text())?.[1] ?? "";
	const session = page.cookie("ream_session")?.value ?? "";
	expect(id).not.toBe("");
	expect(session).not.toBe("");
	return { id, session };
}

describe("kitchen-sink > e2e > live components", () => {
	it("GET /live-counter mounts + server-renders the initial state", async () => {
		const res = await client.get("/live-counter").send();
		expect(res.status()).toBe(200);
		expect(res.text()).toContain("Count: ");
		expect(res.text()).toMatch(/data-live-id="[^"]+"/);
		expect(res.text()).toMatch(/data-live-channel="live\/[^"]+"/);
	});

	it("POST /__live/event dispatches the event for the visitor who mounted it", async () => {
		const { id, session } = await mountAsVisitor();
		const res = await client
			.post("/__live/event")
			.cookie("ream_session", session)
			.json({ id, event: "increment" })
			.send();
		expect(res.status()).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	it("POST /__live/event from another visitor, or none, → 403", async () => {
		const alice = await mountAsVisitor();
		const bob = await mountAsVisitor();
		const asBob = await client
			.post("/__live/event")
			.cookie("ream_session", bob.session)
			.json({ id: alice.id, event: "increment" })
			.send();
		expect(asBob.status()).toBe(403);
		const anonymous = await client
			.post("/__live/event")
			.json({ id: alice.id, event: "increment" })
			.send();
		expect(anonymous.status()).toBe(403);
	});

	it("POST /__live/event with an unknown session id → 404", async () => {
		const { session } = await mountAsVisitor();
		const res = await client
			.post("/__live/event")
			.cookie("ream_session", session)
			.json({ id: "ghost", event: "increment" })
			.send();
		expect(res.status()).toBe(404);
	});

	it("POST /__live/event with a malformed body → 400", async () => {
		const res = await client.post("/__live/event").json({ nope: true }).send();
		expect(res.status()).toBe(400);
	});
});
