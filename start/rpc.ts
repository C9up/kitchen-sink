/**
 * JSON-RPC demo — registers a couple of public methods on the shared RpcRouter
 * (bound under the `rpc` container token by `RpcProvider`). The `RpcProvider`
 * mounts `POST /rpc`; these methods are exercised end-to-end by
 * `tests/e2e/rpc.test.ts` through aurora's `createRpcClient`.
 */
import type { RpcRouter } from "@c9up/ream/rpc/router";
import app from "@c9up/ream/services/app";

const rpc = app.container.make<RpcRouter>("rpc");

/** Narrow an unknown JSON-RPC param to a string-keyed object. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function asNumber(value: unknown): number {
	if (typeof value !== "number") {
		throw new Error("expected a number");
	}
	return value;
}

// Echo the params straight back — proves request/response round-trips.
rpc.method("demo.echo", (_ctx, params) => params);

// Add two numbers — proves typed params + a computed result.
rpc.method("demo.add", (_ctx, params) => {
	if (!isRecord(params)) throw new Error("params must be an object { a, b }");
	return asNumber(params.a) + asNumber(params.b);
});
