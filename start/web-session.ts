/**
 * Session/cookie web routes — the dual-guard demo (AdonisJS web-kit shape).
 *
 * The point: a cookie session means a plain `<a href="/download/…">` link is
 * authenticated automatically (the browser sends the cookie on navigation), so
 * the server knows WHO is downloading — no Bearer token to attach. That's the
 * PHP-session ergonomics, done statelessly (cookie driver) and CSRF-protected
 * (signed double-submit; these routes are NOT in blackhole's exceptRoutes).
 *
 * The existing JWT/Bearer API surface is untouched (defaultStrategy stays jwt);
 * this just adds a cookie-authed surface alongside it.
 */
import app from "@c9up/ream/services/app";
import router from "@c9up/ream/services/router";
import { AuthService } from "#modules/auth/services/AuthService.js";

/** Matches SessionStrategy's default sessionKey (config/auth.ts `session`). */
const SESSION_KEY = "auth_user_id";

function credsOf(body: unknown): { email: string; password: string } | null {
	if (typeof body !== "object" || body === null) return null;
	const email = "email" in body ? body.email : null;
	const password = "password" in body ? body.password : null;
	return typeof email === "string" && typeof password === "string"
		? { email, password }
		: null;
}

// GET /login — a GET so blackhole seeds the `XSRF-TOKEN` cookie BEFORE the POST
// (signed double-submit bootstrap; AdonisJS seeds the token on the page GET).
// The inline script reads that cookie and echoes it as `X-XSRF-TOKEN`.
router.get("/login", async ({ response }) => {
	response.header("content-type", "text/html; charset=utf-8");
	response.send(`<!doctype html><meta charset=utf-8><title>Login</title>
<h1>Session login</h1>
<form id=f>
  <input name=email placeholder=email>
  <input name=password type=password placeholder=password>
  <button>Log in</button>
</form>
<script>
  const cookie = (n) => document.cookie.split('; ').find(c => c.startsWith(n + '='))?.split('=')[1];
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const r = await fetch('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-XSRF-TOKEN': cookie('XSRF-TOKEN') ?? '' },
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    document.body.insertAdjacentHTML('beforeend', '<pre>' + JSON.stringify(await r.json()) + '</pre>');
  };
</script>`);
});

// POST /login — CSRF-protected (not excepted). Verify credentials, then log the
// user into the cookie session. `regenerate()` rotates the session id at the
// privilege boundary (session-fixation defence, CWE-384).
router.post("/login", async (ctx) => {
	const creds = credsOf(await ctx.request.body());
	if (!creds) {
		ctx.response.status(422).json({ ok: false, error: "email + password required" });
		return;
	}
	const svc = app.container.make<AuthService>(AuthService);
	const user = await svc.verifyCredentials(creds.email, creds.password);
	if (!user) {
		ctx.response.status(401).json({ ok: false, error: "Invalid credentials" });
		return;
	}
	if (!ctx.session) {
		ctx.response.status(500).json({ ok: false, error: "no session" });
		return;
	}
	ctx.session.regenerate();
	ctx.session.put(SESSION_KEY, user.id);
	ctx.response.json({ ok: true, user: { id: user.id, email: user.email } });
});

// POST /logout — drop the session user.
router.post("/logout", async (ctx) => {
	ctx.session?.forget(SESSION_KEY);
	ctx.response.json({ ok: true });
});

// GET /download/:id — SESSION-guarded. No Bearer: the cookie rides the request
// automatically, so `ctx.auth.user` identifies the downloader. This is the
// behaviour that JWT-Bearer can't give a plain link.
router
	.get("/download/:id", async (ctx) => {
		const userId = ctx.auth?.user?.id ?? "anonymous";
		const fileId = ctx.request.param("id");
		ctx.response.header("content-type", "text/plain; charset=utf-8");
		ctx.response.header(
			"content-disposition",
			`attachment; filename="doc-${fileId}.txt"`,
		);
		ctx.response.send(`Document ${fileId} downloaded by user ${userId}\n`);
	})
	.guard("session");
