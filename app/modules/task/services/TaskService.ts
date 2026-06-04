import { type AsyncDatabaseConnection, BaseRepository } from "@c9up/atlas";
import { at, expandRRule } from "@c9up/chronos";
import { inject, Inject } from "@c9up/ream";
import {
	CommentAdded,
	TaskAssigned,
	TaskCompleted,
} from "#modules/notification/events.js";
import { Task, type TaskPriority, type TaskStatus } from "../entities/Task.js";

interface CreateTaskInput {
	projectId: string;
	title: string;
	description?: string;
	priority?: TaskPriority;
	assigneeId?: string | null;
	dueAt?: string | null;
	recurrenceRrule?: string | null;
}

interface UpdateTaskInput {
	title?: string;
	description?: string;
	status?: TaskStatus;
	priority?: TaskPriority;
	assigneeId?: string | null;
	dueAt?: string | null;
}

@inject()
export class TaskService {
	readonly tasks: BaseRepository<Task>;

	constructor(@Inject("db") db: AsyncDatabaseConnection) {
		this.tasks = new BaseRepository(Task, db);
	}

	async create(input: CreateTaskInput, byUserId: string): Promise<Task> {
		// `chronos.at` parses any reasonable ISO-8601 / RFC-3339 / Date
		// input and surfaces invalid inputs early. The repo round-trip
		// then re-hydrates `dueAt` as a JS Date via the column adapter.
		const dueAt = input.dueAt ? at(input.dueAt).toDate() : null;
		// Validate RRULE strings by expanding the first occurrence — if
		// the spec is malformed, `expandRRule` throws now instead of at
		// the first time the scheduler tries to read it.
		if (input.recurrenceRrule) {
			expandRRule(new Date().toISOString(), input.recurrenceRrule, 1);
		}
		const now = new Date();
		const created = await this.tasks.create({
			projectId: input.projectId,
			title: input.title,
			description: input.description ?? "",
			status: "todo" as TaskStatus,
			priority: input.priority ?? ("medium" as TaskPriority),
			assigneeId: input.assigneeId ?? null,
			dueAt,
			recurrenceRrule: input.recurrenceRrule ?? null,
			createdAt: now,
			updatedAt: now,
			completedAt: null,
		});
		const task = await this.tasks.findOrFail(created.id);
		if (task.assigneeId) {
			await new TaskAssigned(
				task.id,
				task.projectId,
				task.assigneeId,
				byUserId,
			).emit();
		}
		return task;
	}

	async list(projectId: string, filters: { status?: TaskStatus } = {}): Promise<Task[]> {
		const all = await this.tasks.where("projectId", projectId);
		if (filters.status) {
			return all.filter((t) => t.status === filters.status);
		}
		return all;
	}

	async find(id: string): Promise<Task | null> {
		return this.tasks.find(id);
	}

	async update(
		id: string,
		input: UpdateTaskInput,
		byUserId: string,
	): Promise<Task | null> {
		const task = await this.tasks.find(id);
		if (!task) return null;

		const prevAssignee = task.assigneeId;
		const prevStatus = task.status;

		if (input.title !== undefined) task.title = input.title;
		if (input.description !== undefined) task.description = input.description;
		if (input.priority !== undefined) task.priority = input.priority;
		if (input.assigneeId !== undefined) task.assigneeId = input.assigneeId;
		if (input.dueAt !== undefined) {
			task.dueAt = input.dueAt ? at(input.dueAt).toDate() : null;
		}
		if (input.status !== undefined) {
			task.status = input.status;
			if (input.status === "done" && prevStatus !== "done") {
				task.completedAt = new Date();
			} else if (input.status !== "done") {
				task.completedAt = null;
			}
		}
		task.updatedAt = new Date();
		await this.tasks.save(task);

		// Emit AFTER the save so listeners querying the row see the new
		// state. Assignment change with a non-null assignee triggers the
		// notification fan-out via events → bay.
		if (
			input.assigneeId !== undefined &&
			task.assigneeId &&
			task.assigneeId !== prevAssignee
		) {
			await new TaskAssigned(
				task.id,
				task.projectId,
				task.assigneeId,
				byUserId,
			).emit();
		}
		if (input.status === "done" && prevStatus !== "done") {
			await new TaskCompleted(task.id, task.projectId, byUserId).emit();
		}
		return task;
	}

	/**
	 * Expose for the comment service so it can emit `CommentAdded` while
	 * knowing the task's project (the listener needs that to scope the
	 * notification feed). Keeping the event construction in one place
	 * means the comment service depends only on TaskService, not on
	 * event-bus internals.
	 */
	async emitCommentAdded(input: {
		commentId: string;
		taskId: string;
		authorId: string;
		bodyExcerpt: string;
	}): Promise<void> {
		const task = await this.tasks.find(input.taskId);
		if (!task) return;
		await new CommentAdded(
			input.commentId,
			input.taskId,
			task.projectId,
			input.authorId,
			input.bodyExcerpt,
		).emit();
	}
}
