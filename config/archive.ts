import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// `data/storage` is local-only. Tests can override via the
// `ARCHIVE_ROOT` env var so per-process directories don't fight on
// the same tree; production deployments swap to `s3` / `gcs` by
// editing this file alone.
const root =
	process.env.ARCHIVE_ROOT ?? join(__dirname, "..", "data", "storage");

export default {
	driver: "local" as const,
	local: { root },
};
