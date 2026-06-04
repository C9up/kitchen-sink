import { rules, schema } from "@c9up/rune";

export interface UpdateTaskInput {
	title?: string;
	description?: string;
	status?: "todo" | "doing" | "done";
	priority?: "low" | "medium" | "high";
	assigneeId?: string | null;
	dueAt?: string | null;
}

export const UpdateTaskValidator = schema<UpdateTaskInput>({
	title: rules.string().trim().min(2).max(200).optional(),
	description: rules.string().max(10_000).optional(),
	status: rules
		.string()
		.custom(
			"status.invalid",
			(v) => v === "todo" || v === "doing" || v === "done",
			"status must be 'todo', 'doing', or 'done'",
		)
		.optional(),
	priority: rules
		.string()
		.custom(
			"priority.invalid",
			(v) => v === "low" || v === "medium" || v === "high",
			"priority must be 'low', 'medium', or 'high'",
		)
		.optional(),
	assigneeId: rules
		.string()
		.custom(
			"assigneeId.invalid",
			(v) => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v),
			"assigneeId must be a UUID",
		)
		.optional(),
	dueAt: rules
		.string()
		.custom(
			"dueAt.invalid",
			(v) => typeof v === "string" && Number.isFinite(Date.parse(v)),
			"dueAt must be a valid ISO-8601 date string",
		)
		.optional(),
});
