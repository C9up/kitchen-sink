import { type AsyncDatabaseConnection, BaseRepository } from "@c9up/atlas";
import type { Blackhole } from "@c9up/blackhole";
import { BLACKHOLE_KEY } from "@c9up/blackhole/provider";
import { inject, Inject } from "@c9up/ream";
import { TaskService } from "#modules/task/services/TaskService.js";
import { Comment } from "../entities/Comment.js";

@inject()
export class CommentService {
	readonly comments: BaseRepository<Comment>;

	constructor(
		@Inject("db") db: AsyncDatabaseConnection,
		@Inject(BLACKHOLE_KEY) private readonly blackhole: Blackhole,
		@Inject(TaskService) private readonly tasks: TaskService,
	) {
		this.comments = new BaseRepository(Comment, db);
	}

	async create(input: {
		taskId: string;
		authorId: string;
		body: string;
	}): Promise<Comment> {
		// Sanitise BEFORE the row lands in DB. The global
		// blackholeMiddleware runs on outbound HTML responses too, but
		// scrubbing inbound user content means a stored XSS can't slip
		// through any other read path (api, CLI export, audit log).
		const safeBody = this.blackhole.sanitizeResponse(input.body, "text/html");
		const created = await this.comments.create({
			taskId: input.taskId,
			authorId: input.authorId,
			body: safeBody,
			createdAt: new Date(),
		});
		const comment = await this.comments.findOrFail(created.id);
		// Emit the domain event with a short excerpt so listeners don't
		// re-hit the DB for the notification preview.
		await this.tasks.emitCommentAdded({
			commentId: comment.id,
			taskId: comment.taskId,
			authorId: comment.authorId,
			bodyExcerpt: safeBody.slice(0, 140),
		});
		return comment;
	}

	async listForTask(taskId: string): Promise<Comment[]> {
		return this.comments.where("taskId", taskId);
	}
}
