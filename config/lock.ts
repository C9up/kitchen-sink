import { defineConfig, stores } from "@c9up/eclipse";

/**
 * Distributed locks.
 *
 * `memory` by default so the app runs single-process without Redis. The
 * `redis` store is what a second replica needs — a memory store across two
 * replicas locks nothing at all, silently.
 */
export default defineConfig({
	default: "memory",

	stores: {
		memory: stores.memory(),
		redis: stores.redis({ connection: "main" }),
	},
});
