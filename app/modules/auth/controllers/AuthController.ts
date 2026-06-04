import type { HttpContext } from "@c9up/ream";
import app from "@c9up/ream/services/app";
import { JwtStrategy } from "@c9up/warden";
import auth from "@c9up/warden/services/main";
import { AuthService } from "../services/AuthService.js";
import { LoginValidator } from "../validators/LoginValidator.js";
import { SignupValidator } from "../validators/SignupValidator.js";

/**
 * Routes: POST /auth/signup, POST /auth/login, POST /auth/logout, GET /me.
 *
 * Signup hashes via sigil + creates the user via atlas + issues a JWT
 * via warden — three packages on one HTTP boundary. Logout pushes the
 * presented token's `jti` into the TokenBlacklist so subsequent verify
 * calls reject it for the remainder of its lifetime.
 */
export default class AuthController {
	async signup({ request, response }: HttpContext) {
		const body = (await request.body()) ?? {};
		const parsed = SignupValidator.validate(body);
		if (!parsed.valid) {
			response.status(422).json({ ok: false, errors: parsed.errors });
			return;
		}

		const svc = app.container.make<AuthService>(AuthService);
		// Email uniqueness is enforced by the `users_email_unique`
		// migration index. Pre-check first so the failure surface is a
		// clean 409 instead of a wrapped DB-constraint error.
		const existing = await svc.findByEmail(parsed.data.email);
		if (existing) {
			response.status(409).json({ ok: false, error: "Email already in use" });
			return;
		}
		const user = await svc.signup(parsed.data);

		const result = await auth.authenticate({
			email: parsed.data.email,
			password: parsed.data.password,
		});
		if (!result.authenticated || !result.user) {
			// Theoretical: signup just succeeded so credentials are
			// guaranteed to verify. If we ever reach this branch the JWT
			// signing path is misconfigured — surface as 500 with the
			// strategy's own error string for debugging.
			response.status(500).json({ ok: false, error: result.error ?? "Unknown" });
			return;
		}
		response.status(201).json({
			ok: true,
			user: { id: user.id, email: user.email, displayName: user.displayName },
			token: result.user.token,
		});
	}

	async login({ request, response }: HttpContext) {
		const body = (await request.body()) ?? {};
		const parsed = LoginValidator.validate(body);
		if (!parsed.valid) {
			// Same 401 used for bad credentials — never reveal whether
			// the request failed format or credentials match.
			response.status(401).json({ ok: false, error: "Invalid credentials" });
			return;
		}
		const result = await auth.authenticate(parsed.data);
		if (!result.authenticated || !result.user) {
			response.status(401).json({ ok: false, error: "Invalid credentials" });
			return;
		}
		response.json({
			ok: true,
			user: {
				id: result.user.id,
				email: result.user.email,
				displayName: result.user.displayName,
			},
			token: result.user.token,
		});
	}

	async logout({ request, response }: HttpContext) {
		const header = request.header("authorization") ?? "";
		const token = header.startsWith("Bearer ") ? header.slice(7) : null;
		if (!token) {
			response.status(401).json({ ok: false, error: "Missing bearer token" });
			return;
		}
		// Pull JwtStrategy directly — revoke() is strategy-specific, not
		// part of the AuthManager surface. The container resolves the same
		// singleton the manager dispatches to, so the blacklist is shared.
		const jwt = app.container.make<JwtStrategy>(JwtStrategy);
		const revoked = await jwt.revoke(token);
		response.json({ ok: true, revoked });
	}

	async me({ request, response }: HttpContext) {
		const header = request.header("authorization") ?? "";
		const token = header.startsWith("Bearer ") ? header.slice(7) : null;
		if (!token) {
			response.status(401).json({ ok: false, error: "Missing bearer token" });
			return;
		}
		const result = await auth.verify(token);
		if (!result.authenticated || !result.user) {
			response.status(401).json({ ok: false, error: result.error ?? "Invalid token" });
			return;
		}
		response.json({
			ok: true,
			user: {
				id: result.user.id,
				email: result.user.email,
				displayName: result.user.displayName,
			},
		});
	}
}
