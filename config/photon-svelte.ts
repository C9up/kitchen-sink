import { defineConfig } from "@c9up/photon";

/** Photon config for the Svelte 5 demo (mounted at /svelte in start/web.ts). */
export default defineConfig({
	framework: "svelte",
	entryClient: "resources/svelte/app.ts",
	ssr: { enabled: true, entrypoint: "resources/svelte/ssr.ts" },
	buildDir: "public/build/svelte",
	ssrBuildDir: "build/ssr/svelte",
	viteDevUrl: "http://localhost:5173",
});
