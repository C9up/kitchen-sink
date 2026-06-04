import {
	afterAll,
	beforeAll,
	describe,
	expect,
	it,
	type TestClient,
} from "@c9up/helix";
import { createClient, forceExitAfter } from "./_helpers.js";

let client: TestClient;
let ownerToken: string;
let ownerId: string;
let memberToken: string;
let memberId: string;
let workspaceSlug: string;
let projectId: string;

beforeAll(async () => {
	client = createClient();
	await client.boot();

	// Owner + member fixture — used across every domain describe block.
	const owner = await client
		.post("/auth/signup")
		.json({
			email: "owner@example.com",
			password: "domain-test-pass-1",
			displayName: "Owner",
			locale: "fr",
		})
		.send();
	ownerToken = (owner.json() as { token: string; user: { id: string } }).token;
	ownerId = (owner.json() as { user: { id: string } }).user.id;

	const member = await client
		.post("/auth/signup")
		.json({
			email: "member@example.com",
			password: "domain-test-pass-2",
			displayName: "Member",
			locale: "en",
		})
		.send();
	memberToken = (member.json() as { token: string; user: { id: string } }).token;
	memberId = (member.json() as { user: { id: string } }).user.id;

	const ws = await client
		.post("/workspaces")
		.header("authorization", `Bearer ${ownerToken}`)
		.json({ name: "Demo Co" })
		.send();
	workspaceSlug = (
		ws.json() as { workspace: { slug: string } }
	).workspace.slug;

	const wsId = (ws.json() as { workspace: { id: string } }).workspace.id;
	// Invite + accept the member so cross-membership flows in this file
	// have a non-owner caller without spilling permission concerns into
	// each describe block.
	const inv = await client
		.post(`/workspaces/${wsId}/invite`)
		.header("authorization", `Bearer ${ownerToken}`)
		.json({ email: "member@example.com", role: "member" })
		.send();
	const token = (
		inv.json() as { invitation: { token: string } }
	).invitation.token;
	await client
		.post(`/invitations/${token}/accept`)
		.header("authorization", `Bearer ${memberToken}`)
		.send();
}, 30_000);

afterAll(async () => {
	await client?.close();
	forceExitAfter();
});

