/**
 * Station, the admin surface, mounted in a real application.
 *
 * It could not be wired here at all until inker could be: station renders its
 * screens through the template engine, and installing that engine used to fail
 * the boot. So the first thing worth asserting is simply that the routes are
 * there and the gate is closed.
 */

import { test } from "@c9up/helix";
import { createClient, forceExitAfter } from "./_helpers.js";

const client = createClient();

test.group("kitchen-sink > e2e > station", (group) => {
	group.setup(async () => {
		await client.boot();
	});
	group.teardown(async () => {
		await client.close();
		forceExitAfter();
	});

	test("serves the login screen", async ({ assert }) => {
		const response = await client.get("/admin/login");
		response.assertStatus(200);
		// Rendered, not a stub: the form is what the template produced.
		assert.include(response.body(), "<form");
	});

	test("sends an unauthenticated visitor to the login screen", async ({
		assert,
	}) => {
		const response = await client.get("/admin").redirects(0);
		assert.oneOf(response.status(), [302, 303]);
		assert.include(String(response.header("location")), "/admin/login");
	});

	test("keeps a resource route closed to an anonymous visitor", async ({
		assert,
	}) => {
		// The gate on `/admin` proves the index is closed; this proves the door
		// a resource opens is closed too, which is the one that could fail open.
		const response = await client.get("/admin/projects").redirects(0);
		assert.notEqual(response.status(), 200);
	});

	test("refuses a login with no credentials rather than opening the door", async ({
		assert,
	}) => {
		const response = await client.post("/admin/login").form({});
		assert.notEqual(response.status(), 200);
	});
});
