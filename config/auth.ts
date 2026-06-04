/**
 * Warden config. The provider reads `config.jwt` structurally — same
 * shape as `JwtStrategyConfig`, so we can pass `blacklist` and
 * `previousSecrets` through here even though the public `WardenConfig`
 * type stops at the basic four fields.
 *
 * The `findUser` / `verifyCredentials` callbacks resolve `AuthService`
 * lazily from the container so the warden provider can be wired BEFORE
 * the atlas provider exposes `"db"` — at request time the container is
 * fully booted and the resolution succeeds.
 */
import app from "@c9up/ream/services/app";
import type { UserPayload } from "@c9up/warden";
import { MemoryBlacklistDriver, TokenBlacklist } from "@c9up/warden";
import { AuthService } from "#modules/auth/services/AuthService.js";
import type { User } from "#modules/auth/entities/User.js";

const jwtSecret =
	process.env.JWT_SECRET ?? "kitchen-sink-dev-secret-32-bytes-minimum!!";
if (jwtSecret.length < 32) {
	throw new Error("JWT_SECRET must be ≥ 32 bytes (set in .env)");
}
// JWT_PREVIOUS_SECRETS allows zero-downtime key rotation: comma-separated
// list of historical secrets that verify-only-accept. Set this BEFORE
// flipping JWT_SECRET to a new value, deploy, then remove on next deploy.
const previousSecrets = (process.env.JWT_PREVIOUS_SECRETS ?? "")
	.split(",")
	.map((s) => s.trim())
	.filter((s) => s.length >= 32);

// Shared blacklist so logout + jti-revoke + warden middleware all read
// from the same set. Memory-driver is fine for a demo; production would
// swap in a Redis driver via the same TokenBlacklist surface.
export const blacklist = new TokenBlacklist(new MemoryBlacklistDriver());

function toPayload(u: User): UserPayload {
	return {
		id: u.id,
		email: u.email,
		displayName: u.displayName,
		roles: [],
		permissions: [],
	};
}

export default {
	defaultStrategy: "jwt",
	jwt: {
		secret: jwtSecret,
		previousSecrets,
		expiresInSeconds: 86400,
		blacklist,
		async findUser(id: string): Promise<UserPayload | null> {
			const svc = app.container.make<AuthService>(AuthService);
			const u = await svc.findById(id);
			return u ? toPayload(u) : null;
		},
		async verifyCredentials(
			email: string,
			password: string,
		): Promise<UserPayload | null> {
			const svc = app.container.make<AuthService>(AuthService);
			const u = await svc.verifyCredentials(email, password);
			return u ? toPayload(u) : null;
		},
	},
};
