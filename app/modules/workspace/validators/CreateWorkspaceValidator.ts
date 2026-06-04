import { rules, schema } from "@c9up/rune";

export interface CreateWorkspaceInput {
	name: string;
}

export const CreateWorkspaceValidator = schema<CreateWorkspaceInput>({
	name: rules.string().trim().min(2).max(80),
});
