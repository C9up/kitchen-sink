import type { HttpContext } from "@c9up/ream";
import auth from "@c9up/warden/services/main";

/**
 * Best-effort bearer-token auth — runs on every routed request and
 * populates `ctx.auth` when a valid JWT is present. The guard
 * middleware (driven by `.guard('jwt')` on the route) then enforces
 * `ctx.auth.authenticated === true` and throws 401 when missing.
 *
 * Routes that don't call `.guard(...)` still get `ctx.auth` populated
 * — this is what lets controllers and the relay authorizer read
 * `ctx.auth.user?.id` without re-parsing the header.
 */
export default class AuthMiddleware {
	async handle(ctx: HttpContext, next: () => Promise<void>) {
		const header = ctx.request.header("authorization") ?? "";
		if (header.startsWith("Bearer ")) {
			const token = header.slice(7);
			const result = await auth.verify(token);
			if (result.authenticated && result.user) {
				ctx.auth = {
					authenticated: true,
					user: result.user,
					roles: result.user.roles ?? [],
					permissions: result.user.permissions ?? [],
				};
			}
		}
		await next();
	}
}
