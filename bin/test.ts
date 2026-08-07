/**
 * Test entry — the AdonisJS `bin/test.ts`.
 *
 * Reads the `tests` block of `reamrc.ts` and hands its suites to the runner,
 * exactly as `bin/server.ts` hands the rc file to the Ignitor. `ream test` does
 * the same thing from the CLI; this exists so `pnpm test` works without the
 * Rust binary installed.
 *
 *   node --import @swc-node/register/esm-register bin/test.ts [suite...]
 */
import { runTestsFromRcFile } from "@c9up/ream/test-runner";

const suites = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const threads = Number(
	process.argv.find((arg) => arg.startsWith("--threads="))?.slice(10) ?? "1",
);

try {
	process.exitCode = await runTestsFromRcFile("./reamrc.ts", {
		suites,
		threads: Number.isFinite(threads) && threads > 0 ? threads : 1,
	});
} catch (err) {
	// A misspelled suite name is a user error, not a crash.
	process.stderr.write(
		`kitchen-sink: ${err instanceof Error ? err.message : String(err)}\n`,
	);
	process.exitCode = 1;
}
