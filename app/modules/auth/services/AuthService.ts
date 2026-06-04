import { type AsyncDatabaseConnection, BaseRepository } from "@c9up/atlas";
import { inject, Inject } from "@c9up/ream";
import { Hash } from "@c9up/sigil";
import { User } from "../entities/User.js";

/**
 * AuthService — single owner of user-credential I/O.
 *
 * Keeps password hashing, email lookup, and identity projection in one
 * place so:
 *   1. controllers never see plaintext past the request boundary,
 *   2. `config/auth.ts` (which warden reads at boot) can delegate the
 *      JWT strategy's `findUser` / `verifyCredentials` callbacks to the
 *      same object the signup route uses — no risk of "signup writes one
 *      shape, login expects another".
 *
 * Resolved through the IoC container so warden's config-time callbacks
 * (lazily evaluated at request time) can grab the same instance the
 * controllers use.
 */
@inject()
export class AuthService {
	readonly users: BaseRepository<User>;

	constructor(
		@Inject("db") db: AsyncDatabaseConnection,
		@Inject(Hash) private readonly hasher: Hash,
	) {
		this.users = new BaseRepository(User, db);
	}

	async signup(input: {
		email: string;
		password: string;
		displayName: string;
		locale: "fr" | "en";
	}): Promise<User> {
		// Hash with the configured driver (argon2id by default — see
		// SigilProvider). Plain-text never persists.
		const passwordHash = await this.hasher.make(input.password);
		const now = new Date();
		return this.users.create({
			email: input.email.toLowerCase(),
			passwordHash,
			displayName: input.displayName,
			locale: input.locale,
			createdAt: now,
			updatedAt: now,
		});
	}

	async findByEmail(email: string): Promise<User | null> {
		return this.users.findBy("email", email.toLowerCase());
	}

	async findById(id: string): Promise<User | null> {
		return this.users.find(id);
	}

	/**
	 * Returns the matching user if the password is correct, `null`
	 * otherwise. The caller MUST NOT distinguish "no user with that
	 * email" from "wrong password" in the response body — both surface
	 * as 401 so the API doesn't leak account existence.
	 */
	async verifyCredentials(
		email: string,
		password: string,
	): Promise<User | null> {
		const user = await this.findByEmail(email);
		if (!user) return null;
		const ok = await this.hasher.verify(password, user.passwordHash);
		return ok ? user : null;
	}
}
