import { type AsyncDatabaseConnection, BaseRepository } from "@c9up/atlas";
import { inject, Inject } from "@c9up/ream";
import { Notification, type NotificationType } from "../entities/Notification.js";

/**
 * Reads + writes against the `notifications` table. The bay job
 * handler is the typical writer; controllers read this for the
 * `/me/notifications` inbox and `mark-as-read` actions.
 */
@inject()
export class NotificationService {
	readonly notifications: BaseRepository<Notification>;

	constructor(@Inject("db") db: AsyncDatabaseConnection) {
		this.notifications = new BaseRepository(Notification, db);
	}

	async createForUser(
		userId: string,
		type: NotificationType,
		payload: Record<string, unknown>,
	): Promise<Notification> {
		// Re-find after create so the date column adapter consumes the
		// DB-returned timestamp into a JS Date (see WorkspaceService for
		// the same workaround comment — atlas's #insert path doesn't
		// invoke consume on the RETURNING row).
		const created = await this.notifications.create({
			userId,
			type,
			payload: JSON.stringify(payload),
			readAt: null,
			createdAt: new Date(),
		});
		return this.notifications.findOrFail(created.id);
	}

	async listForUser(userId: string): Promise<Notification[]> {
		// `repo.where(col, val)` orders by PK DESC which, for UUIDv4
		// (non-monotonic), gives close-enough recency for an inbox.
		// A future phase will switch to a `created_at DESC` query.
		return this.notifications.where("userId", userId);
	}

	async markRead(id: string, userId: string): Promise<Notification | null> {
		const n = await this.notifications.find(id);
		if (!n || n.userId !== userId) return null;
		if (n.readAt) return n;
		n.readAt = new Date();
		await this.notifications.save(n);
		return n;
	}
}
