/**
 * Static files, served by a real application.
 *
 * Nothing served `public/` before: the middleware existed in the core, was
 * exported, and no application — this one included — ever mounted it. So the
 * first thing worth asserting is that registering the provider is the whole
 * setup, the way it is upstream.
 */

import { test } from "@c9up/helix";
import { createClient, forceExitAfter } from "./_helpers.js";

const client = createClient();

test.group("kitchen-sink > e2e > static", (group) => {
	group.setup(async () => {
		await client.boot();
	});
	group.teardown(async () => {
		await client.close();
		forceExitAfter();
	});

	test("serves an image from public/ with no route declared for it", async ({
		assert,
	}) => {
		const response = await client.get("/pixel.png");
		response.assertStatus(200);
		assert.equal(response.header("content-type"), "image/png");
		// A real PNG, so this proves bytes and not just a status.
		assert.equal(response.header("content-length"), "70");
	});

	test("answers 304 when the client already has the file", async ({
		assert,
	}) => {
		const first = await client.get("/pixel.png");
		const etag = String(first.header("etag"));
		assert.match(etag, /^W\/"/);

		const second = await client
			.get("/pixel.png")
			.header("if-none-match", etag);
		second.assertStatus(304);
	});

	test("advertises that it can be seeked, and honours a byte range", async ({
		assert,
	}) => {
		const full = await client.get("/pixel.png");
		assert.equal(full.header("accept-ranges"), "bytes");

		const partial = await client.get("/pixel.png").header("range", "bytes=0-3");
		partial.assertStatus(206);
		assert.equal(partial.header("content-range"), "bytes 0-3/70");
	});

	test("does not let a request climb out of the public directory", async ({
		assert,
	}) => {
		// The whole point of the guard, exercised through the real HTTP stack
		// rather than against the middleware in isolation.
		for (const path of [
			"/../../package.json",
			"/%2e%2e/%2e%2e/package.json",
			"/etc/passwd",
		]) {
			const response = await client.get(path);
			assert.notEqual(response.status(), 200, path);
		}
	});
});
