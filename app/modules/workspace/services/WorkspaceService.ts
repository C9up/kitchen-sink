import { randomBytes } from "node:crypto";
import {
	type AsyncDatabaseConnection,
	BaseRepository,
	transaction,
} from "@c9up/atlas";
import { CacheManager } from "@c9up/echo";
import { inject, Inject } from "@c9up/ream";
import { Invitation } from "../entities/Invitation.js";
import { Membership, type WorkspaceRole } from "../entities/Membership.js";
import { Workspace } from "../entities/Workspace.js";

/** Cheap slugifier — ASCII letters/digits + hyphen, lower-cased. */
function slugify(name: string): string {
	const base = name
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
	return base || "workspace";
}

/** Invitation token TTL — 7 days. Chronos-managed in phase 2 (durations + parsing). */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@inject()
export class WorkspaceService {
	readonly workspaces: BaseRepository<Workspace>;
	readonly memberships: BaseRepository<Membership>;
	readonly invitations: BaseRepository<Invitation>;
	/** 30s TTL on the per-(workspace,user) membership cache. Set short
	 *  enough that role downgrades take effect within a single page load
	 *  but long enough that the request hot path saves a DB round-trip. */
	#membershipCacheTtl = 30;

	constructor(
		@Inject("db") private readonly db: AsyncDatabaseConnection,
		@Inject(CacheManager) private readonly cache: CacheManager,
	) {
		this.workspaces = new BaseRepository(Workspace, db);
		this.memberships = new BaseRepository(Membership, db);
		this.invitations = new BaseRepository(Invitation, db);
	}

