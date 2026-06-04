/**
 * E2E test fixtures — wires `@c9up/helix`'s TestClient (the canonical
 * Ream test surface) to a real Ignitor + HyperServer boot. The same
 * providers, migrations, NAPI binaries, and WAL pragmas as production
 * run here; tests assert against the actual HTTP wire, never against
 * service objects directly.
 *
 * The helix runner is invoked with `--threads=1`, so every test file
 * shares one worker process AND one module evaluation of this helper.
 * `KITCHEN_DB_PATH` is therefore stamped FRESH inside `bootFn` on
 * every `createClient().boot()` — letting each test file's
 * `beforeAll` carve out its own sqlite file. Setting it at module
 * top-level (the previous shape) made all test files inherit one
 * shared DB, which caused intermittent failures: a signup in one
 * file collided with a duplicate-email check from another, the test
 * silently treated the 409 as a passing call, and downstream
 * `Bearer undefined` requests landed as 401/403.
 *
 * IMPORTANT: helix workers must `process.exit()` after `afterAll`,
 * because Ream's HyperServer (Rust-backed tokio listener) keeps the
 * Node event loop alive even after `started.stop()` returns. Without
 * the force-exit, the worker's result frame reaches the parent but
 * the child never exits naturally — helix's per-file watchdog then
 * kills it and reports a timeout even though tests passed. See
 * `forceExitAfter` below.
 */
import "reflect-metadata";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TestClient } from "@c9up/helix";
import { Ignitor } from "@c9up/ream";
import { createHyperServerFactory } from "@c9up/ream/bootstrap";

const APP_ROOT = new URL("../../", import.meta.url);

// Per-TestClient sqlite path so test FILES in the same helix process
// (helix runs `--threads=1`, so every imported test file shares one
// PID) don't end up sharing the same DB and tripping over each other's
// signups (e.g. auth.test creates `alice@example.com`, workspace.test
// tries to recreate it → 409 → undefined token → cascade of 401s).
// `mkdtempSync` per call guarantees a fresh file per `createClient()`.
async function bootFn(
	port: number,
): Promise<{ port: number; close: () => Promise<void> }> {
	const tmpDir = mkdtempSync(join(tmpdir(), "ream-kitchen-e2e-"));
	process.env.KITCHEN_DB_PATH = join(tmpDir, `db-${process.pid}.sqlite`);
	// Under swc-node the runtime resolves `./reamrc.js` to the source
	// `./reamrc.ts`, but ONLY when the import specifier is a static
	// `import` statement. Dynamic `import(URL)` with a constructed
	// href bypasses the path-rewrite hook, so we point at the .ts
	// source directly.
	const rc = (await import(new URL("./reamrc.ts", APP_ROOT).href)).default;
	const ignitor = new Ignitor(APP_ROOT, {
		port,
		serverFactory: createHyperServerFactory(),
		importer: (p: string) =>
			p.startsWith("./") || p.startsWith("../")
				? import(new URL(p, APP_ROOT).href)
				: import(p),
	})
		.useRcFile(rc)
		.httpServer();
	const started = await ignitor.start();
	return {
		port: await started.port(),
		close: async () => {
			await started.stop();
		},
	};
}

/** Build a fresh TestClient. Call in `beforeAll`. */
export function createClient(): TestClient {
	return new TestClient(bootFn);
}

/**
 * Wire into a test file's `afterAll` to guarantee the worker exits
 * even when the Rust HyperServer's tokio runtime keeps the Node event
 * loop alive past `Ignitor.stop()`. Helix's worker emits its result
 * frame BEFORE this runs, so the parent has the outcome by the time
 * we hard-exit.
 */
export function forceExitAfter(): void {
	setImmediate(() => {
		process.exit(0);
	});
}