describe("kitchen-sink > E2E > domain > project", () => {
	it("owner creates a private project with FR + EN descriptions", async () => {
		const res = await client
			.post(`/workspaces/${workspaceSlug}/projects`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({
				name: "Roadmap 2026",
				visibility: "private",
				descriptionFr: "La feuille de route 2026",
				descriptionEn: "The 2026 roadmap",
			})
			.send();
		expect(res.status).toBe(201);
		const body = res.json() as {
			project: { id: string; slug: string; visibility: string };
		};
		expect(body.project.slug).toBe("roadmap-2026");
		expect(body.project.visibility).toBe("private");
		projectId = body.project.id;
	});

	it("FR locale picks French description; EN locale picks English", async () => {
		const fr = await client
			.get(`/workspaces/${workspaceSlug}/projects/roadmap-2026?locale=fr`)
			.header("authorization", `Bearer ${ownerToken}`)
			.send();
		const en = await client
			.get(`/workspaces/${workspaceSlug}/projects/roadmap-2026?locale=en`)
			.header("authorization", `Bearer ${ownerToken}`)
			.send();
		expect((fr.json() as { description: string }).description).toBe(
			"La feuille de route 2026",
		);
		expect((en.json() as { description: string }).description).toBe(
			"The 2026 roadmap",
		);
	});

	it("anonymous visitor cannot read a private project (404)", async () => {
		const res = await client
			.get(`/workspaces/${workspaceSlug}/projects/roadmap-2026`)
			.send();
		expect(res.status).toBe(404);
	});

	it("anonymous visitor CAN read a public project", async () => {
		const pub = await client
			.post(`/workspaces/${workspaceSlug}/projects`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({
				name: "Public Wiki",
				visibility: "public",
				descriptionFr: "wiki public",
			})
			.send();
		expect(pub.status).toBe(201);
		const anon = await client
			.get(`/workspaces/${workspaceSlug}/projects/public-wiki`)
			.send();
		expect(anon.status).toBe(200);
		expect(
			(anon.json() as { project: { slug: string } }).project.slug,
		).toBe("public-wiki");
	});
});

describe("kitchen-sink > E2E > domain > task lifecycle", () => {
	let taskId: string;

	it("owner creates a task assigned to member, due in 2 days", async () => {
		const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
		const res = await client
			.post(`/projects/${projectId}/tasks`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({
				title: "Ship the demo",
				description: "End-to-end coverage of all packages",
				priority: "high",
				assigneeId: memberId,
				dueAt,
			})
			.send();
		expect(res.status).toBe(201);
		const body = res.json() as {
			task: { id: string; status: string; priority: string; assigneeId: string; dueAt: string };
		};
		expect(body.task.status).toBe("todo");
		expect(body.task.priority).toBe("high");
		expect(body.task.assigneeId).toBe(memberId);
		expect(body.task.dueAt).toBeTruthy();
		taskId = body.task.id;
	});

	it("rejects an invalid dueAt with 422", async () => {
		const res = await client
			.post(`/projects/${projectId}/tasks`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({ title: "Bad date", dueAt: "not-a-date" })
			.send();
		expect(res.status).toBe(422);
	});

	it("accepts a valid weekly RRULE recurrence", async () => {
		const res = await client
			.post(`/projects/${projectId}/tasks`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({
				title: "Weekly status",
				recurrenceRrule: "FREQ=WEEKLY;COUNT=4",
			})
			.send();
		expect(res.status).toBe(201);
		expect(
			(res.json() as { task: { recurrenceRrule: string } }).task.recurrenceRrule,
		).toBe("FREQ=WEEKLY;COUNT=4");
	});

	it("status transitions: todo → doing → done sets completedAt", async () => {
		const doing = await client
			.patch(`/tasks/${taskId}`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({ status: "doing" })
			.send();
		expect(doing.status).toBe(200);
		expect((doing.json() as { task: { status: string } }).task.status).toBe(
			"doing",
		);
		const done = await client
			.patch(`/tasks/${taskId}`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({ status: "done" })
			.send();
		const taskDone = (done.json() as { task: { status: string; completedAt: string | null } })
			.task;
		expect(taskDone.status).toBe("done");
		expect(taskDone.completedAt).toBeTruthy();
	});

	it("status filter narrows the list", async () => {
		const all = await client
			.get(`/projects/${projectId}/tasks`)
			.header("authorization", `Bearer ${ownerToken}`)
			.send();
		const totalCount = (all.json() as { tasks: unknown[] }).tasks.length;
		const todo = await client
			.get(`/projects/${projectId}/tasks?status=todo`)
			.header("authorization", `Bearer ${ownerToken}`)
			.send();
		const todoCount = (todo.json() as { tasks: unknown[] }).tasks.length;
		// `Ship the demo` is now `done`, `Weekly status` is `todo`, so
		// filtering to `todo` should yield strictly fewer rows than `all`.
		expect(todoCount).toBeLessThan(totalCount);
		expect(todoCount).toBeGreaterThan(0);
	});
});

describe("kitchen-sink > E2E > domain > comments + blackhole", () => {
	let taskId: string;

	it("creates a task to host comments", async () => {
		const res = await client
			.post(`/projects/${projectId}/tasks`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({ title: "Comment target" })
			.send();
		taskId = (res.json() as { task: { id: string } }).task.id;
	});

	it("strips <script> from a malicious comment body", async () => {
		const res = await client
			.post(`/tasks/${taskId}/comments`)
			.header("authorization", `Bearer ${memberToken}`)
			.json({
				body: "Looks good <script>alert('xss')</script> ship it",
			})
			.send();
		expect(res.status).toBe(201);
		const body = res.json() as { comment: { body: string } };
		expect(body.comment.body).not.toMatch(/<script/i);
		expect(body.comment.body).toContain("Looks good");
		expect(body.comment.body).toContain("ship it");
	});

	it("rejects an empty body with 422", async () => {
		const res = await client
			.post(`/tasks/${taskId}/comments`)
			.header("authorization", `Bearer ${memberToken}`)
			.json({ body: "" })
			.send();
		expect(res.status).toBe(422);
	});

	it("listing returns the sanitised body", async () => {
		const res = await client
			.get(`/tasks/${taskId}/comments`)
			.header("authorization", `Bearer ${memberToken}`)
			.send();
		const body = res.json() as { comments: Array<{ body: string }> };
		expect(body.comments.length).toBeGreaterThan(0);
		expect(body.comments[0].body).not.toMatch(/<script/i);
	});
});

describe("kitchen-sink > E2E > domain > attachments via archive", () => {
	let taskId: string;
	let attachmentId: string;
	const payload = "hello kitchen-sink attachment";
	const base64 = Buffer.from(payload, "utf8").toString("base64");

	it("creates a task to hold attachments", async () => {
		const res = await client
			.post(`/projects/${projectId}/tasks`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({ title: "Doc target" })
			.send();
		taskId = (res.json() as { task: { id: string } }).task.id;
	});

	it("uploads a base64-encoded blob via archive storage", async () => {
		const res = await client
			.post(`/tasks/${taskId}/attachments`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({
				filename: "notes.txt",
				contentType: "text/plain",
				contentBase64: base64,
			})
			.send();
		expect(res.status).toBe(201);
		const body = res.json() as {
			attachment: { id: string; size: number; filename: string };
		};
		expect(body.attachment.filename).toBe("notes.txt");
		expect(body.attachment.size).toBe(payload.length);
		attachmentId = body.attachment.id;
	});

	it("rejects path-traversal filenames with 422", async () => {
		const res = await client
			.post(`/tasks/${taskId}/attachments`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({
				filename: "../etc/passwd",
				contentType: "text/plain",
				contentBase64: base64,
			})
			.send();
		expect(res.status).toBe(422);
	});

	it("downloads + round-trips the bytes", async () => {
		const res = await client
			.get(`/attachments/${attachmentId}/download`)
			.header("authorization", `Bearer ${ownerToken}`)
			.send();
		expect(res.status).toBe(200);
		const body = res.json() as { contentBase64: string };
		const decoded = Buffer.from(body.contentBase64, "base64").toString("utf8");
		expect(decoded).toBe(payload);
	});
});

describe("kitchen-sink > E2E > domain > notifications fanout", () => {
	it("assigning a task to the member emits the notification chain", async () => {
		// Fresh task assigned to member — fires `TaskAssigned`, which
		// the event-bus listener forwards to a bay job, which writes a
		// Notification row + sends an email + tries a nova push.
		const created = await client
			.post(`/projects/${projectId}/tasks`)
			.header("authorization", `Bearer ${ownerToken}`)
			.json({
				title: "Review PR",
				assigneeId: memberId,
			})
			.send();
		expect(created.status).toBe(201);

		// `/me/notifications` triggers `queue.processOne()` internally
		// before reading — so the test sees the notification row created
		// by the bay handler within this single HTTP roundtrip.
		const inbox = await client
			.get("/me/notifications")
			.header("authorization", `Bearer ${memberToken}`)
			.send();
		expect(inbox.status).toBe(200);
		const body = inbox.json() as {
			notifications: Array<{ type: string; payload: { title: string } }>;
		};
		expect(body.notifications.length).toBeGreaterThan(0);
		// Filter by the exact task title — multiple `task.assigned`
		// notifications can pile up across describe blocks and PK-DESC
		// ordering on UUIDv4 PKs is non-monotonic.
		const taskAssigned = body.notifications.find(
			(n) => n.type === "task.assigned" && n.payload.title === "Review PR",
		);
		expect(taskAssigned).toBeDefined();
	});

	it("marks a notification as read", async () => {
		const list = await client
			.get("/me/notifications")
			.header("authorization", `Bearer ${memberToken}`)
			.send();
		const target = (
			list.json() as { notifications: Array<{ id: string; readAt: string | null }> }
		).notifications.find((n) => n.readAt === null);
		expect(target).toBeDefined();
		if (!target) return;
		const res = await client
			.post(`/me/notifications/${target.id}/read`)
			.header("authorization", `Bearer ${memberToken}`)
			.send();
		expect(res.status).toBe(200);
		expect((res.json() as { readAt: string }).readAt).toBeTruthy();
	});

	it("other users can't read someone else's notifications (404)", async () => {
		const list = await client
			.get("/me/notifications")
			.header("authorization", `Bearer ${memberToken}`)
			.send();
		const target = (
			list.json() as { notifications: Array<{ id: string }> }
		).notifications[0];
		expect(target).toBeDefined();
		const res = await client
			.post(`/me/notifications/${target.id}/read`)
			.header("authorization", `Bearer ${ownerToken}`)
			.send();
		expect(res.status).toBe(404);
	});
});

void ownerId;
