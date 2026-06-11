import { afterAll, beforeAll, describe, expect, it } from "@c9up/helix";
import type { TestClient } from "@c9up/ream/testing";
import { createClient, forceExitAfter } from "./_helpers.js";

/**
 * Phase 3 — UI surface + realtime fan-out.
 *
 *   - aurora `html` SSR through `renderToString`
 *   - photon `serializeMetaTags` in the `<head>` (no Vite, no bundler)
 *   - rosetta locale resolution from `Accept-Language` + `?locale=` override
 *   - relay `broadcast` tap (`/__test/relay-info`) for event-bus fan-out
 *
 * The HTML route is anonymous: public projects are world-readable in
 * the demo, so the test does not pass an auth header.
 */

let client: TestClient;
let ownerToken: string;
let memberToken: string;
let memberId: string;
let workspaceSlug: string;
let projectId: string;
let projectSlug: string;

beforeAll(async () => {
	client = createClient();
	await client.boot();

	const owner = await client
		.post("/auth/signup")
		.json({
			email: "site-owner@example.com",
			password: "site-test-pass-1",
			displayName: "Site Owner",
			locale: "fr",
		})
		.send();
	ownerToken = (owner.json() as { token: string }).token;

	const member = await client
		.post("/auth/signup")
		.json({
			email: "site-member@example.com",
			password: "site-test-pass-2",
			displayName: "Site Member",
			locale: "en",
		})
		.send();
	memberToken = (member.json() as { token: string; user: { id: string } })
		.token;
	memberId = (member.json() as { user: { id: string } }).user.id;

	const ws = await client
		.post("/workspaces")
		.header("authorization", `Bearer ${ownerToken}`)
		.json({ name: "Showcase Inc" })
		.send();
	workspaceSlug = (ws.json() as { workspace: { slug: string } }).workspace.slug;
	const wsId = (ws.json() as { workspace: { id: string } }).workspace.id;

	const inv = await client
		.post(`/workspaces/${wsId}/invite`)
		.header("authorization", `Bearer ${ownerToken}`)
		.json({ email: "site-member@example.com", role: "member" })
		.send();
	const invToken = (inv.json() as { invitation: { token: string } }).invitation
		.token;
	await client
		.post(`/invitations/${invToken}/accept`)
		.header("authorization", `Bearer ${memberToken}`)
		.send();

	// Public project so the anonymous HTML page route can serve it.
	const project = await client
		.post(`/workspaces/${workspaceSlug}/projects`)
		.header("authorization", `Bearer ${ownerToken}`)
		.json({
			name: "Launch Plan",
			visibility: "public",
			descriptionFr: "Le plan de lancement",
			descriptionEn: "The launch plan",
		})
		.send();
	const p = (
		project.json() as {
			project: { id: string; slug: string };
		}
	).project;
	projectId = p.id;
	projectSlug = p.slug;

	// A handful of tasks with distinct statuses so the rendered list
	// exercises the status localization branch.
	await client
		.post(`/projects/${projectId}/tasks`)
		.header("authorization", `Bearer ${ownerToken}`)
		.json({ title: "Draft landing page", priority: "high" })
		.send();
	const doingTask = await client
		.post(`/projects/${projectId}/tasks`)
		.header("authorization", `Bearer ${ownerToken}`)
		.json({ title: "Wire analytics" })
		.send();
	await client
		.patch(`/tasks/${(doingTask.json() as { task: { id: string } }).task.id}`)
		.header("authorization", `Bearer ${ownerToken}`)
		.json({ status: "doing" })
		.send();
}, 30_000);

afterAll(async () => {
	await client?.close();
	forceExitAfter();
});

