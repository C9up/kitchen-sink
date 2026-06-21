/**
 * Environment validation — the AdonisJS pattern, via Ream's `Env`.
 *
 * `Env.create` loads the `.env*` files at IMPORT time and validates the
 * variables against the schema. Config files import this module
 * (`import env from '#start/env.js'`) so the env is always loaded before any
 * config is read — in every flow (server, console, tests), with no shell
 * pre-loading. Reading a variable: `env.get('PORT')` (typed).
 */
import { Env } from "@c9up/ream";

export default await Env.create(new URL("../", import.meta.url), {
	NODE_ENV: Env.schema
		.enum(["development", "production", "test"] as const)
		.optional(),
	PORT: Env.schema.number().optional(),
	// Tests / ops point the app at a different sqlite file via this var.
	KITCHEN_DB_PATH: Env.schema.string.optional(),
});
