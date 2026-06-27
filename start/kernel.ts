/**
 * HTTP kernel — wires the error handler, global blackhole sanitisation,
 * and the best-effort auth middleware. Routes that call `.guard('jwt')`
 * (e.g. the auto-registered relay endpoints) rely on this middleware
 * to populate `ctx.auth` before the guard enforcer runs.
 */
import { blackholeMiddleware } from "@c9up/blackhole/middleware";
import { BodyParserMiddleware, SessionMiddleware } from "@c9up/ream";
import router from "@c9up/ream/services/router";
import server from "@c9up/ream/services/server";

server.errorHandler(() => import("#exceptions/handler.js"));

// Cookie session (stateless — data lives in the encrypted cookie, no Redis).
// Runs before AuthMiddleware so `ctx.session` is set when the session guard
// resolves the user. Secret = APP_KEY (dev fallback mirrors config/blackhole).
const session = new SessionMiddleware({
	driver: "cookie",
	secret: process.env.APP_KEY ?? "kitchen-sink-dev-app-key-32-bytes-minimum!!",
});

// BodyParser parses json/form/multipart bodies into `request.body()` and
// hydrates `request.file()` — the AdonisJS default kernel registers it
// globally, so uploads work out of the box (no silent 422 from an
// unparsed multipart body).
const bodyParser = new BodyParserMiddleware();

// Blackhole runs across every route now that ReamContext aligns
// structurally with HttpContext — no adapter / cast needed.
// AuthMiddleware lands after it so the bearer token is parsed AFTER
// the body has been sanitised (no behavioural dependency, just a
// stable ordering).
router.use([
	blackholeMiddleware,
	(ctx, next) => bodyParser.handle(ctx, next),
	(ctx, next) => session.handle(ctx, next),
	() => import("#middleware/auth_middleware.js"),
]);
