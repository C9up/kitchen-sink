import { createElement } from "react";
import { renderToString } from "react-dom/server";

/**
 * SSR entry. Photon's renderer imports this built module and calls
 * `render(pageData)` with the component name + props from the route's
 * `ctx.photon.render('Home', props)` call. It returns the inner HTML that
 * Photon wraps in `<div id="app">…</div>` plus the serialized page-data block.
 *
 * `import.meta.glob(..., { eager: true })` statically bundles every page so a
 * single SSR build resolves any component by name — no dynamic fs access.
 */
const pages = import.meta.glob("./pages/*.tsx", { eager: true });

interface PageData {
	component: string;
	props: Record<string, unknown>;
}

export function render(pageData: PageData): string {
	const mod = pages[`./pages/${pageData.component}.tsx`] as
		| { default: React.ComponentType<Record<string, unknown>> }
		| undefined;
	if (!mod) {
		throw new Error(`Unknown page: ${pageData.component}`);
	}
	return renderToString(createElement(mod.default, pageData.props));
}
