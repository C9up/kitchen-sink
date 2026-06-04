import { rules, schema } from "@c9up/rune";

export interface CreateTaskInput {
	title: string;
	description?: string;
	priority?: "low" | "medium" | "high";
	assigneeId?: string;
	dueAt?: string;
	recurrenceRrule?: string;
}

export const CreateTaskValidator = schema<CreateTaskInput>({
	title: rules.string().trim().min(2).max(200),
	description: rules.string().max(10_000).optional(),
	priority: rules
		.string()
		.custom(
			"priority.invalid",
			(v) => v === "low" || v === "medium" || v === "high",
			"priority must be 'low', 'medium', or 'high'",
		)
		.optional(),
	// UUID v4 shape — atlas-generated identifiers always match this pattern.
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
			(v) => {
				if (typeof v !== "string") return false;
				const n = Date.parse(v);
				return Number.isFinite(n);
			},
			"dueAt must be a valid ISO-8601 date string",
		)
		.optional(),
	recurrenceRrule: rules.string().max(500).optional(),
});
