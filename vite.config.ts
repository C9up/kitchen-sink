import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite config for the Photon frontend. Two builds share it:
 *
 *   pnpm build:client → `vite build`               (client bundle + manifest)
 *   pnpm build:ssr    → `vite build --ssr resources/ssr.tsx --outDir public/build/ssr`
 *
 * The client build emits `public/build/manifest.json` (Photon reads it to inject
 * the right `<script type="module">` tags). The SSR build emits
 * `public/build/ssr/ssr.js` with the `render()` export Photon's renderer loads.
 */
export default defineConfig({
	plugins: [react()],
	build: {
		manifest: true,
		outDir: "public/build",
		emptyOutDir: false, // keep the sibling ssr/ build between the two passes
		// `buildDir` lives INSIDE `public/`, so Vite would otherwise copy
		// `public/` into the output recursively (ENAMETOOLONG). Photon serves
		// static assets itself — Vite must not copy the public dir.
		copyPublicDir: false,
		rollupOptions: {
			input: "resources/app.tsx",
		},
	},
});
