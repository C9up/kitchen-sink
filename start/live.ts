/**
 * Live components demo — a server-resident counter, wired end-to-end on the
 * SERVER side: `GET /live-counter` mounts a session + server-renders it +
 * embeds the mount ids; `wireLiveEvents` registers `POST /__live/event` which
 * dispatches client events to the session, whose patches broadcast over relay.
 *
 * The server half is exercised by `tests/e2e/live.test.ts` (real Ignitor +
 * relay). The browser half (subscribe SSE + apply patches + forward clicks) is
 * the `<script type="module">` below — faithful to the documented API; its full
 * loop needs a real browser to validate (the logic is unit-proven in aurora).
 */
import "reflect-metadata";
import {
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
wireLiveEvents(router, live); // POST /__live/event

// Relay is fail-closed: a channel with no authorizer rejects subscriptions
// (403). Authorize the per-session live channel. (Demo: allow-all. Production:
// check that the subscriber owns the session id.)
relay.authorize("live/:id", () => true);

router.get("/live-counter", (ctx) => {
	// Demo: mount keyed by the request correlation id. Production keys by the
	// relay connection uid and wires relay-disconnect → live.disconnect(uid).
	const { id, channel, html: markup } = live.mount("Counter", ctx.id);
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
