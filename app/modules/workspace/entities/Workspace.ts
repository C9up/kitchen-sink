import { BaseEntity, BelongsTo, Column, Entity, PrimaryKey } from "@c9up/atlas";
import { User } from "#modules/auth/entities/User.js";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";

/**
 * Workspace = collaboration boundary. Every membership, project, task,
 * audit log row, etc. lives under exactly one workspace. The owner is
 * the user who created it and is always granted a `role=owner`
 * membership at creation (see WorkspaceService.create).
 *
 * `slug` is URL-friendly + globally unique so we can mount
 * `/workspaces/:slug` later for public project pages (phase 3) without
 * leaking integer IDs.
 *
 * Back-references to Membership / Invitation live on the join side
 * (BelongsTo), not here, to keep the import graph acyclic.
 */
@Entity("workspaces")
export class Workspace extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare name: string;
	@Column() declare slug: string;
	@Column() declare ownerId: string;
	@Column(dateColumn) declare createdAt: Date;
	@Column(dateColumn) declare updatedAt: Date;

	@BelongsTo(() => User, { foreignKey: "ownerId" }) declare owner: User;
}
