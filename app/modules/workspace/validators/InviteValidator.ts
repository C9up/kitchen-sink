import { rules, schema } from "@c9up/rune";

export interface InviteInput {
	email: string;
	role: "admin" | "member";
}

export const InviteValidator = schema<InviteInput>({
	email: rules.string().trim().email(),
	role: rules
		.string()
		.custom(
			"role.invalid",
			(v) => v === "admin" || v === "member",
			"role must be 'admin' or 'member' (owner is reserved for the workspace creator)",
		),
});
