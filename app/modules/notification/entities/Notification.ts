import { BaseEntity, BelongsTo, Column, Entity, PrimaryKey } from "@c9up/atlas";
import { User } from "#modules/auth/entities/User.js";
import { dateColumn } from "#modules/shared/entities/columnAdapters.js";

export type NotificationType = "task.assigned" | "task.commented" | "task.completed";

/**
 * In-app notification row, written by the bay job handler when a
 * domain event fans out. `payload` is a serialised JSON object whose
 * shape depends on `type` (e.g. `{ taskId, projectId, byUserId }`).
 *
 * `readAt = null` means unread. Marking read just sets the column —
 * we never delete notifications so they remain auditable.
 */
@Entity("notifications")
export class Notification extends BaseEntity {
	@PrimaryKey({ generated: "uuid" }) declare id: string;
	@Column() declare userId: string;
	@Column() declare type: NotificationType;
	@Column() declare payload: string;
	@Column(dateColumn) declare readAt: Date | null;
	@Column(dateColumn) declare createdAt: Date;

	@BelongsTo(() => User) declare user: User;
}
