import { defineConfig } from "@c9up/photon";

/** Photon config for the Vue demo (mounted at /vue in start/web.ts). */
export default defineConfig({
	framework: "vue",
	entryClient: "resources/vue/app.ts",
	entryServer: "resources/vue/ssr.ts",
	buildDir: "public/build/vue",
	viteDevUrl: "http://localhost:5173",
});
