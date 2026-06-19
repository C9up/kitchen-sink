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
	],

	preloads: [
		() => import("./start/kernel.js"),
		() => import("./start/services.js"),
		() => import("./start/web.js"),
	],

	modules: {
		path: "./app/modules",
	},

	// Console commands (dispatched by `bin/console.ts`). `atlas:check` verifies
	// the app's models against the live database schema.
	commands: [() => import("./commands/atlas-check.js")],
});
