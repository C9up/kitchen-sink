import { BaseEntity, BelongsTo, Column, Entity, PrimaryKey } from "@c9up/atlas";
import { User } from "#modules/auth/entities/User.js";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";
import { Task } from "#modules/task/entities/Task.js";

/**
 * File attached to a task. Content lives in `archive` storage (local FS
 * driver by default, S3 in prod) under `storageKey`; the DB row only
 * carries metadata.
 *
 * `size` is the byte count from upload — capped by the validator at
 * 10MB. `contentType` is the client-declared MIME (untrusted, but kept
 * for content disposition); the actual sniff happens at download
 * boundary if needed.
 */
@Entity("attachments")
export class Attachment extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare taskId: string;
	@Column() declare uploadedById: string;
	@Column() declare filename: string;
	@Column() declare contentType: string;
	@Column() declare size: number;
	@Column() declare storageKey: string;
	@Column(dateColumn) declare createdAt: Date;

	@BelongsTo(() => Task) declare task: Task;
	@BelongsTo(() => User, { foreignKey: "uploadedById" }) declare uploadedBy: User;
}
