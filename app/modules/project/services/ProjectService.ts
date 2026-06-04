import { type AsyncDatabaseConnection, BaseRepository } from "@c9up/atlas";
import { inject, Inject } from "@c9up/ream";
import { WorkspaceService } from "#modules/workspace/services/WorkspaceService.js";
import { Project, type ProjectVisibility } from "../entities/Project.js";

/**
 * Stored description shape: `{ fr?: string, en?: string }`. Persisted
 * as JSON-as-text in the `descriptions` column. The service decodes
 * on read + offers a locale-aware projection (`descriptionForLocale`)
 * so controllers don't have to hand-parse the JSON every call.
 */
export interface DescriptionMap {
	fr?: string;
	en?: string;
}

@inject()
export class ProjectService {
	readonly projects: BaseRepository<Project>;

	constructor(
		@Inject("db") db: AsyncDatabaseConnection,
		@Inject(WorkspaceService) private readonly workspaces: WorkspaceService,
	) {
		this.projects = new BaseRepository(Project, db);
	}

	#slugify(name: string): string {
		const base = name
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40);
		return base || "project";
	}

	#parseDescriptions(raw: string): DescriptionMap {
		try {
			const parsed = JSON.parse(raw);
			if (typeof parsed === "object" && parsed !== null) {
				const m = parsed as Record<string, unknown>;
				return {
					fr: typeof m.fr === "string" ? m.fr : undefined,
					en: typeof m.en === "string" ? m.en : undefined,
				};
			}
		} catch {
			/* fall through */
		}
		return {};
	}

	descriptionForLocale(project: Project, locale: "fr" | "en"): string {
		const map = this.#parseDescriptions(project.descriptions);
		// Fall back to the other locale rather than empty string — beats
		// rendering a blank section on a public page when the maintainer
		// only filled one language.
		return map[locale] ?? map[locale === "fr" ? "en" : "fr"] ?? "";
	}

	async create(input: {
		workspaceId: string;
		name: string;
		visibility: ProjectVisibility;
		descriptions: DescriptionMap;
	}): Promise<Project> {
		let slug = this.#slugify(input.name);
		let suffix = 1;
		while (
			(await this.projects.where("workspaceId", input.workspaceId)).some(
				(p) => p.slug === slug,
			)
		) {
			suffix++;
			slug = `${this.#slugify(input.name)}-${suffix}`;
		}
		const now = new Date();
		const created = await this.projects.create({
			workspaceId: input.workspaceId,
			name: input.name,
			slug,
			visibility: input.visibility,
			descriptions: JSON.stringify(input.descriptions),
			createdAt: now,
			updatedAt: now,
		});
		return this.projects.findOrFail(created.id);
	}

	async listForWorkspace(workspaceId: string): Promise<Project[]> {
		return this.projects.where("workspaceId", workspaceId);
	}

	async findBySlug(
		workspaceId: string,
		slug: string,
	): Promise<Project | null> {
		const rows = await this.projects.where("workspaceId", workspaceId);
		return rows.find((p) => p.slug === slug) ?? null;
	}

	/**
	 * Authorisation helper — returns the project IF the caller is a
	 * member of its workspace, OR the project is public. Returns null
	 * when neither applies, so the controller renders a uniform 404 /
	 * 403 without leaking which condition failed.
	 */
	async findForCaller(
		workspaceId: string,
		slug: string,
		callerId: string | null,
	): Promise<Project | null> {
		const project = await this.findBySlug(workspaceId, slug);
		if (!project) return null;
		if (project.visibility === "public") return project;
		if (!callerId) return null;
		const membership = await this.workspaces.getMembership(
			workspaceId,
			callerId,
		);
		return membership ? project : null;
	}

	/**
	 * Membership-gated project access check. Returns `true` only when
	 * the user belongs to the project's workspace. Used by every
	 * `/projects/:id/...` controller before mutating state, and by the
	 * relay channel authorizer to gate `project/:id` subscriptions.
	 *
	 * Returns `false` when the project doesn't exist — controllers
	 * collapse that into a generic 403 (or 404) without leaking which
	 * condition failed.
	 */
	async canAccess(projectId: string, userId: string): Promise<boolean> {
		const project = await this.projects.find(projectId);
		if (!project) return false;
		const membership = await this.workspaces.getMembership(
			project.workspaceId,
			userId,
		);
		return membership !== null;
	}
}
