import { BaseEntity, BelongsTo, Column, Entity, PrimaryKey } from "@c9up/atlas";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";
import { Workspace } from "./Workspace.js";
import type { WorkspaceRole } from "./Membership.js";

/**
 * Pending invitation: the addressed email is not yet (or possibly never)
 * a `User`. We persist `token` (URL-safe random hex from sigil) + the
 * target `role` and `expiresAt` so the accept flow can land it as a
 * `Membership` even if the recipient signs up days later.
 *
 * `acceptedAt = null` means still valid (subject to `expiresAt`); once
 * set, the row stays for audit purposes and is no longer redeemable.
 */
@Entity("invitations")
export class Invitation extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare workspaceId: string;
	@Column() declare email: string;
	@Column() declare token: string;
	@Column() declare role: WorkspaceRole;
	@Column(dateColumn) declare expiresAt: Date;
	@Column(dateColumn) declare acceptedAt: Date | null;
	@Column(dateColumn) declare createdAt: Date;

	@BelongsTo(() => Workspace) declare workspace: Workspace;
}
