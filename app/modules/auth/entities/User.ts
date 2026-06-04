import { BaseEntity, Column, Entity, PrimaryKey, SoftDeletes } from "@c9up/atlas";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";

/**
 * Application user. Soft-deleted so de-activation preserves authored
 * comments / audit-log entries without losing referential integrity.
 *
 * `passwordHash` always holds an argon2id PHC string (`$argon2id$...`).
 * Plaintext passwords NEVER cross the entity boundary — hashing happens
 * inside `AuthService.signup`.
 *
 * Back-references (memberships, projects, etc.) are intentionally not
 * declared here — queries originate from the join side (Membership →
 * User via @BelongsTo) which avoids a Workspace ↔ Membership ↔ User
 * import cycle that the typescript `design:type` metadata emit can't
 * resolve without partial module initialization errors.
 */
@Entity("users")
@SoftDeletes()
export class User extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare email: string;
	@Column() declare passwordHash: string;
	@Column() declare displayName: string;
	@Column() declare locale: "fr" | "en";
	@Column(dateColumn) declare createdAt: Date;
	@Column(dateColumn) declare updatedAt: Date;
}
