/**
 * Inker through the real kernel, with rosetta pushing into it.
 *
 * The assertion worth making here is one no unit test can: `t()` appears in
 * the markup because rosetta registered a plugin on inker's module singleton
 * during its own boot — before the engine existed — and the engine ran that
 * plugin just before this first render. Every piece of that is in a different
 * package, and the handoff used to fail the whole application boot.
 */

import { test } from "@c9up/helix";
import { createClient, forceExitAfter } from "./_helpers.js";

const client = createClient();

test.group("kitchen-sink > e2e > inker + rosetta", (group) => {
	group.setup(async () => {
		await client.boot();
	});
	group.teardown(async () => {
		await client.close();
		forceExitAfter();
	});

	test("renders a template with rosetta's t() global", async ({ assert }) => {
		const response = await client.get("/views/profile");
		response.assertStatus(200);
		// From resources/lang/en.json, reached through the global rosetta
		// published into the engine it never resolves from the container.
		assert.include(response.body(), "Kitchen Sink");
	});

	test("answers text/html", async ({ assert }) => {
		const response = await client.get("/views/profile");
		assert.include(String(response.header("content-type")), "text/html");
	});

	test("escapes what the request supplied", async ({ assert }) => {
		// `&` rather than a script tag: blackhole refuses the tag at the edge
		// (the test below), so it never reaches the engine, and an escaping
		// assertion that never exercised the engine would prove nothing.
		//
		// Only `&` is asserted. The engine escapes eight characters — a quote
		// leaves it as `&quot;` — but blackhole re-serialises the HTML on the
		// way out and writes a quote back as itself, which is what it means in
		// element text. Asserting on it would be asserting on the outer layer.
		const response = await client.get("/views/profile?bio=a%26b");
		response.assertStatus(200);
		assert.include(response.body(), "a&amp;b");
	});

	test("the edge refuses a script tag before the engine sees it", async ({
		assert,
	}) => {
		// Two layers, and this is the outer one. Escaping is what makes the
		// inner one safe when a payload does get through.
		const response = await client.get("/views/profile?bio=<script>x</script>");
		assert.equal(response.status(), 400);
	});

	test("leaves a triple-brace value alone", async ({ assert }) => {
		const response = await client.get("/views/profile");
		// `{{{ }}}` is the author saying they meant it — the escaping above is
		// the default, not the only mode.
		assert.include(response.body(), "<em>trusted</em>");
	});
});
