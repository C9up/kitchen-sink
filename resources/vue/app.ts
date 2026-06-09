import "../app.css";
import { hydrate } from "@c9up/photon/client";

/** Vue client entry — Photon dispatches to the Vue adapter (`createSSRApp().mount`). */
const pages = import.meta.glob<{ default: unknown }>("./pages/*.vue");

hydrate({
	resolveComponent: async (name) => {
		const loader = pages[`./pages/${name}.vue`];
		if (!loader) {
			throw new Error(`Unknown page: ${name}`);
		}
		return await loader();
	},
});
