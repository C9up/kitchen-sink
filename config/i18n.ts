import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Rosetta i18n config — picked up by `@c9up/rosetta/provider` at boot.
 *
 * `rootDir` triggers a `FileSystemLoader` for `resources/lang/{en,fr}.json`.
 * The provider awaits `rosetta.boot()` before the first request lands,
 * so handlers can call `i18n.locale(...)` synchronously.
 */

export default {
	defaultLocale: "en",
	supportedLocales: ["en", "fr"],
	rootDir: join(__dirname, "..", "resources", "lang"),
};
