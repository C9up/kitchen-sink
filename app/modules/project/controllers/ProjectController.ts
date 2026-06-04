import type { HttpContext } from "@c9up/ream";
import app from "@c9up/ream/services/app";
import { WorkspaceService } from "#modules/workspace/services/WorkspaceService.js";
import { ProjectService } from "../services/ProjectService.js";
import { CreateProjectValidator } from "../validators/CreateProjectValidator.js";

/**
 * Routes (auth gating in routes.ts):
 *   POST /workspaces/:slug/projects        — create (member only, `.guard('jwt')`)
 *   GET  /workspaces/:slug/projects        — list   (member only, `.guard('jwt')`)
 *   GET  /workspaces/:slug/projects/:projectSlug — show (anonymous-allowed
 *       for public projects; private gate on membership read from
 *       ctx.auth populated by the global auth middleware)
 */
export default class ProjectController {
	async create({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const wsSlug = request.param("slug");
		if (typeof wsSlug !== "string") {
			response.status(400).json({ ok: false, error: "workspace slug missing" });
			return;
		}
		const wsSvc = app.container.make<WorkspaceService>(WorkspaceService);
		const workspace = await wsSvc.findBySlug(wsSlug);
		if (!workspace) {
			response.status(404).json({ ok: false, error: "workspace not found" });
			return;
		}
		const membership = await wsSvc.getMembership(workspace.id, callerId);
		if (!membership) {
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}

		const parsed = CreateProjectValidator.validate((await request.body()) ?? {});
		if (!parsed.valid) {
			response.status(422).json({ ok: false, errors: parsed.errors });
			return;
		}
		const svc = app.container.make<ProjectService>(ProjectService);
		const project = await svc.create({
			workspaceId: workspace.id,
			name: parsed.data.name,
			visibility: parsed.data.visibility,
			descriptions: {
				fr: parsed.data.descriptionFr,
				en: parsed.data.descriptionEn,
			},
		});
		response.status(201).json({ ok: true, project: shape(project) });
	}

	async list({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const wsSlug = request.param("slug");
		if (typeof wsSlug !== "string") {
			response.status(400).json({ ok: false, error: "workspace slug missing" });
			return;
		}
		const wsSvc = app.container.make<WorkspaceService>(WorkspaceService);
		const workspace = await wsSvc.findBySlug(wsSlug);
		if (!workspace) {
			response.status(404).json({ ok: false, error: "workspace not found" });
			return;
		}
		const membership = await wsSvc.getMembership(workspace.id, callerId);
		if (!membership) {
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}

		const svc = app.container.make<ProjectService>(ProjectService);
		const projects = await svc.listForWorkspace(workspace.id);
		response.json({
			ok: true,
			projects: projects.map(shape),
		});
	}

	async show({ request, response, auth }: HttpContext) {
		const wsSlug = request.param("slug");
		const projectSlug = request.param("projectSlug");
		if (typeof wsSlug !== "string" || typeof projectSlug !== "string") {
			response.status(400).json({ ok: false, error: "missing slug" });
			return;
		}
		const wsSvc = app.container.make<WorkspaceService>(WorkspaceService);
		const workspace = await wsSvc.findBySlug(wsSlug);
		if (!workspace) {
			response.status(404).json({ ok: false, error: "workspace not found" });
			return;
		}
		// Anonymous viewers are allowed for `visibility: 'public'` projects.
		// `ctx.auth.user?.id` is undefined when no Bearer token is present;
		// `findForCaller` returns the project only if it's public or the
		// caller is a member.
		const callerId = (auth.user?.id as string | undefined) ?? null;
		const svc = app.container.make<ProjectService>(ProjectService);
		const project = await svc.findForCaller(
			workspace.id,
			projectSlug,
			callerId,
		);
		if (!project) {
			// 404 even when the project exists-but-is-private. We don't
			// distinguish "doesn't exist" from "you're not invited" here —
			// the existence info would be a low-grade enumeration leak.
			response.status(404).json({ ok: false, error: "project not found" });
			return;
		}
		// `?locale=fr|en` picks the language; default falls back to fr
		// to match the workspace seed defaults. Unknown locales clamp to fr.
		const localeRaw = readQueryParam(request, "locale");
		const locale: "fr" | "en" = localeRaw === "en" ? "en" : "fr";
		response.json({
			ok: true,
			project: shape(project),
			description: svc.descriptionForLocale(project, locale),
			locale,
		});
	}
}

function shape(project: {
	id: string;
	workspaceId: string;
	name: string;
	slug: string;
	visibility: string;
}): Record<string, string> {
	return {
		id: project.id,
		workspaceId: project.workspaceId,
		name: project.name,
		slug: project.slug,
		visibility: project.visibility,
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
