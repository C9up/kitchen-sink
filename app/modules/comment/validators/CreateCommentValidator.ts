import { rules, schema } from "@c9up/rune";

export interface CreateCommentInput {
	body: string;
}

export const CreateCommentValidator = schema<CreateCommentInput>({
	// Length is enforced BEFORE sanitisation: a comment that's 50KB of
	// `<script>` would shrink to a couple of bytes after blackhole
	// strips, which would silently let an over-sized post through.
	body: rules.string().trim().min(1).max(5_000),
});
