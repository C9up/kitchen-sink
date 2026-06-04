import { rules, schema } from "@c9up/rune";

export interface LoginInput {
	email: string;
	password: string;
}

export const LoginValidator = schema<LoginInput>({
	email: rules.string().trim().email(),
	// No min on password here on purpose: failed login should always look
	// the same to the caller (bad-credentials, status 401) regardless of
	// whether the rejection came from format or from credential check.
	// Avoids leaking "this email exists" via the validator error path.
	password: rules.string().min(1),
});
