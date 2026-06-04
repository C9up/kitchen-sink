import { BaseEntity, BelongsTo, Column, Entity, PrimaryKey } from "@c9up/atlas";
import { User } from "#modules/auth/entities/User.js";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";
import { Workspace } from "./Workspace.js";

export type WorkspaceRole = "owner" | "admin" | "member";

/**
 * Pivot table joining users to workspaces, carrying the user's role
 * inside that workspace. `role` is checked by `WorkspaceGuard` (phase 2)
 * to authorise per-resource actions.
 *
 * Composite uniqueness `(workspaceId, userId)` is enforced by the
 * migration — one user can hold at most one membership per workspace.
 */
@Entity("memberships")
export class Membership extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare workspaceId: string;
	@Column() declare userId: string;
	@Column() declare role: WorkspaceRole;
	@Column(dateColumn) declare joinedAt: Date;

	@BelongsTo(() => Workspace) declare workspace: Workspace;
	@BelongsTo(() => User) declare user: User;
}
