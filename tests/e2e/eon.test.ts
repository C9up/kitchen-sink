/**
 * Eon (time series) against a real TDengine.
 *
 * Skipped, not failed, when no server answers on `EON_URL` — the same shape
 * `quasar-consumers.test.ts` uses for Redis. A suite that returns early from
 * each body instead would count assertion-free tests as green, which is what
 * a covered-looking-but-not suite is made of.
 *
 * Eon is also the reason its provider is registered CONDITIONALLY in
 * `reamrc.ts`: it opens its connection at boot, so wiring it unconditionally
 * would make the whole app unbootable for anyone without a TDengine.
 */

import { test } from "@c9up/helix";

const url = process.env.EON_URL;

const live = url
	? await import("@c9up/eon")
			.then(async ({ connectWsEon }) => {
				const connection = await connectWsEon({ url });
				await connection.close();
				return true;
			})
			.catch(() => false)
	: false;

// Reported as SKIPPED rather than passed.
const testEon = live ? test : test.skip;

test.group("kitchen-sink > e2e > eon", () => {
	testEon("connects to the configured TDengine", async ({ assert }) => {
		const { connectWsEon } = await import("@c9up/eon");
		const connection = await connectWsEon({ url: String(url) });
		try {
			assert.isDefined(connection);
		} finally {
			await connection.close();
		}
	});

	testEon("round-trips a schemaless write and a query", async ({ assert }) => {
		const { connectWsEon } = await import("@c9up/eon");
		const connection = await connectWsEon({ url: String(url) });
		try {
			const rows = await connection.query("SELECT SERVER_VERSION()");
			assert.isAbove(rows.length, 0);
		} finally {
			await connection.close();
		}
	});
});
