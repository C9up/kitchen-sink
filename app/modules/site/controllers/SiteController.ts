import aurora from "@c9up/aurora/services/main";
import { serializeMetaTags } from "@c9up/photon";
import type { HttpContext } from "@c9up/ream";
import app from "@c9up/ream/services/app";
import i18n from "@c9up/rosetta/services/main";
import { CommentService } from "#modules/comment/services/CommentService.js";
import { ProjectService } from "#modules/project/services/ProjectService.js";
import { TaskService } from "#modules/task/services/TaskService.js";
import { WorkspaceService } from "#modules/workspace/services/WorkspaceService.js";

/**
 * Public, SSR-rendered project page.
 *
 *   GET /pages/workspaces/:wsSlug/projects/:projectSlug      — static SSR
 *   GET /pages/live/workspaces/:wsSlug/projects/:projectSlug — SSR + hydrate
 *
 * Both endpoints render the SAME aurora component
 * (`resources/pages/ProjectPage.js`) via `aurora.render(...)`. The "live"
 * route additionally injects an importmap + bootstrap blob + hydration
 * script so the client adopts the SSR markup and opens an EventSource
 * against `/__relay/events` to refresh on `task.assigned` /
 * `comment.added`.
 *
 * Locale resolution (first match wins): `?locale=fr|en` → Accept-Language
 * → configured default.
 */
export default class SiteController {
	async showProject(ctx: HttpContext) {
		await this.renderProject(ctx, { live: false });
	}

	async showProjectLive(ctx: HttpContext) {
		await this.renderProject(ctx, { live: true });
	}

	private async renderProject(
		ctx: HttpContext,
		options: { live: boolean },
	) {
		const { request, response } = ctx;
		const wsSlug = request.param("wsSlug");
		const projectSlug = request.param("projectSlug");
		if (typeof wsSlug !== "string" || typeof projectSlug !== "string") {
			response.status(400).send("missing slug");
			return;
		}

		const workspaceSvc = app.container.make<WorkspaceService>(WorkspaceService);
		const projectSvc = app.container.make<ProjectService>(ProjectService);
		const taskSvc = app.container.make<TaskService>(TaskService);
		const commentSvc = app.container.make<CommentService>(CommentService);

		const localeRaw = readQueryParam(request, "locale");
		const explicit =
			localeRaw === "fr" || localeRaw === "en" ? localeRaw : null;
		const locale =
			explicit ??
			i18n.resolveLocale({
				header: request.header("accept-language") ?? null,
			});
		const t = i18n.locale(locale);

		const workspace = await workspaceSvc.findBySlug(wsSlug);
		if (!workspace) {
			response.status(404).send("<h1>404 — workspace not found</h1>");
			return;
		}
		const project = await projectSvc.findForCaller(
			workspace.id,
			projectSlug,
			null,
		);
		if (!project) {
			response.status(404).send("<h1>404 — project not found</h1>");
			return;
		}

		const tasks = await taskSvc.list(project.id, {});
		let commentsCount = 0;
		for (const task of tasks) {
			commentsCount += (await commentSvc.listForTask(task.id)).length;
		}

		const descriptionLocale: "fr" | "en" = locale === "fr" ? "fr" : "en";
		const description = projectSvc.descriptionForLocale(
			project,
			descriptionLocale,
		);

		const props = {
			locale,
			channel: `project/${project.id}`,
			project: {
				id: project.id,
				name: project.name,
				slug: project.slug,
				visibility: project.visibility,
			},
			description,
			tasks: tasks.map((task) => ({
				id: task.id,
				title: task.title,
				status: task.status,
			})),
			commentsCount,
			labels: {
				title: t.t("project.title", { name: project.name }),
				visibility: t.t(`project.visibility.${project.visibility}`),
				tasksHeading: t.t("project.tasks.heading"),
				tasksEmpty: t.t("project.tasks.empty"),
				taskStatus: {
					todo: t.t("project.tasks.status.todo"),
					doing: t.t("project.tasks.status.doing"),
					done: t.t("project.tasks.status.done"),
				},
				commentsHeading: t.t("project.comments.heading"),
				commentsEmpty: t.t("project.comments.empty"),
				appName: t.t("app.name"),
				appTagline: t.t("app.tagline"),
			},
		};

		const headExtra = serializeMetaTags({
			title: t.t("project.title", { name: project.name }),
			description: t.t("meta.description", { name: project.name }),
			og: {
				title: t.t("project.title", { name: project.name }),
				description: t.t("meta.description", { name: project.name }),
				locale,
				type: "website",
			},
		});

		// The non-live route ships the same SSR markup minus the
		// importmap + hydration script (renderPage always includes
		// them; here we strip them for the static-only case). Passing
		// an empty importmap is harmless but the hydrate script still
		// fires — for the static case we want neither, so we render
		// directly via renderToString.
		if (!options.live) {
			await renderStaticOnly(ctx, props, locale, headExtra);
			return;
		}

		await aurora.render(ctx, "ProjectPage", props, {
			lang: locale,
			rootId: "aurora-root",
			headExtra,
		});
	}
}

async function renderStaticOnly(
	{ response }: HttpContext,
	props: unknown,
	locale: string,
	headExtra: string,
): Promise<void> {
	// Resolve the same factory aurora.render would use, but only emit
	// the SSR body without the hydration plumbing — keeps the existing
	// static-page tests honest about "no JS shipped".
	const { renderToString } = await import("@c9up/aurora");
	const factory = await aurora.pages.resolve("ProjectPage");
	const body = renderToString(await factory(props));
	const doc = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
${headExtra}
</head>
<body>
${body}
</body>
</html>`;
	response.header("content-type", "text/html; charset=utf-8");
	response.send(doc);
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