describe("kitchen-sink > E2E > site > SSR page (aurora + photon + rosetta)", () => {
	it("renders the project page in English by default", async () => {
		const res = await client
			.get(`/pages/workspaces/${workspaceSlug}/projects/${projectSlug}`)
			.header("accept-language", "en-US,en;q=0.9")
			.send();
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/text\/html/);
		// Document framing
		expect(res.body).toMatch(/<!doctype html>/i);
		expect(res.body).toMatch(/<html lang="en"/);
		// Aurora-rendered body content (English catalog)
		expect(res.body).toContain("Project: Launch Plan");
		expect(res.body).toContain("The launch plan");
		expect(res.body).toContain("Tasks");
		expect(res.body).toContain("To do");
		expect(res.body).toContain("In progress");
		expect(res.body).toContain("Public");
		// Photon-rendered head
		expect(res.body).toMatch(
			/<meta property="og:title" content="Project: Launch Plan"/,
		);
		expect(res.body).toMatch(/<meta property="og:locale" content="en"/);
	});

	it("renders in French when Accept-Language asks for fr", async () => {
		const res = await client
			.get(`/pages/workspaces/${workspaceSlug}/projects/${projectSlug}`)
			.header("accept-language", "fr-FR,fr;q=0.9,en;q=0.4")
			.send();
		expect(res.status).toBe(200);
		expect(res.body).toMatch(/<html lang="fr"/);
		expect(res.body).toContain("Projet : Launch Plan");
		expect(res.body).toContain("Le plan de lancement");
		expect(res.body).toContain("Tâches");
		expect(res.body).toContain("À faire");
		expect(res.body).toContain("En cours");
		expect(res.body).toContain("Public");
		expect(res.body).toMatch(
			/<meta property="og:title" content="Projet : Launch Plan"/,
		);
	});

	it("?locale=fr overrides Accept-Language", async () => {
		const res = await client
			.get(
				`/pages/workspaces/${workspaceSlug}/projects/${projectSlug}?locale=fr`,
			)
			.header("accept-language", "en-US,en;q=0.9")
			.send();
		expect(res.status).toBe(200);
		expect(res.body).toMatch(/<html lang="fr"/);
		expect(res.body).toContain("Projet : Launch Plan");
	});

	it("404s a non-existent project", async () => {
		const res = await client
			.get(`/pages/workspaces/${workspaceSlug}/projects/does-not-exist`)
			.send();
		expect(res.status).toBe(404);
	});
});

describe("kitchen-sink > E2E > site > live page (aurora dist + shared page + hydrate)", () => {
	it("injects importmap + page-data JSON + the inline hydrate script", async () => {
		const res = await client
			.get(`/pages/live/workspaces/${workspaceSlug}/projects/${projectSlug}`)
			.send();
		expect(res.status).toBe(200);
		expect(res.body).toMatch(/<script type="importmap">/);
		expect(res.body).toContain('"@c9up/aurora":"/_assets/aurora/index.js"');
		expect(res.body).toMatch(
			/<script id="aurora-page-data" type="application\/json">/,
		);
		expect(res.body).toContain('"name":"ProjectPage"');
		expect(res.body).toContain('"channel":"project/');
		expect(res.body).toContain("import { hydrate } from '@c9up/aurora'");
		expect(res.body).toContain(
			'import Page from "/_assets/pages/ProjectPage.js"',
		);
	});

	it("serves aurora/dist/index.js as browser-ready ESM", async () => {
		const res = await client.get("/_assets/aurora/index.js").send();
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/javascript/);
		// Aurora's index.js re-exports every public symbol — verifying a
		// couple of them is enough to prove the build actually ran.
		expect(res.body).toContain("export");
		expect(res.body).toContain("hydrate");
		expect(res.body).toContain("signal");
	});

	it("serves the app's shared ProjectPage module", async () => {
		const res = await client.get("/_assets/pages/ProjectPage.js").send();
		expect(res.status).toBe(200);
		expect(res.headers["content-type"]).toMatch(/javascript/);
		expect(res.body).toContain('from "@c9up/aurora"');
		expect(res.body).toContain('from "@c9up/aurora/relay"');
	});

	it("refuses path traversal attempts (4xx, never serves the file)", async () => {
		const res = await client
			.get("/_assets/aurora/..%2f..%2fpackage.json")
			.send();
		// The encoded `..%2f` is rejected before the lookup — 400 (malformed/
		// traversal request) is the actual secure response; 403/404 are equally
		// valid refusals. The only failure mode is a 200 that leaks the file.
		expect([400, 403, 404]).toContain(res.status);
	});

	it("404s an asset that does not exist", async () => {
		const res = await client.get("/_assets/aurora/nope.js").send();
		expect(res.status).toBe(404);
	});
});

