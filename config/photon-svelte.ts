import { defineConfig } from "@c9up/photon";

/** Photon config for the Svelte 5 demo (mounted at /svelte in start/web.ts). */
export default defineConfig({
	framework: "svelte",
	entryClient: "resources/svelte/app.ts",
	entryServer: "resources/svelte/ssr.ts",
	buildDir: "public/build/svelte",
	viteDevUrl: "http://localhost:5173",
});
