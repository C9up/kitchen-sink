/**
 * Console entrypoint — Ream's `ace` equivalent. Boots the app in console mode
 * (providers + DB open, no HTTP server) and dispatches the command named in
 * argv against the commands registered in `reamrc.ts`.
 *
 *   pnpm console <command> [args] [--flags]
 *   pnpm atlas:check        # → this entry with `atlas:check`
 */
import "reflect-metadata";
import { Ignitor, prettyPrintError } from "@c9up/ream";

const APP_ROOT = new URL("../", import.meta.url);

const IMPORTER = (filePath: string) =>
	filePath.startsWith("./") || filePath.startsWith("../")
		? import(new URL(filePath, APP_ROOT).href)
		: import(filePath);

new Ignitor(APP_ROOT, { importer: IMPORTER })
	.useRcFile((await import("../reamrc.js")).default)
	.console()
	.handle(process.argv.slice(2))
	.catch((err) => {
		prettyPrintError(err);
		process.exit(1);
	});
