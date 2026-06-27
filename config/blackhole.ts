import { defineConfig } from "@c9up/blackhole/config";

// Signed-CSRF secret. Real apps set APP_KEY in .env; dev fallback keeps the
// demo bootable. Must be ≥ 32 bytes (HMAC key for the signed double-submit).
const appKey =
	process.env.APP_KEY ?? "kitchen-sink-dev-app-key-32-bytes-minimum!!";

export default defineConfig({
	xss: true,
	// CSRF is ON (signed double-submit). The existing API surface is Bearer/JWT
	// (CSRF-immune — the browser can't attach Authorization cross-site), so those
	// routes are excepted; the session/cookie-authed web routes (/login POST,
	// /download) are NOT excepted and get full CSRF protection. This is the
	// dual-guard split: cookie routes → CSRF, bearer routes → exempt.
	csrf: {
		exceptRoutes: [
			"/auth*",
			"/workspaces*",
			"/projects*",
			"/tasks*",
			"/invitations*",
			"/me*",
			"/__live*",
			"/__relay*",
			"/rpc*",
		],
	},
	secret: appKey,
	rateLimit: { max: 1000, windowSeconds: 60 },
	// Demo CSP: allow the live-counter page's inline importmap + module. (Prod
	// should use per-request nonces; blackhole's `@nonce` is the path — see the
	// nonce request/response desync noted in the live-components work.)
	securityHeaders: { csp: "default-src 'self'; script-src 'self' 'unsafe-inline'" },
});
