import { BaseEntity, BelongsTo, Column, Entity, PrimaryKey, SoftDeletes } from "@c9up/atlas";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";
import { Workspace } from "#modules/workspace/entities/Workspace.js";

/**
 * A project is a bag of tasks within a workspace. Soft-deleted because
 * archival projects keep their tasks/comments around for audit + the
 * notification feed still references them.
 *
 * `visibility = 'public'` exposes `/workspaces/:wsSlug/projects/:slug`
 * to anonymous visitors with rosetta-translated descriptions; `private`
 * gates access behind workspace membership.
 *
 * `descriptions` is a serialized JSON dict keyed by locale (`{ fr, en }`).
 * Stored as text — read by ProjectService which parses + falls back to
 * the workspace's default locale when a key is missing.
 */
export type ProjectVisibility = "public" | "private";

@Entity("projects")
@SoftDeletes()
export class Project extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare workspaceId: string;
	@Column() declare name: string;
	@Column() declare slug: string;
	@Column() declare visibility: ProjectVisibility;
	@Column() declare descriptions: string;
	@Column(dateColumn) declare createdAt: Date;
	@Column(dateColumn) declare updatedAt: Date;

	@BelongsTo(() => Workspace) declare workspace: Workspace;
}
