import type { JobHandler } from "@c9up/bay";
import { Nova } from "@c9up/nova";
import { Mail } from "@c9up/rover";
import { inject, Inject } from "@c9up/ream";
import { Logger } from "@c9up/spectrum";
import { User } from "#modules/auth/entities/User.js";
import { BaseRepository } from "@c9up/atlas";
import type { AsyncDatabaseConnection } from "@c9up/atlas";
import { Task } from "#modules/task/entities/Task.js";
import { NotificationService } from "../services/NotificationService.js";

export interface NotifyAssigneePayload {
	taskId: string;
	projectId: string;
	assigneeId: string;
	byUserId: string;
}

function isPayload(v: unknown): v is NotifyAssigneePayload {
	return (
		typeof v === "object" &&
		v !== null &&
		typeof (v as { taskId?: unknown }).taskId === "string" &&
		typeof (v as { assigneeId?: unknown }).assigneeId === "string"
	);
}

/**
 * Bay job handler that fans out a task-assigned event to three
 * delivery channels:
 *   1. an in-app `Notification` row (atlas write),
 *   2. an email to the assignee (rover, log transport in this demo),
 *   3. a Web Push notification (nova, no-op when the user has no
 *      registered subscription — exercises the wiring nonetheless).
 *
 * Job processing is on-demand: tests call `queue.processOne()` between
 * actions. A production deployment would run the worker loop in its
 * own process; for the demo the request-scoped dispatch + same-process
 * processing keeps everything visible to assertions.
 */
@inject()
export class NotifyAssigneeJob implements JobHandler {
	readonly users: BaseRepository<User>;
	readonly tasks: BaseRepository<Task>;

	constructor(
		@Inject("db") db: AsyncDatabaseConnection,
		@Inject(NotificationService) private readonly notifications: NotificationService,
		@Inject(Mail) private readonly mail: Mail,
		@Inject("nova") private readonly nova: Nova,
		@Inject(Logger) private readonly logger: Logger,
	) {
		this.users = new BaseRepository(User, db);
		this.tasks = new BaseRepository(Task, db);
	}

	async handle(payload: unknown): Promise<void> {
		if (!isPayload(payload)) {
			this.logger.warn("[notify-assignee] dropping malformed payload");
			return;
		}
		const { taskId, assigneeId, byUserId } = payload;
		const [task, assignee, actor] = await Promise.all([
			this.tasks.find(taskId),
			this.users.find(assigneeId),
			this.users.find(byUserId),
		]);
		if (!task || !assignee) {
			this.logger.warn(`[notify-assignee] task or assignee missing for ${taskId}`);
			return;
		}

		// 1) In-app notification row.
		await this.notifications.createForUser(assigneeId, "task.assigned", {
			taskId,
			projectId: payload.projectId,
			title: task.title,
			byUserId,
			byDisplayName: actor?.displayName ?? "Unknown",
		});

		// 2) Email through rover. The log transport prints the payload to
		// stderr in dev; production swaps in SMTP via the same Mail surface.
		const assigner = actor?.displayName ?? "Someone";
		await this.mail.send((m) => {
			m.to(assignee.email).subject(`You were assigned: ${task.title}`).text(
				`${assigner} assigned the task "${task.title}" to you.\n\n` +
					`Open the project to see details.`,
			);
		});

		// 3) Web Push fan-out. `pushToUser` returns `[]` for users without
		// registered subscriptions — no VAPID validation is triggered in
		// that case, so the demo skips the configure-VAPID dance and
		// still exercises the nova surface end-to-end.
		try {
			await this.nova.pushToUser(assigneeId, {
				title: "New task assigned",
				body: task.title,
				data: { taskId },
			});
		} catch (err) {
			this.logger.warn(
				`[notify-assignee] nova push skipped: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
