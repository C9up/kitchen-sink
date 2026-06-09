import { hydrate } from "@c9up/photon/client";

/**
 * Client entry. Photon's one-call `hydrate()` reads the server-emitted
 * `<script id="photon-data">` block, loads the matching page module, and
 * dispatches to the React adapter (`hydrateRoot`). It also wires SPA-nav.
 *
 * `import.meta.glob` (lazy here, not eager) code-splits each page so the
 * browser only downloads the page it needs.
 */
const pages = import.meta.glob("./pages/*.tsx");

hydrate({
	resolveComponent: async (name) => {
		const loader = pages[`./pages/${name}.tsx`];
		if (!loader) {
			throw new Error(`Unknown page: ${name}`);
		}
		return (await loader()) as { default: unknown };
	},
});
