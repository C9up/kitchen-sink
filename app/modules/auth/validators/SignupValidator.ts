import { rules, schema } from "@c9up/rune";

export interface SignupInput {
	email: string;
	password: string;
	displayName: string;
	locale: "fr" | "en";
}

export const SignupValidator = schema<SignupInput>({
	email: rules.string().trim().email(),
	// 10 chars minimum + at least one digit + at least one letter. No upper
	// bound here — sigil's argon2 driver enforces its own 1024-byte cap.
	password: rules
		.string()
		.min(10)
		.custom(
			"password.needsLetter",
			(v) => typeof v === "string" && /[A-Za-z]/.test(v),
			"Password must contain at least one letter",
		)
		.custom(
			"password.needsDigit",
			(v) => typeof v === "string" && /\d/.test(v),
			"Password must contain at least one digit",
		),
	displayName: rules.string().trim().min(2).max(80),
	locale: rules
		.string()
		.custom(
			"locale.invalid",
			(v) => v === "fr" || v === "en",
			"Locale must be 'fr' or 'en'",
		),
});
