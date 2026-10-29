import type { FormField } from "@StryveForms/forms/types";

/** Built-in submission columns that aren't answer fields, in default order. */
export const BASE_COLUMN_IDS = ["createdAt", "status"] as const;

/** Default order: built-in columns first, then answer fields in form order. */
export function defaultColumnOrder(fields: FormField[]): string[] {
	return [...BASE_COLUMN_IDS, ...fields.map((field) => field.id)];
}

/**
 * Keeps a saved column order in sync with the form's current fields: drops
 * ids that no longer exist (a field was deleted, and also removed from
 * removedProperties), appends any new ones at the end.
 */
export function reconcileColumnOrder(
	saved: string[],
	fields: FormField[]
): string[] {
	const valid = new Set(defaultColumnOrder(fields));
	const kept = saved.filter((id) => valid.has(id));
	const missing = [...valid].filter((id) => !kept.includes(id));
	return [...kept, ...missing];
}
