import type { ColumnOptions } from "@c9up/atlas";

/**
 * Date column adapter — coerce the raw DB value back into a JS `Date`
 * after a SELECT or post-INSERT hydration. atlas's built-in
 * `@column.dateTime()` only registers metadata for `autoCreate` /
 * `autoUpdate` and doesn't actually convert DB strings to Date objects
 * during hydration, so callers downstream end up with strings even when
 * the field is declared `Date`. Adding an explicit `consume` adapter
 * closes that gap.
 *
 * Use:
 *   @Column(dateColumn) declare createdAt: Date;
 *
 * Sqlite stores timestamps as ISO-8601 text, postgres / mysql return
 * Date-shaped values from the driver — both paths land here normalised.
 */
export const dateColumn: ColumnOptions = {
	consume: (value: unknown): Date | null => {
		if (value === null || value === undefined) return null;
		if (value instanceof Date) return value;
		if (typeof value === "string" || typeof value === "number") {
			return new Date(value);
		}
		return null;
	},
	prepare: (value: unknown): string | null => {
		if (value === null || value === undefined) return null;
		if (value instanceof Date) return value.toISOString();
		// Already-stringified values (or numbers) pass through untouched —
		// sqlx accepts ISO-8601 / unix-ms / number directly for TIMESTAMP
		// columns and we don't want to double-stringify.
		return String(value);
	},
};
