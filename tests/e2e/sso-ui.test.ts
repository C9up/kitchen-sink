/**
 * Transit (federated sign-in) and Nebula (the Aurora component set).
 *
 * Both are asserted on the half that needs no third party: transit's
 * authorize URL, which a live identity provider is not required to build, and
 * nebula's server-rendered markup, which is where a version skew between the
 * component set and the Aurora runtime the app pins would show up.
 */

import { Button } from "@c9up/nebula";
import { renderToString } from "@c9up/aurora/ssr";
import { test } from "@c9up/helix";
import { createClient, forceExitAfter } from "./_helpers.js";

const client = createClient();

test.group("kitchen-sink > e2e > transit + nebula", (group) => {
	group.setup(async () => {
		await client.boot();
	});
	group.teardown(async () => {
		await client.close();
		forceExitAfter();
	});

	test("transit builds an authorize URL from config/transit.ts", async ({
		assert,
	}) => {
		const response = await client.get("/auth/github/redirect");
		response.assertStatus(200);
		const url = new URL(response.body().url);
		assert.equal(url.host, "github.com");
		assert.equal(
			url.searchParams.get("redirect_uri"),
			"http://localhost/auth/github/callback",
		);
		assert.equal(url.searchParams.get("client_id"), "kitchen-sink-client-id");
	});

	test("the authorize URL carries the anti-forgery state", async ({
		assert,
	}) => {
		// Without it the callback cannot be tied to the request that started
		// the flow, which is the whole of the CSRF defence for OAuth.
		const url = new URL((await client.get("/auth/github/redirect")).body().url);
		assert.equal(url.searchParams.get("state"), "state-123");
	});

	test("the requested scope is the one the config asked for", async ({
		assert,
	}) => {
		const url = new URL((await client.get("/auth/github/redirect")).body().url);
		assert.include(url.searchParams.get("scope") ?? "", "read:user");
	});

	test("an unconfigured provider is a 404, not a 500", async ({ assert }) => {
		const response = await client.get("/auth/gitlab/redirect");
		response.assertStatus(404);
		assert.isString(response.body().error);
	});

	test("nebula renders against the Aurora runtime this app pins", async ({
		assert,
	}) => {
		// The integration risk is version skew: nebula is built on Aurora's
		// tagged-template runtime, and a component set compiled against a
		// different one renders nothing rather than failing loudly.
		const html = renderToString(Button({ children: "Save" }));
		assert.include(html, "Save");
		assert.include(html, "<button");
	});
});
