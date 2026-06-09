import { type Component, createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";

/**
 * Vue SSR entry. `createSSRApp(Component, props)` builds an app whose markup
 * the client reuses via `createSSRApp(...).mount()` (Photon's Vue adapter).
 * The typed `import.meta.glob` avoids any `as` cast on the page module.
 */
const pages = import.meta.glob<{ default: Component }>("./pages/*.vue", {
	eager: true,
});

interface PageData {
	component: string;
	props: Record<string, unknown>;
}

export async function render(pageData: PageData): Promise<string> {
	const mod = pages[`./pages/${pageData.component}.vue`];
	if (!mod) {
		throw new Error(`Unknown page: ${pageData.component}`);
	}
	const app = createSSRApp(mod.default, pageData.props);
	return await renderToString(app);
}
