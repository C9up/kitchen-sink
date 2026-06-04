/**
 * Boot-time app wiring.
 *
 * Runs in the `preloads` phase, AFTER every provider's `register()` +
 * `boot()` has finished. Each framework package now ships its own
 * provider that builds + binds its manager singleton; the only thing
 * left for the app to do here is:
 *
 *   - register app-specific job handlers against the bay queue
 *   - subscribe event-bus listeners that translate domain events into
 *     queue dispatches + relay broadcasts
 *   - declare relay channel authorizers
 *
 * No `new CacheManager(...)`, `new QueueManager(...)`, or
 * `new Rosetta(...)` — those happen in the providers from config files
 * (`config/cache.ts`, `config/queue.ts`, `config/i18n.ts`).
 */

import queue from "@c9up/bay/services/main";
import emitter from "@c9up/ream/events/services/main";
import app from "@c9up/ream/services/app";
import relay from "@c9up/relay/services/main";
import {
	CommentAdded,
	TaskAssigned,
	TaskCompleted,
} from "#modules/notification/events.js";
import { NotifyAssigneeJob } from "#modules/notification/jobs/NotifyAssigneeJob.js";
import { ProjectService } from "#modules/project/services/ProjectService.js";
import { WorkspaceService } from "#modules/workspace/services/WorkspaceService.js";

// ─── Bay queue — register job handlers ──────────────────────
// Bay instantiates registered classes via `new Handler()` with no args
// (handlers stay constructor-free), so we resolve the handler through
// the IoC container first — `@inject()` deps (db, services, mail, nova,
// logger) come pre-wired. The handler instance, not the class, is
// registered against the queue.
queue.register(
	"notify-assignee",
	app.container.make<NotifyAssigneeJob>(NotifyAssigneeJob),
);

// ─── Events → bay queue ─────────────────────────────────────
// Heavy fan-out work (DB writes, mail send, push call) runs in the
// queue worker so HTTP handlers return as soon as the event is emitted.
// Tests drain the queue explicitly via `processOne()` in the
// notification list endpoint.
emitter.on(TaskAssigned, async (e) => {
	await queue.dispatch("notify-assignee", {
		taskId: e.taskId,
		projectId: e.projectId,
		assigneeId: e.assigneeId,
		byUserId: e.byUserId,
	});
});

emitter.on(CommentAdded, async (e) => {
	// `CommentAdded` could reuse the same job (when the target task
	// has an assignee). The comment service dispatches its own job
	// today; this listener is a placeholder for a `notify-watchers`
	// fan-out phase.
	void e;
});

emitter.on(TaskCompleted, async (e) => {
	// Placeholder: future project-level summary feed + auto-close of
	// related notifications.
	void e;
});

// ─── Events → relay (realtime SSE) ──────────────────────────
// `@c9up/relay/provider` auto-registered `GET /__relay/events`,
// `POST /__relay/subscribe`, and `POST /__relay/unsubscribe`.
// `relay.registerRoutes(...)` is the Adonis-Transmit-shape hook to
// customize those routes — we attach the `jwt` guard so the upstream
// `AuthMiddleware` is required to populate `ctx.auth` before the
// authorizer fires.
relay.registerRoutes((route) => {
	route.guard("jwt");
});

// Channel authorizer: only members of the project's workspace may
// subscribe. The `:id` capture is the project id; we walk
// project → workspace → membership through the container-resolved
// services. Returning `false` produces a 403 with
// `E_CHANNEL_FORBIDDEN` on the subscribe endpoint.
relay.authorize<{ id: string }>("project/:id", async (ctx, { id }) => {
	const userId = ctx.auth?.user?.id;
	if (typeof userId !== "string") return false;
	const projectSvc = app.container.make<ProjectService>(ProjectService);
	const project = await projectSvc.projects.find(id);
	if (!project) return false;
	const wsSvc = app.container.make<WorkspaceService>(WorkspaceService);
	const membership = await wsSvc.getMembership(project.workspaceId, userId);
	return membership !== null;
});

emitter.on(TaskAssigned, async (e) => {
	relay.broadcast(`project/${e.projectId}`, {
		event: "task.assigned",
		taskId: e.taskId,
		assigneeId: e.assigneeId,
		byUserId: e.byUserId,
	});
});

emitter.on(CommentAdded, async (e) => {
	relay.broadcast(`project/${e.projectId}`, {
		event: "comment.added",
		taskId: e.taskId,
		commentId: e.commentId,
		authorId: e.authorId,
	});
});
