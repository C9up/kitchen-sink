/**
 * Atom (exact decimal) and Comet (the JSON-RPC protocol) through the real
 * kernel.
 *
 * Atom is asserted over HTTP rather than in a unit test because the value has
 * to survive JSON on the way out: a Decimal that serialises to a float has
 * lost the property the package exists for.
 *
 * Comet is asserted by building the request with COMET's own helpers and
 * posting it to the app's real `/rpc`. That is the thing a unit test on
 * either side cannot show — that ream's RPC router and comet's client agree
 * on the wire, rather than each agreeing with its own fixture.
 */

import { buildRequest, isRpcShapedError } from "@c9up/comet/protocol";
import { test } from "@c9up/helix";
import { createClient, forceExitAfter } from "./_helpers.js";

const client = createClient();

test.group("kitchen-sink > e2e > atom + comet", (group) => {
	group.setup(async () => {
		await client.boot();
	});
	group.teardown(async () => {
		await client.close();
		forceExitAfter();
	});

	test("adds money exactly, where the float does not", async ({ assert }) => {
		const response = await client.get("/finance/sum");
		response.assertStatus(200);
		// `toString()` carries the currency — the amount alone is not a price.
		assert.equal(response.body().exact, "0.30 EUR");
		// The contrast is the point: the same sum in floating point.
		assert.equal(response.body().float, "0.30000000000000004");
	});

	test("splits a budget without losing a cent", async ({ assert }) => {
		// 100 / 3 rounds to 33.33 three times and loses a cent. `allocate`
		// hands the remainder out a minor unit at a time instead.
		const response = await client
			.post("/finance/split")
			.json({ amount: "100.00", shares: 3 });
		response.assertStatus(200);
		const { parts, sum, total } = response.body();
		assert.deepEqual(parts, ["33.34 EUR", "33.33 EUR", "33.33 EUR"]);
		assert.equal(sum, total);
	});

	test("the parts always sum back, for any share count", async ({ assert }) => {
		for (const shares of [1, 2, 6, 7, 11]) {
			const body = (
				await client.post("/finance/split").json({ amount: "10.00", shares })
			).body();
			assert.equal(body.sum, "10.00 EUR", `for ${shares} shares`);
		}
	});

	test("refuses a share count it cannot allocate", async ({ assert }) => {
		const response = await client
			.post("/finance/split")
			.json({ amount: "10.00", shares: 0 });
		response.assertStatus(422);
		assert.isString(response.body().error);
	});

	test("ream's /rpc answers a request comet built", async ({ assert }) => {
		// Built by comet, not hand-written: if the two ever disagree on the
		// envelope, this fails rather than a fixture agreeing with itself.
		const request = buildRequest("demo.echo", { message: "hi" }, 1);
		const response = await client.post("/rpc").json(request);
		response.assertStatus(200);
		assert.equal(response.body().jsonrpc, "2.0");
		assert.equal(response.body().id, 1);
		assert.isUndefined(response.body().error);
	});

	test("an unknown method comes back in comet's error shape", async ({
		assert,
	}) => {
		const response = await client
			.post("/rpc")
			.json(buildRequest("demo.nope", {}, 7));
		const body = response.body();
		assert.equal(body.id, 7);
		// Recognised by comet's own predicate — the shape is the contract.
		assert.isTrue(isRpcShapedError(body.error), JSON.stringify(body));
		assert.equal(body.error.code, -32601);
	});
});
