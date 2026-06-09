import type { Component } from "svelte";
import { render as svelteRender } from "svelte/server";

/**
 * Svelte 5 SSR entry. `render()` from `svelte/server` returns `{ head, body }`;
 * Photon wraps `body` in `<div id="app">…</div>`. The typed glob avoids casts.
 */
const pages = import.meta.glob<{ default: Component }>("./pages/*.svelte", {
	eager: true,
});

interface PageData {
	component: string;
	props: Record<string, unknown>;
}

export function render(pageData: PageData): string {
	const mod = pages[`./pages/${pageData.component}.svelte`];
	if (!mod) {
		throw new Error(`Unknown page: ${pageData.component}`);
	}
	return svelteRender(mod.default, { props: pageData.props }).body;
}
