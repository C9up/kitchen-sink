import type { HttpContext } from "@c9up/ream";
import app from "@c9up/ream/services/app";
import { ProjectService } from "#modules/project/services/ProjectService.js";
import { TaskService } from "#modules/task/services/TaskService.js";
import { CommentService } from "../services/CommentService.js";
import { CreateCommentValidator } from "../validators/CreateCommentValidator.js";

export default class CommentController {
	async create({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const taskId = request.param("id");
		if (typeof taskId !== "string") {
			response.status(400).json({ ok: false, error: "task id missing" });
			return;
		}

		const taskSvc = app.container.make<TaskService>(TaskService);
		const task = await taskSvc.find(taskId);
		if (!task) {
			response.status(404).json({ ok: false, error: "task not found" });
			return;
		}
		const projectSvc = app.container.make<ProjectService>(ProjectService);
		if (!(await projectSvc.canAccess(task.projectId, callerId))) {
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}

		const parsed = CreateCommentValidator.validate((await request.body()) ?? {});
		if (!parsed.valid) {
			response.status(422).json({ ok: false, errors: parsed.errors });
			return;
		}
		const svc = app.container.make<CommentService>(CommentService);
		const comment = await svc.create({
			taskId,
			authorId: callerId,
			body: parsed.data.body,
		});
		response.status(201).json({
			ok: true,
			comment: {
				id: comment.id,
				taskId: comment.taskId,
				authorId: comment.authorId,
				body: comment.body,
				createdAt: comment.createdAt.toISOString(),
			},
		});
	}

	async list({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const taskId = request.param("id");
		if (typeof taskId !== "string") {
			response.status(400).json({ ok: false, error: "task id missing" });
			return;
		}
		const taskSvc = app.container.make<TaskService>(TaskService);
		const task = await taskSvc.find(taskId);
		if (!task) {
			response.status(404).json({ ok: false, error: "task not found" });
			return;
		}
		const projectSvc = app.container.make<ProjectService>(ProjectService);
		if (!(await projectSvc.canAccess(task.projectId, callerId))) {
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}
		const svc = app.container.make<CommentService>(CommentService);
		const comments = await svc.listForTask(taskId);
		response.json({
			ok: true,
			comments: comments.map((c) => ({
				id: c.id,
				taskId: c.taskId,
				authorId: c.authorId,
				body: c.body,
				createdAt: c.createdAt.toISOString(),
			})),
		});
	}
}
