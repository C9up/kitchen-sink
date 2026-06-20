import { defineConfig } from "@c9up/blackhole/config";

export default defineConfig({
	xss: true,
	csrf: false, // CSRF off so cross-origin smoke tests can POST without a token
	rateLimit: { max: 1000, windowSeconds: 60 },
	// Demo CSP: allow the live-counter page's inline importmap + module. (Prod
	// should use per-request nonces; blackhole's `@nonce` is the path — see the
	// nonce request/response desync noted in the live-components work.)
	securityHeaders: { csp: "default-src 'self'; script-src 'self' 'unsafe-inline'" },
});
