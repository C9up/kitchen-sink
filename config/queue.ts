/**
 * Bay queue config — picked up by `@c9up/bay/provider` at boot.
 *
 * Memory driver is used for the demo + tests. Job handlers are
 * registered in `start/services.ts` against the
 * `@c9up/bay/services/main` singleton.
 */

export default {
	driver: "memory" as const,
};
