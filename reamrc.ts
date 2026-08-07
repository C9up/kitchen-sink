import { defineConfig } from "@c9up/ream";

export default defineConfig({
	providers: [
		() => import("@c9up/spectrum/provider"),
		() => import("@c9up/atlas/provider"),
		() => import("@c9up/ream/events/provider"),
		() => import("@c9up/warden/provider"),
		() => import("@c9up/blackhole/provider"),
		() => import("@c9up/sigil/provider"),
		() => import("@c9up/rover/provider"),
		() => import("@c9up/archive/provider"),
		() => import("@c9up/nova/provider"),
		() => import("@c9up/relay/provider"),
		() => import("@c9up/echo/provider"),
		() => import("@c9up/bay/provider"),
		() => import("@c9up/rosetta/provider"),
		() => import("@c9up/aurora/provider"),
		() => import("@c9up/ream/rpc/provider"),
	],

	preloads: [
		() => import("./start/kernel.js"),
		() => import("./start/services.js"),
		() => import("./start/web.js"),
		() => import("./start/web-session.js"),
		() => import("./start/live.js"),
		() => import("./start/rpc.js"),
	],

	modules: {
		path: "./app/modules",
	},

	// Test suites — the `tests` block AdonisJS puts in adonisrc.ts. `ream test`
	// reads it and hands the suites to helix.
	tests: {
		timeout: 60_000,
		// The e2e suite boots a real server per file and leaves SSE/tokio
		// sockets open; without this the CLI would wait on a loop that never
		// drains. `tests/e2e/_helpers.ts#forceExitAfter` handles the WORKER
		// side, which this flag does not reach.
		forceExit: true,
		suites: [
			{ name: "smoke", files: ["tests/smoke/**/*.test.ts"] },
			{ name: "e2e", files: ["tests/e2e/**/*.test.ts"] },
		],
	},

	// Console commands (dispatched by `bin/console.ts`). `atlas:check` verifies
	// the app's models against the live database schema.
	commands: [() => import("./commands/atlas-check.js")],
});
