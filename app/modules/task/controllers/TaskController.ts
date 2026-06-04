import type { HttpContext } from "@c9up/ream";
import app from "@c9up/ream/services/app";
import { ProjectService } from "#modules/project/services/ProjectService.js";
import type { TaskStatus } from "../entities/Task.js";
import { TaskService } from "../services/TaskService.js";
import { CreateTaskValidator } from "../validators/CreateTaskValidator.js";
import { UpdateTaskValidator } from "../validators/UpdateTaskValidator.js";

/**
 * Routes guarded by `.guard('jwt')` in routes.ts — `ctx.auth.user.id`
 * is guaranteed to be set by the time these handlers run (the guard
 * middleware throws E_UNAUTHORIZED otherwise). Project access is
 * checked via `ProjectService.canAccess`.
 */
export default class TaskController {
	async create({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;

		const projectId = request.param("projectId");
		if (typeof projectId !== "string") {
			response.status(400).json({ ok: false, error: "projectId missing" });
			return;
		}
		const projectSvc = app.container.make<ProjectService>(ProjectService);
		if (!(await projectSvc.canAccess(projectId, callerId))) {
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}

		const body = (await request.body()) ?? {};
		const parsed = CreateTaskValidator.validate(body);
		if (!parsed.valid) {
			response.status(422).json({ ok: false, errors: parsed.errors });
			return;
		}
		const svc = app.container.make<TaskService>(TaskService);
		try {
			const task = await svc.create(
				{
					projectId,
					title: parsed.data.title,
					description: parsed.data.description,
					priority: parsed.data.priority,
					assigneeId: parsed.data.assigneeId,
					dueAt: parsed.data.dueAt,
					recurrenceRrule: parsed.data.recurrenceRrule,
				},
				callerId,
			);
			response.status(201).json({ ok: true, task: shape(task) });
		} catch (err) {
			// RRULE / dueAt invalid date — surface as 422 instead of 500
			// so the client can fix the input.
			response.status(422).json({
				ok: false,
				error: err instanceof Error ? err.message : "invalid input",
			});
		}
	}

	async list({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;

		const projectId = request.param("projectId");
		if (typeof projectId !== "string") {
			response.status(400).json({ ok: false, error: "projectId missing" });
			return;
		}
		const projectSvc = app.container.make<ProjectService>(ProjectService);
		if (!(await projectSvc.canAccess(projectId, callerId))) {
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}

		const statusRaw = readQueryParam(request, "status");
		const status: TaskStatus | undefined =
			statusRaw === "todo" || statusRaw === "doing" || statusRaw === "done"
				? statusRaw
				: undefined;

		const svc = app.container.make<TaskService>(TaskService);
		const tasks = await svc.list(projectId, { status });
		response.json({ ok: true, tasks: tasks.map(shape) });
	}

	async update({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;

		const id = request.param("id");
		if (typeof id !== "string") {
			response.status(400).json({ ok: false, error: "id missing" });
			return;
		}

		const svc = app.container.make<TaskService>(TaskService);
		const existing = await svc.find(id);
		if (!existing) {
			response.status(404).json({ ok: false, error: "task not found" });
			return;
		}
		const projectSvc = app.container.make<ProjectService>(ProjectService);
		if (!(await projectSvc.canAccess(existing.projectId, callerId))) {
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}

		const parsed = UpdateTaskValidator.validate((await request.body()) ?? {});
		if (!parsed.valid) {
			response.status(422).json({ ok: false, errors: parsed.errors });
			return;
		}
		const updated = await svc.update(id, parsed.data, callerId);
		if (!updated) {
			response.status(404).json({ ok: false, error: "task not found" });
			return;
		}
		response.json({ ok: true, task: shape(updated) });
	}
}

function shape(task: {
	id: string;
	projectId: string;
	title: string;
	description: string;
	status: string;
	priority: string;
	assigneeId: string | null;
	dueAt: Date | null;
	recurrenceRrule: string | null;
	completedAt: Date | null;
}): Record<string, unknown> {
	return {
		id: task.id,
		projectId: task.projectId,
		title: task.title,
		description: task.description,
		status: task.status,
		priority: task.priority,
		assigneeId: task.assigneeId,
		dueAt: task.dueAt ? task.dueAt.toISOString() : null,
		recurrenceRrule: task.recurrenceRrule,
		completedAt: task.completedAt ? task.completedAt.toISOString() : null,
	};
}

function readQueryParam(
	request: HttpContext["request"],
	name: string,
): string | undefined {
	const qs = (request as { qs?: () => Record<string, unknown> }).qs?.();
	if (!qs) return undefined;
	const v = qs[name];
	return typeof v === "string" ? v : undefined;
}
