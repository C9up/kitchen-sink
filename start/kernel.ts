/**
 * HTTP kernel — wires the error handler, global blackhole sanitisation,
 * and the best-effort auth middleware. Routes that call `.guard('jwt')`
 * (e.g. the auto-registered relay endpoints) rely on this middleware
 * to populate `ctx.auth` before the guard enforcer runs.
 */
import { blackholeMiddleware } from "@c9up/blackhole/middleware";
import router from "@c9up/ream/services/router";
import server from "@c9up/ream/services/server";

server.errorHandler(() => import("#exceptions/handler.js"));

// Blackhole runs across every route now that ReamContext aligns
// structurally with HttpContext — no adapter / cast needed.
// AuthMiddleware lands after it so the bearer token is parsed AFTER
// the body has been sanitised (no behavioural dependency, just a
// stable ordering).
router.use([
	blackholeMiddleware,
	() => import("#middleware/auth_middleware.js"),
]);
