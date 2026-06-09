import { hydrate } from "@c9up/photon/client";

/** Svelte client entry — Photon dispatches to the Svelte 5 adapter (`hydrate`). */
const pages = import.meta.glob<{ default: unknown }>("./pages/*.svelte");

hydrate({
	resolveComponent: async (name) => {
		const loader = pages[`./pages/${name}.svelte`];
		if (!loader) {
			throw new Error(`Unknown page: ${name}`);
		}
		return await loader();
	},
});
