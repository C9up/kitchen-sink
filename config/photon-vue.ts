import { defineConfig } from "@c9up/photon";

/** Photon config for the Vue demo (mounted at /vue in start/web.ts). */
export default defineConfig({
	framework: "vue",
	entryClient: "resources/vue/app.ts",
	ssr: { enabled: true, entrypoint: "resources/vue/ssr.ts" },
	buildDir: "public/build/vue",
	ssrBuildDir: "build/ssr/vue",
	viteDevUrl: "http://localhost:5173",
});
