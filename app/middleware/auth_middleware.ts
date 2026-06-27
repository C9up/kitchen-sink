import type { HttpContext } from "@c9up/ream";
import type { AuthResult } from "@c9up/warden";
import auth from "@c9up/warden/services/main";

/**
 * Best-effort dual-guard auth — runs on every routed request and populates
 * `ctx.auth`:
 *  - `Authorization: Bearer <jwt>` → verified via the JWT strategy (API/mobile).
 *  - otherwise, if a session exists → verified via the session strategy's
 *    `verifyWithContext` (cookie/web). Same path Warden's own middleware uses;
 *    the session lives on `ctx.session` (set by SessionMiddleware upstream).
 *
 * The guard enforcer (driven by `.guard('jwt')` / `.guard('session')` on the
 * route) then asserts `ctx.auth.authenticated === true` and throws 401 when
 * missing. Routes with no `.guard(...)` still get `ctx.auth` populated.
 */

/** Session-capable strategies expose `verifyWithContext` (the cookie path). */
interface StrategyWithContext {
	verifyWithContext(
		token: string,
		ctx: { session?: unknown },
	): Promise<AuthResult>;
}

function hasVerifyWithContext(value: unknown): value is StrategyWithContext {
	return (
		typeof value === "object" &&
		value !== null &&
		"verifyWithContext" in value &&
		typeof value.verifyWithContext === "function"
	);
}

function applyResult(ctx: HttpContext, result: AuthResult): void {
	if (result.authenticated && result.user) {
		ctx.auth = {
			authenticated: true,
			user: result.user,
			roles: result.user.roles ?? [],
			permissions: result.user.permissions ?? [],
		};
	}
}

export default class AuthMiddleware {
	async handle(ctx: HttpContext, next: () => Promise<void>) {
		const header = ctx.request.header("authorization") ?? "";
		if (header.startsWith("Bearer ")) {
			applyResult(ctx, await auth.verify(header.slice(7)));
		} else if (ctx.session && auth.getStrategyNames().includes("session")) {
			const strategy = auth.getStrategy("session");
			if (hasVerifyWithContext(strategy)) {
				applyResult(
					ctx,
					await strategy.verifyWithContext("", { session: ctx.session }),
				);
			}
		}
		await next();
	}
}