describe("kitchen-sink > E2E > site > relay SSE end-to-end", () => {
	it("opens an SSE connection, subscribes, and receives a real-time event", async () => {
		const baseUrl = `http://127.0.0.1:${client.port}`;
		// The uid hint MUST match the authenticated user id — relay's
		// `connect()` treats a mismatch as a hijack attempt (see
		// Relay.connect docs). Using `memberId` here keeps the SSE
		// handshake on the happy path.
		const uid = memberId;

		// 1. Open the SSE stream and start consuming chunks. The Abort
		//    controller serves both for explicit close and as a safety
		//    net so the test never hangs the helix worker.
		const controller = new AbortController();
		const res = await fetch(
			`${baseUrl}/__relay/events?uid=${encodeURIComponent(uid)}`,
			{
				headers: {
					authorization: `Bearer ${memberToken}`,
					accept: "text/event-stream",
				},
				signal: controller.signal,
			},
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);

		const events = collectSseEvents(res, controller);

		// 2. Wait for the "connected" event so we know the SSE writer is
		//    primed and the uid is registered server-side.
		await waitForEvent(events, (e) => e.event === "connected");

		// 3. Subscribe to the project channel.
		const sub = await fetch(`${baseUrl}/__relay/subscribe`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${memberToken}`,
			},
			body: JSON.stringify({ uid, channel: `project/${projectId}` }),
		});
		expect(sub.status).toBe(204);

		// 4. Trigger a task assignment — emits `TaskAssigned`, which the
		//    services.ts event-bus listener forwards to `relay.broadcast`.
		await client
			.post(`/projects/${projectId}/tasks`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({ title: "Coordinate launch comms", assigneeId: memberId })
			.send();

		const assigned = await waitForEvent(
			events,
			(e) =>
				e.event === `project/${projectId}` &&
				typeof e.data === "object" &&
				e.data !== null &&
				(e.data as { event?: unknown }).event === "task.assigned",
		);
		expect((assigned.data as { assigneeId: string }).assigneeId).toBe(memberId);

		controller.abort();
	});

	it("rejects unauthenticated SSE connections with 401", async () => {
		const baseUrl = `http://127.0.0.1:${client.port}`;
		const res = await fetch(`${baseUrl}/__relay/events?uid=anon-uid`, {
			// No Bearer token — `relay.registerRoutes((route) => route.guard('jwt'))`
			// + the AuthMiddleware reject the request before the SSE upgrade.
			headers: { accept: "text/event-stream" },
		});
		expect(res.status).toBe(401);
	});

	it("forbids subscriptions to channels with no registered authorizer", async () => {
		const baseUrl = `http://127.0.0.1:${client.port}`;
		// Authenticated user opens SSE → hint must match auth id (see test 1
		// comment). The actual `subscribe` call below is what's expected to
		// 403 because `secret/*` has no `relay.authorize(...)` registered.
		const uid = memberId;

		const controller = new AbortController();
		const res = await fetch(
			`${baseUrl}/__relay/events?uid=${encodeURIComponent(uid)}`,
			{
				headers: {
					accept: "text/event-stream",
					authorization: `Bearer ${memberToken}`,
				},
				signal: controller.signal,
			},
		);
		expect(res.status).toBe(200);

		const events = collectSseEvents(res, controller);
		await waitForEvent(events, (e) => e.event === "connected");

		// `secret/anything` has no `relay.authorize(...)` registered.
		// Secure-by-default rejects the subscription.
		const sub = await fetch(`${baseUrl}/__relay/subscribe`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${memberToken}`,
			},
			body: JSON.stringify({ uid, channel: "secret/lab-data" }),
		});
		expect(sub.status).toBe(403);
		const body = (await sub.json()) as { error?: { code?: string } };
		expect(body.error?.code).toBe("E_CHANNEL_NO_AUTHORIZER");

		controller.abort();
	});

	it("forbids non-members from subscribing to a project channel", async () => {
		// `nonMember` signs up but never gets invited to the workspace.
		// `relay.authorize('project/:id')` resolves the project, finds no
		// membership for nonMember.id, returns false → 403 E_CHANNEL_FORBIDDEN.
		const outsider = await client
			.post("/auth/signup")
			.json({
				email: "outsider@example.com",
				password: "site-test-pass-3",
				displayName: "Outsider",
				locale: "en",
			})
			.send();
		expect(outsider.status).toBe(201);
		const outsiderJson = outsider.json() as {
			token: string;
			user: { id: string };
		};
		const outsiderToken = outsiderJson.token;
		const outsiderId = outsiderJson.user.id;

		const baseUrl = `http://127.0.0.1:${client.port}`;
		// Hint must match the outsider's authenticated id (same reason as
		// tests 1 and 3). The 403 we're asserting comes from
		// `relay.authorize('project/:id')`, not from a uid-hint mismatch.
		const uid = outsiderId;

		const controller = new AbortController();
		const res = await fetch(
			`${baseUrl}/__relay/events?uid=${encodeURIComponent(uid)}`,
			{
				headers: {
					accept: "text/event-stream",
					authorization: `Bearer ${outsiderToken}`,
				},
				signal: controller.signal,
			},
		);
		expect(res.status).toBe(200);

		const events = collectSseEvents(res, controller);
		await waitForEvent(events, (e) => e.event === "connected");

		const sub = await fetch(`${baseUrl}/__relay/subscribe`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${outsiderToken}`,
			},
			body: JSON.stringify({ uid, channel: `project/${projectId}` }),
		});
		expect(sub.status).toBe(403);
		const body = (await sub.json()) as { error?: { code?: string } };
		expect(body.error?.code).toBe("E_CHANNEL_FORBIDDEN");

		controller.abort();
	});
});

// ─── SSE helpers ─────────────────────────────────────────────

interface SseEvent {
	event: string;
	data: unknown;
	id?: string;
}

/**
 * Spin a background reader on the fetch response body that decodes
 * SSE frames into structured events. Returns a buffer + a notifier
 * Promise so tests can `await` the next matching event.
 */
function collectSseEvents(
	res: Response,
	controller: AbortController,
): SseEventBuffer {
	const buffer: SseEvent[] = [];
	const waiters: Array<{
		predicate: (e: SseEvent) => boolean;
		resolve: (e: SseEvent) => void;
	}> = [];

	const reader = res.body?.getReader();
	if (!reader) throw new Error("SSE response has no readable body");
	const decoder = new TextDecoder();
	let raw = "";

	(async () => {
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) return;
				raw += decoder.decode(value, { stream: true });
				// SSE frames are separated by `\n\n`. Split, parse the complete ones,
				// keep the trailing partial frame in `raw`.
				let idx = raw.indexOf("\n\n");
				while (idx !== -1) {
					const frame = raw.slice(0, idx);
					raw = raw.slice(idx + 2);
					const parsed = parseFrame(frame);
					if (parsed) {
						buffer.push(parsed);
						// Resolve any waiter whose predicate now matches.
						for (let i = waiters.length - 1; i >= 0; i--) {
							if (waiters[i].predicate(parsed)) {
								waiters[i].resolve(parsed);
								waiters.splice(i, 1);
							}
						}
					}
					idx = raw.indexOf("\n\n");
				}
			}
		} catch {
			// Abort signal — expected when the test winds down.
		}
	})();

	return {
		buffer,
		waitFor: (predicate, timeoutMs = 3_000) =>
			new Promise<SseEvent>((resolve, reject) => {
				const existing = buffer.find(predicate);
				if (existing) {
					resolve(existing);
					return;
				}
				const timer = setTimeout(() => {
					controller.abort();
					reject(
						new Error(
							`SSE event matching predicate not seen within ${timeoutMs}ms. Buffered: ${JSON.stringify(buffer)}`,
						),
					);
				}, timeoutMs);
				waiters.push({
					predicate,
					resolve: (e) => {
						clearTimeout(timer);
						resolve(e);
					},
				});
			}),
	};
}

interface SseEventBuffer {
	buffer: SseEvent[];
	waitFor(
		predicate: (e: SseEvent) => boolean,
		timeoutMs?: number,
	): Promise<SseEvent>;
}

function waitForEvent(
	events: SseEventBuffer,
	predicate: (e: SseEvent) => boolean,
): Promise<SseEvent> {
	return events.waitFor(predicate);
}

function parseFrame(frame: string): SseEvent | null {
	// Comment frames (`:keepalive`) — skip.
	if (frame.startsWith(":")) return null;
	const lines = frame.split("\n");
	let event = "message";
	let id: string | undefined;
	const dataLines: string[] = [];
	for (const line of lines) {
		if (line.startsWith("event:")) {
			event = line.slice(6).trimStart();
		} else if (line.startsWith("data:")) {
			dataLines.push(line.slice(5).trimStart());
		} else if (line.startsWith("id:")) {
			id = line.slice(3).trimStart();
		} else if (line.startsWith("retry:")) {
			// Retry hints are consumed by browsers — irrelevant to tests.
		}
	}
	if (dataLines.length === 0) return null;
	const raw = dataLines.join("\n");
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		data = raw;
	}
	return { event, data, ...(id !== undefined ? { id } : {}) };
}
