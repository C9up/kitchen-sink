/**
 * JSON-RPC end-to-end — aurora's `createRpcClient` (real `fetch`) against the
 * real Ream `RpcProvider` endpoint (`POST /rpc`) booted by the TestClient on an
 * ephemeral port. Proves the browser client speaks the exact wire the server
 * expects: result, error, and batch. Demo methods live in `start/rpc.ts`.
 */
import { createRpcClient, isRpcError, type RpcClient } from "@c9up/aurora/rpc";
import { afterAll, beforeAll, describe, expect, it } from "@c9up/helix";
import type { TestClient } from "@c9up/ream/testing";
import { createClient, forceExitAfter } from "./_helpers.js";

let client: TestClient;
let rpc: RpcClient;

beforeAll(async () => {
	client = createClient();
	await client.boot();
	rpc = createRpcClient({ url: `http://127.0.0.1:${client.port}/rpc` });
}, 30_000);

afterAll(async () => {
	await client?.close();
	forceExitAfter();
});

describe("kitchen-sink > e2e > json-rpc (aurora client ↔ real server)", () => {
	it("round-trips demo.echo through the real RpcProvider endpoint", async () => {
		const out = await rpc.call("demo.echo", { hello: "world", n: 7 });
		expect(out).toEqual({ hello: "world", n: 7 });
	});

	it("calls demo.add with typed params + computed result", async () => {
		const sum = await rpc.call<number>("demo.add", { a: 2, b: 3 });
		expect(sum).toBe(5);
	});

	it("throws RpcError -32601 for an unknown method", async () => {
		const err = await rpc.call("demo.nope").catch((e) => e);
		expect(isRpcError(err)).toBe(true);
		if (!isRpcError(err)) throw new Error("expected an RpcError");
		expect(err.code).toBe(-32601);
		expect(err.message).toBe("Method not found");
	});

	it("batches calls and matches responses back by id", async () => {
		const results = await rpc.batch([
			{ method: "demo.echo", params: { x: 1 } },
			{ method: "demo.add", params: { a: 10, b: 5 } },
			{ method: "demo.nope" },
		]);
		expect(results[0]).toEqual({ ok: true, value: { x: 1 } });
		expect(results[1]).toEqual({ ok: true, value: 15 });
		expect(results[2].ok).toBe(false);
		if (!results[2].ok) expect(results[2].error.code).toBe(-32601);
	});
});
