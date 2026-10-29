/**
 * Converts the simplified field spec the AI agent writes (from a plain
 * English request) into real `FormField[]` objects, using the same block
 * catalogue and defaults the form editor uses
 * (packages/forms/src/blocks.ts). Keeping this as a pure, testable function
 * is what lets `create_form` and `update_form_fields` stay small.
 */
import { getBlock } from "@StryveForms/forms/blocks";
import type { FormField, SelectOption } from "@StryveForms/forms/types";
import { z } from "zod";

import { newId } from "../../lib/ids";

const MAX_FIELDS = 100;
const MAX_OPTIONS = 50;

export const fieldWidthSchema = z.enum([
	"full",
	"1/2",
	"1/3",
	"2/3",
	"1/4",
	"3/4",
]);

/** What the AI agent can specify for one field; everything else keeps the block's default. */
export const fieldSpecSchema = z.object({
	/** Catalogue id, e.g. "text", "email", "select", "radio", "multi_select", "nf-page-break". */
	blockId: z.string().min(1).max(50),
	help: z.string().max(500).optional(),
	name: z.string().min(1).max(200),
	/** Choices for select / radio / multi_select fields. */
	options: z.array(z.string().min(1).max(200)).max(MAX_OPTIONS).optional(),
	placeholder: z.string().max(200).optional(),
	required: z.boolean().optional(),
	width: fieldWidthSchema.optional(),
});
export type FieldSpec = z.infer<typeof fieldSpecSchema>;

export const formSpecSchema = z.object({
	fields: z.array(fieldSpecSchema).min(1).max(MAX_FIELDS),
	title: z.string().min(1).max(255),
});
export type FormSpec = z.infer<typeof formSpecSchema>;

export class InvalidBlockError extends Error {
	constructor(blockId: string) {
		super(
			`Unknown field type "${blockId}". Call list_forms or get_form first, or use a supported block id (text, rich_text, email, phone_number, url, number, date, select, radio, multi_select, checkbox, toggle_switch, rating, scale, slider, matrix, files, signature, nf-page-break, nf-divider, nf-text).`
		);
	}
}

function toOptions(values: string[]): { options: SelectOption[] } {
	return { options: values.map((name) => ({ id: name, name })) };
}

/** Builds one `FormField` from a spec, seeded with the catalogue block's defaults. */
export function buildField(spec: FieldSpec): FormField {
	const block = getBlock(spec.blockId);
	if (!block) {
		throw new InvalidBlockError(spec.blockId);
	}
	const field: FormField = {
		id: newId(),
		name: spec.name,
		type: block.type,
		...(structuredClone(block.defaultValues) as Record<string, unknown>),
	};
	if (spec.required !== undefined) {
		field.required = spec.required;
	}
	if (spec.width) {
		field.width = spec.width;
	}
	if (spec.help) {
		field.help = spec.help;
	}
	if (spec.placeholder) {
		field.placeholder = spec.placeholder;
	}
	if (block.isInput && spec.options && spec.options.length > 0) {
		if (block.id === "multi_select") {
			field.multi_select = toOptions(spec.options);
		} else if (block.id === "select" || block.id === "radio") {
			field.select = toOptions(spec.options);
		}
	}
	return field;
}

/** Builds a full field list from an AI-authored spec, in order. */
export function buildFields(specs: readonly FieldSpec[]): FormField[] {
	return specs.map(buildField);
}
