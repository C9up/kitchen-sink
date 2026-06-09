import { defineConfig } from "@c9up/photon";

/**
 * Photon frontend config. Read by `@c9up/photon/provider` (registered in
 * reamrc.ts) and by the PhotonMiddleware in start/web.ts.
 *
 * Dev: assets come from the Vite dev server at `viteDevUrl`.
 * Prod: assets come from `buildDir` (Vite client build + manifest), and the
 * SSR module is loaded from `<buildDir>/ssr/ssr.js` (Vite SSR build).
 */
export default defineConfig({
	framework: "react",
	entryClient: "resources/app.tsx",
	entryServer: "resources/ssr.tsx",
	buildDir: "public/build",
	viteDevUrl: "http://localhost:5173",
});
