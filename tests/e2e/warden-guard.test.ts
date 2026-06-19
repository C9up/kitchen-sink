/**
 * Real `@c9up/ream` ↔ `@c9up/warden` integration — the test that was MISSING
 * and let a fail-open ship: it runs the REAL Ream HTTP kernel against the REAL
 * `wardenMiddleware` on a `@Guard`-decorated controller route.
 *
 * The kernel populates `ctx.route.controller/action` (Adonis shape) and
 * `ctx.containerResolver`. Warden must read the guard metadata from `ctx.route`
 * (NOT a non-existent top-level `ctx.controller`) and resolve its `AuthManager`
 * from `ctx.containerResolver` (NOT by importing `@c9up/ream`).
 *
 * Regression discriminator: the **valid-token → 200** case. With the fail-open
 * (warden reading `ctx.controller` = `undefined`), the route is treated as
 * public, warden never authenticates, `ctx.auth` stays unauthenticated, and
 * Ream's own guard enforcer then 401s — so even a VALID token would 401. A 200
 * here proves warden read `ctx.route` and authenticated end-to-end.
 *
 * Lives in kitchen-sink because it is the one place that depends on BOTH
 * packages; warden stays `@c9up/ream`-free (it cannot host this test itself).
 */
import "reflect-metadata";
import { describe, expect, it } from "@c9up/helix";
import {
	Container,
	type HttpContext,
	MiddlewareRegistry,
	Router,
	createHttpKernel,
} from "@c9up/ream";
import { AuthManager, type AuthStrategy, Guard } from "@c9up/warden";
import { wardenMiddleware } from "@c9up/warden/middleware";

class SecureController {
	@Guard("jwt")
	async secret(ctx: HttpContext) {
		ctx.response.json({ userId: ctx.auth?.user?.id ?? null });
	}
}

const jwtStrategy: AuthStrategy = {
	name: "jwt",
	async authenticate() {
		return { authenticated: false, error: "n/a" };
	},
	async verify(token) {
		return token === "valid-token"
			? { authenticated: true, user: { id: "u1" } }
			: { authenticated: false, error: "bad token" };
	},
};

function buildKernel() {
	const router = new Router();
	router.get("/secret", [SecureController, "secret"]);
	const container = new Container();
	container.bindValue(
		AuthManager,
		new AuthManager({
			defaultStrategy: "jwt",
			strategies: { jwt: jwtStrategy },
		}),
	);
	// warden runs as router middleware (authenticator) BEFORE Ream's guard
	// enforcer — the real pipeline order.
	return createHttpKernel({
		router,
		middleware: new MiddlewareRegistry(),
		container,
		routerMiddleware: [wardenMiddleware],
	});
}

describe("kitchen-sink > e2e > warden @Guard via the real Ream kernel", () => {
	it("authenticates a guarded route with a valid Bearer — warden reads ctx.route + ctx.containerResolver (no fail-open)", async () => {
		const kernel = buildKernel();
		const res = await kernel({
			method: "GET",
			path: "/secret",
			query: "",
			headers: { authorization: "Bearer valid-token" },
			body: "",
		});
		expect(res.status).toBe(200);
		expect(JSON.parse(res.body).userId).toBe("u1");
	});

	it("rejects the guarded route with no token (401)", async () => {
		const kernel = buildKernel();
		const res = await kernel({
			method: "GET",
			path: "/secret",
			query: "",
			headers: {},
			body: "",
		});
		expect(res.status).toBe(401);
	});

	it("rejects an invalid Bearer (401)", async () => {
		const kernel = buildKernel();
		const res = await kernel({
			method: "GET",
			path: "/secret",
			query: "",
			headers: { authorization: "Bearer nope" },
			body: "",
		});
		expect(res.status).toBe(401);
	});
});
