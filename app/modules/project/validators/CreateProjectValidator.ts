import { rules, schema } from "@c9up/rune";

export interface CreateProjectInput {
	name: string;
	visibility: "public" | "private";
	descriptionFr?: string;
	descriptionEn?: string;
}

export const CreateProjectValidator = schema<CreateProjectInput>({
	name: rules.string().trim().min(2).max(80),
	visibility: rules
		.string()
		.custom(
			"visibility.invalid",
			(v) => v === "public" || v === "private",
			"visibility must be 'public' or 'private'",
		),
	// Descriptions are optional — apps can lazily backfill once a
	// project starts taking shape. We accept either or both locales.
	descriptionFr: rules.string().max(2000).optional(),
	descriptionEn: rules.string().max(2000).optional(),
});
