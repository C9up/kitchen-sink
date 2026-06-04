import type { HttpContext } from "@c9up/ream";
import app from "@c9up/ream/services/app";
import { ProjectService } from "#modules/project/services/ProjectService.js";
import { TaskService } from "#modules/task/services/TaskService.js";
import { AttachmentService } from "../services/AttachmentService.js";
import { CreateAttachmentValidator } from "../validators/CreateAttachmentValidator.js";

export default class AttachmentController {
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

		const parsed = CreateAttachmentValidator.validate(
			(await request.body()) ?? {},
		);
		if (!parsed.valid) {
			response.status(422).json({ ok: false, errors: parsed.errors });
			return;
		}
		const svc = app.container.make<AttachmentService>(AttachmentService);
		const attachment = await svc.upload({
			taskId,
			uploadedById: callerId,
			filename: parsed.data.filename,
			contentType: parsed.data.contentType,
			contentBase64: parsed.data.contentBase64,
		});
		response.status(201).json({
			ok: true,
			attachment: shape(attachment),
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
		const svc = app.container.make<AttachmentService>(AttachmentService);
		const attachments = await svc.listForTask(taskId);
		response.json({ ok: true, attachments: attachments.map(shape) });
	}

	async download({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const id = request.param("id");
		if (typeof id !== "string") {
			response.status(400).json({ ok: false, error: "id missing" });
			return;
		}
		const svc = app.container.make<AttachmentService>(AttachmentService);
		const attachment = await svc.find(id);
		if (!attachment) {
			response.status(404).json({ ok: false, error: "attachment not found" });
			return;
		}
		const taskSvc = app.container.make<TaskService>(TaskService);
		const task = await taskSvc.find(attachment.taskId);
		if (!task) {
			response.status(404).json({ ok: false, error: "attachment task gone" });
			return;
		}
		const projectSvc = app.container.make<ProjectService>(ProjectService);
		if (!(await projectSvc.canAccess(task.projectId, callerId))) {
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}
		const data = await svc.download(attachment);
		if (!data) {
			response.status(404).json({ ok: false, error: "blob missing" });
			return;
		}
		// Returning base64 in JSON keeps the surface symmetric with upload.
		// A binary stream path can be wired once Helix's TestClient supports
		// streaming responses.
		response.json({
			ok: true,
			filename: attachment.filename,
			contentType: attachment.contentType,
			size: attachment.size,
			contentBase64: data.toString("base64"),
		});
	}
}

function shape(attachment: {
	id: string;
	taskId: string;
	uploadedById: string;
	filename: string;
	contentType: string;
	size: number;
	createdAt: Date;
}): Record<string, unknown> {
	return {
		id: attachment.id,
		taskId: attachment.taskId,
		uploadedById: attachment.uploadedById,
		filename: attachment.filename,
		contentType: attachment.contentType,
		size: attachment.size,
		createdAt: attachment.createdAt.toISOString(),
	};
}
