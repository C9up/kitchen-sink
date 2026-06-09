import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

/**
 * Vite config for the Vue Photon demo. Same two-build flow as React:
 *   vite build -c vite.config.vue.ts                                  (client)
 *   vite build -c vite.config.vue.ts --ssr resources/vue/ssr.ts \
 *     --outDir public/build/vue/ssr                                   (SSR)
 */
export default defineConfig({
	plugins: [vue(), tailwindcss()],
	build: {
		manifest: true,
		outDir: "public/build/vue",
		emptyOutDir: false,
		copyPublicDir: false,
		rollupOptions: {
			input: "resources/vue/app.ts",
		},
	},
});
