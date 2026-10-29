import { getBlock } from "@StryveForms/forms/blocks";
import { uniqueFieldId } from "@StryveForms/forms/field-ids";
import type { FormField } from "@StryveForms/forms/types";

function dedupeName(base: string, existing: FormField[]): string {
	const names = new Set(existing.map((field) => field.name));
	if (!names.has(base)) {
		return base;
	}
	let counter = 2;
	while (names.has(`${base} ${counter}`)) {
		counter += 1;
	}
	return `${base} ${counter}`;
}

/**
 * Builds a new field from a catalogue block id, matching OpnForm's "add
 * block" construction: a deduped default name, an id slugified from that
 * name (unique against every other field), and the catalogue's default
 * values (deep-cloned so option lists aren't shared between fields of the
 * same block).
 *
 * `focusedImageLayoutDefault`: the form's default
 * question-image layout (Design tab), applied to every new question so an
 * image uploaded later already uses the right layout without extra steps.
 * Only set when it's an actual layout (not "none"/unset) and the block is a
 * real question — layout blocks (text, dividers…) don't carry images.
 */
export function createFieldFromBlock(
	blockId: string,
	existing: FormField[],
	focusedImageLayoutDefault?: string
): FormField | null {
	const block = getBlock(blockId);
	if (!block) {
		return null;
	}
	const defaults = structuredClone(block.defaultValues) as Partial<FormField>;
	const name = dedupeName(block.defaultName, existing);
	const field: FormField = {
		id: uniqueFieldId(
			name,
			existing.map((f) => f.id)
		),
		name,
		type: block.type,
		hidden: false,
		help_position: "below_input",
		...defaults,
	};
	if (
		block.isInput &&
		focusedImageLayoutDefault &&
		focusedImageLayoutDefault !== "none" &&
		!field.image
	) {
		field.image = {
			layout: focusedImageLayoutDefault as NonNullable<
				FormField["image"]
			>["layout"],
		};
	}
	return field;
}
