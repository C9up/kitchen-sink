/**
 * Live components demo — a server-resident counter, wired end-to-end on the
 * SERVER side: `GET /live-counter` mounts a session + server-renders it +
 * embeds the mount ids; `wireLiveEvents` registers `POST /__live/event` which
 * dispatches client events to the session, whose patches broadcast over relay.
 *
 * The server half is exercised by `tests/e2e/live.test.ts` (real Ignitor +
 * relay). The browser half (subscribe SSE + apply patches + forward clicks) is
 * the `<script type="module">` below.
 */
import "reflect-metadata";
import { randomUUID } from "node:crypto";
import {
	authorizeLiveChannel,
	createLiveRegistry,
	createLiveRouter,
	html,
	signal,
	wireLiveEvents,
} from "@c9up/aurora";
import router from "@c9up/ream/services/router";
import relay from "@c9up/relay/services/main";

const registry = createLiveRegistry();
registry.define("Counter", () => {
	const count = signal(0);
	return {
		// Reactive text slot isolated in its own element (live authoring rule).
		view: html`<button data-live-click="increment">Count: <span>${count}</span></button>`,
		handlers: { increment: () => count(count() + 1) },
	};
});

const live = createLiveRouter(registry, relay);

/**
 * The principal a live session belongs to. The demo has no login, so each
 * visitor gets an id kept in their (encrypted cookie) session; an app with
 * users returns the user id instead. The page mounts with it, and the event
 * route and the channel answer 403 to any other caller.
 */
const VISITOR_KEY = "live.visitor";

function visitorOf(ctx: object): string | undefined {
	// Read structurally: the event route types its context as aurora's slice,
	// which does not name the session ream's SessionMiddleware puts there.
	const session: unknown = Reflect.get(ctx, "session");
	if (typeof session !== "object" || session === null) return undefined;
	const get: unknown = Reflect.get(session, "get");
	if (typeof get !== "function") return undefined;
	const visitor: unknown = Reflect.apply(get, session, [VISITOR_KEY]);
	return typeof visitor === "string" ? visitor : undefined;
}

// POST /__live/event — only the session's owner reaches it.
wireLiveEvents(router, live, visitorOf);

// Relay is fail-closed: a channel with no authorizer rejects subscriptions.
// Only the session's owner may subscribe to its patches.
relay.authorize<{ id: string }>(
	"live/:id",
	authorizeLiveChannel(live, visitorOf),
);

router.get("/live-counter", (ctx) => {
	let visitor = visitorOf(ctx);
	if (visitor === undefined) {
		visitor = randomUUID();
		ctx.session?.put(VISITOR_KEY, visitor);
	}
	const { id, channel, html: markup } = live.mount("Counter", visitor);
	ctx.response.send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Live Counter</title>
<script type="importmap">{"imports":{"@c9up/aurora":"/__assets/aurora/index.js","@c9up/aurora/relay":"/__assets/aurora/relay.js"}}</script>
</head>
<body>
<div id="app" data-live-id="${id}" data-live-channel="${channel}">${markup}</div>
<script type="module">
  // Browser integration point (served via aurora's importmap, like resources/pages/*).
  import { liveClient, buildLiveTransport, HttpClient, html, signal } from "@c9up/aurora";
  import { relay } from "@c9up/aurora/relay";
  const el = document.getElementById("app");
  const count = signal(0);
  liveClient({
    container: el,
    factory: () => html\`<button data-live-click="increment">Count: <span>\${count}</span></button>\`,
    mount: { id: el.dataset.liveId, channel: el.dataset.liveChannel },
    transport: buildLiveTransport(relay(), new HttpClient()),
  });
</script>
</body></html>`);
});
