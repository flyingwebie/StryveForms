import type { PdfZone } from "@StryveForms/api/services/pdf/model";
import { blockForField, type FieldType } from "@StryveForms/forms/blocks";
import type { FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import {
	CalendarClockIcon,
	CheckSquareIcon,
	FileTextIcon,
	HashIcon,
	ImageIcon,
	PenLineIcon,
	PlusIcon,
	TypeIcon,
} from "lucide-react";

export type PaletteVariable =
	| "form_title"
	| "generated_at"
	| "pagenumber"
	| "submission_id"
	| "submitted_at";

/** Icon per field type, for the palette row — falls back to a generic "Type" icon. */
const FIELD_ICONS: Partial<Record<FieldType, typeof TypeIcon>> = {
	checkbox: CheckSquareIcon,
	date: CalendarClockIcon,
	files: ImageIcon,
	signature: PenLineIcon,
};

const VARIABLES: {
	description: string;
	icon: typeof TypeIcon;
	kind: PaletteVariable;
	name: string;
}[] = [
	{
		description: "A unique id for this response.",
		icon: HashIcon,
		kind: "submission_id",
		name: "Submission ID",
	},
	{
		description: "When the respondent submitted the form.",
		icon: CalendarClockIcon,
		kind: "submitted_at",
		name: "Submission date",
	},
	{
		description: "This form's title.",
		icon: FileTextIcon,
		kind: "form_title",
		name: "Form title",
	},
	{
		description: "When this PDF was generated (right now).",
		icon: CalendarClockIcon,
		kind: "generated_at",
		name: "Date generated",
	},
	{
		description: 'The page number, e.g. "Page 2 of 5".',
		icon: HashIcon,
		kind: "pagenumber",
		name: "Page number",
	},
];

function PaletteRow({
	description,
	icon: Icon,
	name,
	onAdd,
	placedCount,
}: {
	description: string;
	icon: typeof TypeIcon;
	name: string;
	onAdd: () => void;
	placedCount: number;
}) {
	return (
		<button
			className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left hover:border-border hover:bg-muted"
			onClick={onAdd}
			type="button"
		>
			<Icon className="size-4 shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium text-xs">{name}</span>
				<span className="block truncate text-[11px] text-muted-foreground">
					{description}
				</span>
			</span>
			{placedCount > 0 ? (
				<Badge className="shrink-0 text-[10px]" variant="secondary">
					{placedCount} placed
				</Badge>
			) : (
				<PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
			)}
		</button>
	);
}

function countForField(zones: PdfZone[], fieldId: string): number {
	return zones.filter((zone) => zone.fieldId === fieldId).length;
}

/** field.type is widened to `string & {}` for forward-compat with unknown types; narrow it back to look up an icon. */
function fieldIcon(type: string): typeof TypeIcon {
	return FIELD_ICONS[type as FieldType] ?? TypeIcon;
}

function countForVariable(zones: PdfZone[], kind: PaletteVariable): number {
	if (kind === "pagenumber") {
		return zones.filter((zone) => zone.type === "pagenumber").length;
	}
	return zones.filter((zone) => zone.type === "meta" && zone.metaKey === kind)
		.length;
}

/**
 * Right-panel palette: every one of the form's fields, plus a few useful
 * variables (submission date/id, form title, generation date, page number).
 * Click a row to drop a zone for it at a default spot on the current page;
 * a "N placed" badge shows it's already used somewhere in the template.
 */
export default function FieldPalette({
	fields,
	onAddField,
	onAddVariable,
	zones,
}: {
	fields: FormField[];
	onAddField: (field: FormField) => void;
	onAddVariable: (kind: PaletteVariable) => void;
	zones: PdfZone[];
}) {
	return (
		<div className="space-y-4">
			<div>
				<h4 className="mb-1 px-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
					Form fields
				</h4>
				<div className="space-y-0.5">
					{fields.length === 0 ? (
						<p className="px-2 py-3 text-muted-foreground text-xs">
							This form has no fields yet.
						</p>
					) : null}
					{fields.map((field) => (
						<PaletteRow
							description={blockForField(field)?.title ?? field.type}
							icon={fieldIcon(field.type)}
							key={field.id}
							name={field.name}
							onAdd={() => onAddField(field)}
							placedCount={countForField(zones, field.id)}
						/>
					))}
				</div>
			</div>
			<div>
				<h4 className="mb-1 px-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
					Variables
				</h4>
				<div className="space-y-0.5">
					{VARIABLES.map((variable) => (
						<PaletteRow
							description={variable.description}
							icon={variable.icon}
							key={variable.kind}
							name={variable.name}
							onAdd={() => onAddVariable(variable.kind)}
							placedCount={countForVariable(zones, variable.kind)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
