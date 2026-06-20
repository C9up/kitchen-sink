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

describe("kitchen-sink > e2e > live components", () => {
	it("GET /live-counter mounts + server-renders the initial state", async () => {
		const res = await client.get("/live-counter").send();
		expect(res.status).toBe(200);
		expect(res.body).toContain("Count: ");
		expect(res.body).toMatch(/data-live-id="[^"]+"/);
		expect(res.body).toMatch(/data-live-channel="live\/[^"]+"/);
	});

	it("POST /_live/event dispatches the event to the mounted session", async () => {
		const page = await client.get("/live-counter").send();
		const id = /data-live-id="([^"]+)"/.exec(page.body)?.[1];
		expect(id).toBeTruthy();

		const res = await client
			.post("/_live/event")
			.json({ id, event: "increment" })
			.send();
		expect(res.status).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	it("POST /_live/event with an unknown session id → 404", async () => {
		const res = await client
			.post("/_live/event")
			.json({ id: "ghost", event: "increment" })
			.send();
		expect(res.status).toBe(404);
	});

	it("POST /_live/event with a malformed body → 400", async () => {
		const res = await client.post("/_live/event").json({ nope: true }).send();
		expect(res.status).toBe(400);
	});
});
