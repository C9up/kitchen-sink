import { rules, schema } from "@c9up/rune";

export interface CreateAttachmentInput {
	filename: string;
	contentType: string;
	contentBase64: string;
}

const MAX_BASE64_SIZE = 10 * 1024 * 1024 * 2; // ~10MB binary, base64 is ~4/3x.

export const CreateAttachmentValidator = schema<CreateAttachmentInput>({
	filename: rules
		.string()
		.trim()
		.min(1)
		.max(255)
		.custom(
			"filename.invalid",
			(v) => typeof v === "string" && !/[/\\]|\.\.|^\./.test(v),
			"filename cannot contain path traversal characters",
		),
	// `contentType` is client-declared and stored as-is; sniff at
	// download time if the use case demands strict validation.
	contentType: rules.string().min(3).max(120),
	contentBase64: rules
		.string()
		.min(1)
		.max(MAX_BASE64_SIZE)
		.custom(
			"contentBase64.invalid",
			(v) => typeof v === "string" && /^[A-Za-z0-9+/=\r\n]+$/.test(v),
			"contentBase64 must be valid base64",
		),
});
