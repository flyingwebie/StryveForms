/**
 * Field id slugs: generating one from a label, keeping it unique, finding
 * duplicates, and renaming every reference to an id when it changes
 * (logic conditions, mentions in rich text/labels, computed-variable
 * formulas, page-break button text, and other free-text settings).
 */

import type { ConditionNode, FieldLogic } from "./logic";
import type { FormSettings } from "./settings";
import type { ComputedVariable, FormField } from "./types";

const DIACRITICS = /[̀-ͯ]/g;
const NON_ALNUM = /[^a-z0-9]+/g;
const EDGE_UNDERSCORE = /^_+|_+$/g;

/** Turns a field label into a slug: lowercase, ascii, words joined by `_`. */
export function slugifyFieldId(label: string): string {
	const base = label
		.normalize("NFKD")
		.replace(DIACRITICS, "")
		.toLowerCase()
		.replace(NON_ALNUM, "_")
		.replace(EDGE_UNDERSCORE, "");
	return base || "field";
}

/**
 * Slugifies `label` and appends `_2`, `_3`, … until the result isn't in
 * `existingIds`. `ignoreId` excludes the field's own current id (e.g. when
 * re-slugging after an edit) so a field never collides with itself.
 */
export function uniqueFieldId(
	label: string,
	existingIds: Iterable<string>,
	ignoreId?: string
): string {
	const used = new Set(existingIds);
	if (ignoreId !== undefined) {
		used.delete(ignoreId);
	}
	const base = slugifyFieldId(label);
	if (!used.has(base)) {
		return base;
	}
	let counter = 2;
	while (used.has(`${base}_${counter}`)) {
		counter += 1;
	}
	return `${base}_${counter}`;
}

/** Every id used by more than one field, e.g. after a manual edit collides. */
export function findDuplicateFieldIds(fields: FormField[]): string[] {
	const counts = new Map<string, number>();
	for (const field of fields) {
		counts.set(field.id, (counts.get(field.id) ?? 0) + 1);
	}
	return [...counts.entries()]
		.filter(([, count]) => count > 1)
		.map(([id]) => id);
}

/* -------------------------------------------------------------------------- */
/*                         Rewriting references on rename                     */
/* -------------------------------------------------------------------------- */

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rewrites a mention span's `mention-field-id="oldId"` attribute to `newId`. */
function renameMentionsInText(
	text: string,
	oldId: string,
	newId: string
): string {
	if (!text.includes("mention-field-id")) {
		return text;
	}
	const pattern = new RegExp(
		`mention-field-id=(["'])${escapeRegExp(oldId)}\\1`,
		"g"
	);
	return text.replace(pattern, `mention-field-id=$1${newId}$1`);
}

/** Rewrites a computed-variable formula's `{oldId}` field reference to `{newId}`. */
function renameFieldRefInFormula(
	formula: string,
	oldId: string,
	newId: string
): string {
	const pattern = new RegExp(`\\{${escapeRegExp(oldId)}\\}`, "g");
	return formula.replace(pattern, `{${newId}}`);
}

function renameConditionNode(
	node: ConditionNode,
	oldId: string,
	newId: string
): ConditionNode {
	if ("operatorIdentifier" in node) {
		return {
			...node,
			children: node.children.map((child) =>
				renameConditionNode(child, oldId, newId)
			),
		};
	}
	if (node.value?.property_meta?.id !== oldId) {
		return node;
	}
	return {
		...node,
		value: {
			...node.value,
			property_meta: { ...node.value.property_meta, id: newId },
		},
	};
}

function renameConditions(
	conditions: ConditionNode | null,
	oldId: string,
	newId: string
): ConditionNode | null {
	return conditions
		? renameConditionNode(conditions, oldId, newId)
		: conditions;
}

function renameLogic(
	logic: FieldLogic | null | undefined,
	oldId: string,
	newId: string
): FieldLogic | null | undefined {
	if (!logic) {
		return logic;
	}
	return {
		...logic,
		conditions: renameConditions(logic.conditions, oldId, newId),
	};
}

/** Recursively rewrites any mention span found in a field's string props. */
function renameFieldMentions(
	field: FormField,
	oldId: string,
	newId: string
): FormField {
	const next: FormField = { ...field };
	for (const [key, value] of Object.entries(field)) {
		if (typeof value === "string" && value.includes("mention-field-id")) {
			next[key] = renameMentionsInText(value, oldId, newId);
		}
	}
	return next;
}

function renameFieldReferences(
	field: FormField,
	oldId: string,
	newId: string
): FormField {
	let next = renameFieldMentions(field, oldId, newId);
	if (next.logic) {
		next = { ...next, logic: renameLogic(next.logic, oldId, newId) ?? null };
	}
	if (next.validation?.error_conditions) {
		next = {
			...next,
			validation: {
				...next.validation,
				error_conditions: {
					...next.validation.error_conditions,
					conditions:
						renameConditions(
							next.validation.error_conditions.conditions,
							oldId,
							newId
						) ?? null,
				},
			},
		};
	}
	return next;
}

function renameComputedVariable(
	variable: ComputedVariable,
	oldId: string,
	newId: string
): ComputedVariable {
	if (!variable.formula.includes(oldId)) {
		return variable;
	}
	return {
		...variable,
		formula: renameFieldRefInFormula(variable.formula, oldId, newId),
	};
}

/** Form-level free-text settings that can carry mentions (confirmation/redirect text, …). */
const MENTION_SETTINGS_KEYS = [
	"redirectUrl",
	"submittedText",
	"closedText",
	"maxSubmissionsReachedText",
	"reFillButtonText",
	"editableSubmissionsButtonText",
	"submitButtonText",
] as const satisfies readonly (keyof FormSettings)[];

/**
 * Propagates a field id rename to every reference in the form: other
 * fields' logic/validation conditions, mention spans (help text, rich
 * text/content blocks, page-break button text), computed-variable
 * formulas, and form-level free-text settings. Does *not* rename the
 * field's own `id` — the caller already did that.
 */
export function renameFieldIdReferences(
	settings: FormSettings,
	oldId: string,
	newId: string
): FormSettings {
	if (oldId === newId) {
		return settings;
	}
	const properties = settings.properties.map((field) =>
		renameFieldReferences(field as FormField, oldId, newId)
	);
	const computedVariables = settings.computedVariables.map((variable) =>
		renameComputedVariable(variable, oldId, newId)
	);
	const next: FormSettings = { ...settings, properties, computedVariables };
	for (const key of MENTION_SETTINGS_KEYS) {
		const value = next[key];
		if (typeof value === "string") {
			(next as Record<string, unknown>)[key] = renameMentionsInText(
				value,
				oldId,
				newId
			);
		}
	}
	return next;
}
