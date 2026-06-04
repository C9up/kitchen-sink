/**
 * Echo cache config — picked up by `@c9up/echo/provider` at boot.
 *
 * The default `memory` driver is fine for the demo (single-process,
 * tests reset state per test file). Production apps swap to Redis by
 * binding `CacheManager` themselves in `start/services.ts`.
 */

export default {
	driver: "memory" as const,
	prefix: "kitchen-sink",
	ttl: 30,
};
