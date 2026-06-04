import type { HttpContext } from "@c9up/ream";
import app from "@c9up/ream/services/app";
import queue from "@c9up/bay/services/main";
import { NotificationService } from "../services/NotificationService.js";

export default class NotificationController {
	async list({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;

		// E2E tests rely on assertions hitting after the queue drains —
		// processing pending jobs here keeps the controller's view in sync
		// with whatever events were fired during the request. A production
		// deployment runs the worker out-of-band; the demo inlines it
		// because everything's in-process.
		await drainQueue();

		void request;
		const svc = app.container.make<NotificationService>(NotificationService);
		const rows = await svc.listForUser(callerId);
		response.json({
			ok: true,
			notifications: rows.map((n) => ({
				id: n.id,
				type: n.type,
				payload: safeParse(n.payload),
				readAt: n.readAt ? n.readAt.toISOString() : null,
				createdAt: n.createdAt.toISOString(),
			})),
		});
	}

	async markRead({ request, response, auth }: HttpContext) {
		const callerId = auth.user!.id as string;
		const id = request.param("id");
		if (typeof id !== "string") {
			response.status(400).json({ ok: false, error: "id missing" });
			return;
		}
		const svc = app.container.make<NotificationService>(NotificationService);
		const row = await svc.markRead(id, callerId);
		if (!row) {
			response.status(404).json({ ok: false, error: "notification not found" });
			return;
		}
		response.json({ ok: true, readAt: row.readAt?.toISOString() });
	}
}

function safeParse(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

async function drainQueue(): Promise<void> {
	// The MemoryDriver returns false from `processOne` when empty.
	for (let safety = 0; safety < 1000; safety++) {
		const more = await queue.processOne();
		if (!more) return;
	}
}
