import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SQLITE_PROD_PRAGMAS } from "@c9up/atlas";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Allow tests (or future ops scripts) to point the app at a different
// sqlite file via env. Defaults to `data/kitchen.db` so `pnpm dev` /
// `pnpm start` work without configuration. E2E suites use this to
// keep per-suite DB files so parallel workers don't share a journal.
const dbPath =
	process.env.KITCHEN_DB_PATH ?? join(__dirname, "..", "data", "kitchen.db");

export default {
	url: `sqlite:${dbPath}`,
	// sqlite serializes writers and benefits little from connection
	// pooling. The default `poolMax=10` opened up a snapshot race in WAL
	// mode: a read from pool connection B could miss a commit just made
	// through connection A under fast-fire e2e sequences. Pinning
	// `poolMin=poolMax=1` forces every query through one connection so
	// read-after-write is always immediate, killing the flake
	// (`bob accepts → 500`, `subscribe → 403`) that surfaced once the
	// per-package vitest runner started exercising kitchen-sink properly.
	poolMin: 1,
	poolMax: 1,
	// `busy_timeout=5000` rides alongside WAL — sqlite waits up to 5s for
	// a competing writer / checkpoint to release before returning BUSY.
	// Avoids spurious "database is locked" between consecutive test boots.
	pragmas: { ...SQLITE_PROD_PRAGMAS, busy_timeout: 5000 },
	migrations: {
		path: join(__dirname, "..", "database", "migrations"),
	},
};
