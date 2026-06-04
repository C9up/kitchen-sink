import type { HttpContext } from "@c9up/ream";
import app from "@c9up/ream/services/app";
import { WorkspaceService } from "../services/WorkspaceService.js";
import { CreateWorkspaceValidator } from "../validators/CreateWorkspaceValidator.js";
import { InviteValidator } from "../validators/InviteValidator.js";

/**
 * Workspace endpoints — all gated by `.guard('jwt')` in routes.ts.
 * `ctx.auth.user.id` is guaranteed populated by the time these handlers
 * run (the guard middleware throws E_UNAUTHORIZED otherwise).
 *
 * Authorisation:
 *   - POST /workspaces           — any authenticated user
 *   - GET  /workspaces           — lists ONLY workspaces the caller is a
 *                                  member of (filtered server-side)
 *   - POST /workspaces/:id/invite — caller must be owner OR admin
 *   - POST /invitations/:token/accept — caller's userId becomes the
 *                                       membership's userId
 */
export default class WorkspaceController {
	async create({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const parsed = CreateWorkspaceValidator.validate(
			(await request.body()) ?? {},
		);
		if (!parsed.valid) {
			response.status(422).json({ ok: false, errors: parsed.errors });
			return;
		}
		const svc = app.container.make<WorkspaceService>(WorkspaceService);
		const workspace = await svc.create(callerId, parsed.data.name);
		response.status(201).json({ ok: true, workspace: shape(workspace) });
	}

	async list({ response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const svc = app.container.make<WorkspaceService>(WorkspaceService);
		const rows = await svc.listForUser(callerId);
		response.json({
			ok: true,
			workspaces: rows.map((r) => ({ ...shape(r.workspace), role: r.role })),
		});
	}

	async invite({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const workspaceId = request.param("id");
		if (typeof workspaceId !== "string") {
			response.status(400).json({ ok: false, error: "workspace id missing" });
			return;
		}

		const svc = app.container.make<WorkspaceService>(WorkspaceService);
		const membership = await svc.getMembership(workspaceId, callerId);
		if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
			// 403 not 404 — we deliberately reveal that the workspace
			// exists when the caller isn't authorised, because the
			// per-workspace ID surface isn't a secret (it's UUID anyway).
			response.status(403).json({ ok: false, error: "forbidden" });
			return;
		}

		const parsed = InviteValidator.validate((await request.body()) ?? {});
		if (!parsed.valid) {
			response.status(422).json({ ok: false, errors: parsed.errors });
			return;
		}
		const invitation = await svc.invite(
			workspaceId,
			parsed.data.email,
			parsed.data.role,
		);
		response.status(201).json({
			ok: true,
			invitation: {
				id: invitation.id,
				email: invitation.email,
				role: invitation.role,
				token: invitation.token,
				expiresAt: invitation.expiresAt.toISOString(),
			},
		});
	}

	async accept({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const token = request.param("token");
		if (typeof token !== "string" || token.length !== 64) {
			response.status(400).json({ ok: false, error: "invalid token" });
			return;
		}

		const svc = app.container.make<WorkspaceService>(WorkspaceService);
		try {
			const { workspace, membership } = await svc.acceptInvitation(
				token,
				callerId,
			);
			response.status(201).json({
				ok: true,
				workspace: shape(workspace),
				role: membership.role,
			});
		} catch (err) {
			const code = (err as Error).message;
			if (code === "INVITATION_NOT_FOUND") {
				response.status(404).json({ ok: false, error: "not found" });
				return;
			}
			if (code === "INVITATION_EXPIRED" || code === "INVITATION_ALREADY_USED") {
				response.status(410).json({ ok: false, error: code.toLowerCase() });
				return;
			}
			throw err;
		}
	}
}

function shape(workspace: {
	id: string;
	name: string;
	slug: string;
	ownerId: string;
}): Record<string, string> {
	return {
		id: workspace.id,
		name: workspace.name,
		slug: workspace.slug,
		ownerId: workspace.ownerId,
	};
}
