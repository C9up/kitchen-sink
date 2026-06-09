import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * Vite config for the Svelte 5 Photon demo:
 *   vite build -c vite.config.svelte.ts                                  (client)
 *   vite build -c vite.config.svelte.ts --ssr resources/svelte/ssr.ts \
 *     --outDir public/build/svelte/ssr                                   (SSR)
 */
export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	build: {
		manifest: true,
		outDir: "public/build/svelte",
		emptyOutDir: false,
		copyPublicDir: false,
		rollupOptions: {
			input: "resources/svelte/app.ts",
		},
	},
});
