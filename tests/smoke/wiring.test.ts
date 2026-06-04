/**
 * Wiring smoke — 1 assertion per @c9up/* package that confirms the
 * package is importable + exports its load-bearing symbol(s). No HTTP,
 * no DB — boots only the imports, runs in well under 1s, and catches
 * regressions in package builds / barrel exports / type emit.
 *
 * The full request-flow tests live in `tests/e2e/*.test.ts`.
 */
import { describe, expect, it } from "@c9up/helix";

describe("kitchen-sink > wiring > ream + atlas core", () => {
	it("@c9up/ream exposes Ignitor + inject + Inject", async () => {
		const m = await import("@c9up/ream");
		expect(typeof m.Ignitor).toBe("function");
		expect(typeof m.inject).toBe("function");
		expect(typeof m.Inject).toBe("function");
	});

	it("@c9up/atlas exposes BaseEntity + BaseRepository + transaction + SQLITE_PROD_PRAGMAS", async () => {
		const m = await import("@c9up/atlas");
		expect(typeof m.BaseEntity).toBe("function");
		expect(typeof m.BaseRepository).toBe("function");
		expect(typeof m.transaction).toBe("function");
		expect(m.SQLITE_PROD_PRAGMAS).toMatchObject({
			journal_mode: "WAL",
			synchronous: "NORMAL",
		});
	});
});

describe("kitchen-sink > wiring > auth stack", () => {
	it("@c9up/sigil exposes Hash with the three drivers", async () => {
		const m = await import("@c9up/sigil");
		expect(typeof m.Hash).toBe("function");
		const h = new m.Hash({
			default: "argon2",
			drivers: {
				argon2: { driver: "argon2" },
				bcrypt: { driver: "bcrypt" },
				scrypt: { driver: "scrypt" },
			},
		});
		expect(h.use("argon2")).toBeDefined();
		expect(h.use("bcrypt")).toBeDefined();
		expect(h.use("scrypt")).toBeDefined();
	});

	it("@c9up/warden exposes JwtStrategy + AuthManager + TokenBlacklist", async () => {
		const m = await import("@c9up/warden");
		expect(typeof m.JwtStrategy).toBe("function");
		expect(typeof m.AuthManager).toBe("function");
		expect(typeof m.TokenBlacklist).toBe("function");
		expect(typeof m.MemoryBlacklistDriver).toBe("function");
		expect(typeof m.generateJwtSecret).toBe("function");
	});

	it("@c9up/rune validates inputs against a schema", async () => {
		const { rules, schema } = await import("@c9up/rune");
		const s = schema<{ email: string }>({ email: rules.string().email() });
		expect(s.validate({ email: "x@y.z" }).valid).toBe(true);
		expect(s.validate({ email: "nope" }).valid).toBe(false);
	});
});

describe("kitchen-sink > wiring > observability + security", () => {
	it("@c9up/spectrum exposes Logger + ConsoleChannel", async () => {
		const m = await import("@c9up/spectrum");
		expect(typeof m.Logger).toBe("function");
		expect(typeof m.ConsoleChannel).toBe("function");
	});

	it("@c9up/blackhole exposes the middleware + createBlackhole", async () => {
		const mw = await import("@c9up/blackhole/middleware");
		expect(typeof mw.blackholeMiddleware).toBe("function");
		expect(typeof mw.createBlackhole).toBe("function");
	});
});

describe("kitchen-sink > wiring > side-channel packages", () => {
	it("@c9up/ream/events exposes the NAPI bus + provider + Emitter via subpaths", async () => {
		// Package root resolves to the NAPI binding (EventBus class), the
		// other event-bus surfaces live behind subpath exports.
		const root = await import("@c9up/ream/events");
		expect(typeof root.EventBus).toBe("function");
		const provider = await import("@c9up/ream/events/provider");
		expect(typeof provider.default).toBe("function");
		const events = await import("@c9up/ream/events");
		expect(typeof events.Emitter).toBe("function");
		expect(typeof events.BaseEvent).toBe("function");
	});

	it("@c9up/bay exposes QueueManager + MemoryDriver + RedisDriver", async () => {
		const m = await import("@c9up/bay");
		expect(typeof m.QueueManager).toBe("function");
		expect(typeof m.MemoryDriver).toBe("function");
		expect(typeof m.RedisDriver).toBe("function");
	});

	it("@c9up/rover exposes Mail + SmtpTransport + LogTransport", async () => {
		const m = await import("@c9up/rover");
		expect(typeof m.Mail).toBe("function");
		expect(typeof m.SmtpTransport).toBe("function");
		expect(typeof m.LogTransport).toBe("function");
		expect(typeof m.RoverProvider).toBe("function");
	});

	it("@c9up/nova exposes Nova + generateVapidKeys", async () => {
		const m = await import("@c9up/nova");
		expect(typeof m.Nova).toBe("function");
		expect(typeof m.NovaProvider).toBe("function");
		expect(typeof m.generateVapidKeys).toBe("function");
	});

	it("@c9up/archive exposes S3Driver + ArchiveProvider", async () => {
		const m = await import("@c9up/archive");
		expect(typeof m.S3Driver).toBe("function");
	});

	it("@c9up/echo exposes CacheManager + MemoryDriver + RedisDriver", async () => {
		const m = await import("@c9up/echo");
		expect(typeof m.CacheManager).toBe("function");
		expect(typeof m.MemoryDriver).toBe("function");
		expect(typeof m.RedisDriver).toBe("function");
	});
});

describe("kitchen-sink > wiring > UI + i18n + time", () => {
	it("@c9up/chronos exposes Chronos namespace + Duration + Interval + RRule helpers", async () => {
		const m = await import("@c9up/chronos");
		expect(typeof m.at).toBe("function");
		expect(typeof m.Duration).toBe("function");
		expect(typeof m.Interval).toBe("function");
		expect(typeof m.expandRRule).toBe("function");
		expect(typeof m.Chronos).toBe("object");
	});

	it("@c9up/rosetta exposes Rosetta + FileSystemLoader", async () => {
		const m = await import("@c9up/rosetta");
		expect(typeof m.Rosetta).toBe("function");
		expect(typeof m.FileSystemLoader).toBe("function");
	});

	it("@c9up/photon exposes PhotonMiddleware + PhotonRenderer + Meta", async () => {
		const m = await import("@c9up/photon");
		expect(typeof m.PhotonMiddleware).toBe("function");
		expect(typeof m.PhotonRenderer).toBe("function");
		expect(typeof m.Meta).toBe("function");
	});

	it("@c9up/aurora exposes html + component + renderToString + hydrate", async () => {
		const m = await import("@c9up/aurora");
		expect(typeof m.html).toBe("function");
		expect(typeof m.component).toBe("function");
		expect(typeof m.renderToString).toBe("function");
		expect(typeof m.hydrate).toBe("function");
	});

	it("@c9up/relay exposes Relay + Hub", async () => {
		const m = await import("@c9up/relay");
		expect(typeof m.Relay).toBe("function");
		expect(typeof m.Hub).toBe("function");
		expect(typeof m.RelayProvider).toBe("function");
	});

	it("@c9up/helix exposes TestClient", async () => {
		const m = await import("@c9up/helix");
		expect(typeof m.TestClient).toBe("function");
	});
});
