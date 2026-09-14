/**
 * Eclipse and Parsec, through the real kernel.
 *
 * Both cross package boundaries in a way a unit test cannot: eclipse's lock
 * has to be the one the container published from `config/lock.ts`, and
 * parsec's numbers have to come from requests that actually went through the
 * HTTP middleware.
 */

import locks from "@c9up/eclipse/services/main";
import { test } from "@c9up/helix";
import metrics from "@c9up/parsec/services/main";
import { createClient, forceExitAfter } from "./_helpers.js";

const client = createClient();

test.group("kitchen-sink > e2e > eclipse + parsec", (group) => {
	group.setup(async () => {
		await client.boot();
	});
	group.teardown(async () => {
		await client.close();
		forceExitAfter();
	});

	test("the app's lock manager comes from config/lock.ts", async ({ assert }) => {
		// Not a manager built in the test: `use('redis')` only resolves because
		// the config file declared that store.
		assert.isDefined(locks.use("memory"));
		assert.isDefined(locks.use("redis"));
	});

	test("only one holder takes a name, and releasing frees it", async ({
		assert,
	}) => {
		const first = locks.createLock("kitchen:nightly", "5s");
		const second = locks.createLock("kitchen:nightly", "5s");

		assert.isTrue(await first.acquireImmediately());
		assert.isFalse(await second.acquireImmediately());

		await first.release();
		assert.isTrue(await second.acquireImmediately());
		await second.release();
	});

	test("run() reports whether it ran, not just what it returned", async ({
		assert,
	}) => {
		const held = locks.createLock("kitchen:once", "5s");
		await held.acquireImmediately();

		const [ran, value] = await locks
			.createLock("kitchen:once", "5s")
			.runImmediately(async () => "unreachable");
		assert.isFalse(ran);
		assert.isNull(value);

		await held.release();
	});

	test("/__metrics exposes what the HTTP middleware recorded", async ({
		assert,
	}) => {
		// Awaited, not `.catch()`-ed: the TestClient's `get()` returns a
		// thenable BUILDER, not a promise, and a non-2xx is a response here
		// rather than a rejection.
		await client.get("/projects/1/tasks");

		const response = await client.get("/__metrics");
		response.assertStatus(200);
		const body = response.text();

		// The content-type is right — `text/plain; version=0.0.4` — and the
		// body still comes back with every space as `&#32;` and every `=` as
		// `&#61;`. Something is entity-escaping a non-HTML response. See the
		// note on this group.
		assert.include(body, "# TYPE http_server_requests_total counter");
		assert.include(body, "http_server_request_duration_seconds_bucket");
		assert.include(body, 'method="GET"');
	});

	test("routes are labelled by PATTERN, never by the URL", async ({
		assert,
	}) => {
		// The whole cardinality defence rests on this: /tasks/1 and /tasks/2
		// must be one series, or a 404 sweep can inflate the metric until the
		// process dies.
		// A GET route that EXISTS. `/tasks/:id` is a PATCH, so a GET to it
		// matches nothing and would prove only that unmatched requests are not
		// labelled by URL — not that matched ones are labelled by pattern.
		// Guarded, so these answer 401; the middleware records them anyway,
		// which is the point.
		await client.get("/projects/1/tasks");
		await client.get("/projects/2/tasks");

		const body = (await client.get("/__metrics")).text();
		// Both the absence of the URLs AND the presence of the pattern: the
		// first assertion alone passes for a request that matched nothing,
		// which would make this test green against a broken label.
		assert.notInclude(body, 'route="/projects/1/tasks"');
		assert.notInclude(body, 'route="/projects/2/tasks"');
		assert.include(body, 'route="/projects/:projectId/tasks"');
	});

	test("an unmatched request gets a constant, not its path", async ({
		assert,
	}) => {
		await client.get("/definitely-not-a-route-42");
		const body = (await client.get("/__metrics")).text();
		assert.notInclude(body, "definitely-not-a-route-42");
		assert.include(body, 'route="<unmatched>"');
	});

	test("the metrics manager is the one the provider published", ({ assert }) => {
		assert.isDefined(metrics.use("prometheus"));
		assert.isDefined(metrics.use("noop"));
	});
});