	#membershipKey(workspaceId: string, userId: string): string {
		return `ms:${workspaceId}:${userId}`;
	}

	/** Drop the cached membership row — call whenever the underlying
	 *  membership is created, updated, or revoked so the cache can't
	 *  serve a stale role. */
	async #invalidateMembership(workspaceId: string, userId: string): Promise<void> {
		await this.cache.delete(this.#membershipKey(workspaceId, userId));
	}

	/**
	 * Create a workspace + the owner's `role=owner` membership in ONE
	 * transaction. Without the transaction, a crash between the two
	 * inserts would leave an ownerless workspace that no one can act
	 * on — atlas's `transaction()` helper rolls back both INSERTs if
	 * the second fails.
	 *
	 * Slug uniqueness collisions retry with a `-2`, `-3`, … suffix. The
	 * `users_email_unique` analog at DB level is `workspaces_slug_unique`,
	 * so the retry loop reads the index error and steps the suffix.
	 */
	async create(ownerId: string, name: string): Promise<Workspace> {
		return transaction(this.db, async (trx) => {
			const workspaces = new BaseRepository(Workspace, trx);
			const memberships = new BaseRepository(Membership, trx);

			let slug = slugify(name);
			let suffix = 1;
			while (await workspaces.findBy("slug", slug)) {
				suffix++;
				slug = `${slugify(name)}-${suffix}`;
			}

			const now = new Date();
			const workspace = await workspaces.create({
				name,
				slug,
				ownerId,
				createdAt: now,
				updatedAt: now,
			});
			await memberships.create({
				workspaceId: workspace.id,
				userId: ownerId,
				role: "owner",
				joinedAt: now,
			});
			// Pre-warm + override any stale negative entry that an earlier
			// /workspaces probe (returning "no membership") may have left.
			await this.#invalidateMembership(workspace.id, ownerId);
			return workspace;
		});
	}

	async listForUser(
		userId: string,
	): Promise<Array<{ workspace: Workspace; role: WorkspaceRole }>> {
		const memberships = await this.memberships.where("userId", userId);
		const result: Array<{ workspace: Workspace; role: WorkspaceRole }> = [];
		for (const m of memberships) {
			const w = await this.workspaces.find(m.workspaceId);
			if (w) result.push({ workspace: w, role: m.role });
		}
		return result;
	}

	async findById(id: string): Promise<Workspace | null> {
		return this.workspaces.find(id);
	}

	async findBySlug(slug: string): Promise<Workspace | null> {
		return this.workspaces.findBy("slug", slug);
	}

	async getMembership(
		workspaceId: string,
		userId: string,
	): Promise<Membership | null> {
		// Permission lookups land on every authenticated request inside a
		// workspace, so a tight TTL cache on (workspaceId, userId) avoids
		// turning each authz check into a SELECT. Echo's MemoryDriver
		// keeps it process-local; production would swap a Redis driver
		// in via the same CacheManager interface — no service change.
		const key = this.#membershipKey(workspaceId, userId);
		const cached = await this.cache.get<{
			id: string;
			workspaceId: string;
			userId: string;
			role: WorkspaceRole;
			joinedAt: string;
		} | "miss">(key);
		if (cached === "miss") return null;
		if (cached) {
			const m = new Membership();
			m.setProp("id", cached.id);
			m.setProp("workspaceId", cached.workspaceId);
			m.setProp("userId", cached.userId);
			m.setProp("role", cached.role);
			m.setProp("joinedAt", new Date(cached.joinedAt));
			return m;
		}
		const rows = await this.memberships.where("workspaceId", workspaceId);
		const found = rows.find((m) => m.userId === userId) ?? null;
		if (found) {
			await this.cache.set(
				key,
				{
					id: found.id,
					workspaceId: found.workspaceId,
					userId: found.userId,
					role: found.role,
					joinedAt: found.joinedAt.toISOString(),
				},
				this.#membershipCacheTtl,
			);
		} else {
			// Cache the negative answer too so a repeated permission probe
			// from a non-member doesn't keep hitting the DB. Use the
			// sentinel string "miss" — `cache.set(null)` is rejected by
			// echo (`null`/`undefined` not cacheable).
			await this.cache.set(key, "miss", this.#membershipCacheTtl);
		}
		return found;
	}

	/**
	 * Generate an invitation. The token is 64 hex chars (32 random bytes
	 * — comfortably collision-resistant), unique-indexed at DB level. We
	 * never re-issue an existing-but-unaccepted invite; the caller can
	 * fetch + reuse the prior one via the workspace's invitation list
	 * if it doesn't want to spam fresh tokens.
	 */
	async invite(
		workspaceId: string,
		email: string,
		role: "admin" | "member",
	): Promise<Invitation> {
		const token = randomBytes(32).toString("hex");
		const now = new Date();
		const created = await this.invitations.create({
			workspaceId,
			email: email.toLowerCase(),
			token,
			role,
			expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
			acceptedAt: null,
			createdAt: now,
		});
		// Re-read so the `@Column(dateColumn)` consume adapter converts the
		// DB-returned timestamps back to JS Dates. atlas's `#insert` path
		// applies the RETURNING row directly to the entity without invoking
		// the consume callbacks, so without this re-find downstream
		// `.toISOString()` calls crash on string-typed `expiresAt`.
		return this.invitations.findOrFail(created.id);
	}

	/**
	 * Redeem a pending invitation. Validates the token, the expiry, and
	 * the not-already-accepted state, then atomically marks the
	 * invitation as accepted AND creates the user's membership. The
	 * caller pre-resolves `userId` (typically `ctx.auth.user.id`); this
	 * service stays unaware of how the request was authenticated.
	 */
	async acceptInvitation(
		token: string,
		userId: string,
	): Promise<{ workspace: Workspace; membership: Membership }> {
		const invitation = await this.invitations.findBy("token", token);
		if (!invitation) throw new Error("INVITATION_NOT_FOUND");
		if (invitation.acceptedAt) throw new Error("INVITATION_ALREADY_USED");
		if (invitation.expiresAt.getTime() < Date.now()) {
			throw new Error("INVITATION_EXPIRED");
		}

		return transaction(this.db, async (trx) => {
			const invitations = new BaseRepository(Invitation, trx);
			const memberships = new BaseRepository(Membership, trx);
			const workspaces = new BaseRepository(Workspace, trx);

			const fresh = await invitations.findOrFail(invitation.id);
			fresh.acceptedAt = new Date();
			// BaseEntity has no `.save()` — persistence goes through the
			// repository so the dirty-column UPDATE pathway runs.
			await invitations.save(fresh);

			const membership = await memberships.create({
				workspaceId: invitation.workspaceId,
				userId,
				role: invitation.role,
				joinedAt: new Date(),
			});
			await this.#invalidateMembership(invitation.workspaceId, userId);

			const workspace = await workspaces.findOrFail(invitation.workspaceId);
			return { workspace, membership };
		});
	}
}
