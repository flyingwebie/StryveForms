import type { PdfZone } from "@StryveForms/api/services/pdf/model";
import type { FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { cn } from "@StryveForms/ui/lib/utils";
import { PlusIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import FieldPalette, { type PaletteVariable } from "./field-palette";
import {
	staticLabelFieldMatch,
	ZONE_ICONS,
	ZONE_TYPE_DESCRIPTIONS,
	ZONE_TYPE_LABELS,
} from "./types";
import ZoneInspector from "./zone-inspector";

/** Zone types whose fieldId (when present) is only a grouping hint: an auto-generated label/answer pair, or an image sourced from a field. */
const GROUPABLE_TYPES: ReadonlySet<PdfZone["type"]> = new Set([
	"static",
	"field",
	"checkbox",
	"signature",
	"image",
]);

interface ZoneGroup {
	fieldName: string | null;
	items: PdfZone[];
	key: string;
}

/** The field a zone should be grouped under, if any (see GROUPABLE_TYPES and staticLabelFieldMatch for older templates without the stored hint). */
function groupFieldFor(
	zone: PdfZone,
	fields: FormField[]
): FormField | undefined {
	if (!GROUPABLE_TYPES.has(zone.type)) {
		return undefined;
	}
	if (zone.fieldId) {
		return fields.find((f) => f.id === zone.fieldId);
	}
	return staticLabelFieldMatch(zone, fields);
}

/** Groups an auto-generated label + answer pair (and any other same-field zones) under one field name. */
function groupZones(zones: PdfZone[], fields: FormField[]): ZoneGroup[] {
	const groups: ZoneGroup[] = [];
	const indexByKey = new Map<string, number>();
	for (const zone of zones) {
		const field = groupFieldFor(zone, fields);
		const key = field ? `field:${field.id}` : `zone:${zone.id}`;
		let index = indexByKey.get(key);
		if (index === undefined) {
			index = groups.length;
			indexByKey.set(key, index);
			groups.push({ fieldName: field?.name ?? null, items: [], key });
		}
		groups[index]?.items.push(zone);
	}
	return groups;
}

/** A sub-row's label once it's grouped under a field name (the field name itself is the group header). */
function groupedRowLabel(zone: PdfZone): string {
	switch (zone.type) {
		case "static":
			return "Label";
		case "field":
			return "Answer";
		case "checkbox":
			return zone.checkboxValue
				? `Checkmark (${zone.checkboxValue})`
				: "Checkmark";
		case "signature":
			return "Signature";
		case "image":
			return "Image";
		default:
			return ZONE_TYPE_LABELS[zone.type];
	}
}

function ZoneRow({
	indented,
	label,
	onSelect,
	selected,
	zone,
}: {
	indented: boolean;
	label: string;
	onSelect: () => void;
	selected: boolean;
	zone: PdfZone;
}) {
	const Icon = ZONE_ICONS[zone.type];
	return (
		<li>
			<button
				className={cn(
					"flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs",
					indented && "pl-4",
					selected ? "bg-primary/10 text-primary" : "hover:bg-muted"
				)}
				data-selected={selected || undefined}
				data-zone-id={zone.id}
				onClick={onSelect}
				type="button"
			>
				<Icon className="size-3.5 shrink-0" />
				<span className="flex-1 truncate">{label}</span>
				<span className="text-muted-foreground">p{zone.page + 1}</span>
			</button>
		</li>
	);
}

/** Right column: a "Zones" tab (grouped list + inspector) and a "Fields" tab (the form-fields/variables palette). */
export default function ZonesPanel({
	fields,
	labelForZone,
	onAddField,
	onAddVariable,
	onAddZone,
	onDeleteZone,
	onSelectZone,
	onUpdateZone,
	pageCount,
	selectedZone,
	selectedZoneId,
	workspaceId,
	zones,
}: {
	fields: FormField[];
	labelForZone: (zone: PdfZone) => string;
	onAddField: (field: FormField) => void;
	onAddVariable: (kind: PaletteVariable) => void;
	onAddZone: (type: PdfZone["type"]) => void;
	onDeleteZone: (id: string) => void;
	onSelectZone: (id: string) => void;
	onUpdateZone: (id: string, patch: Partial<PdfZone>) => void;
	pageCount: number;
	selectedZone: PdfZone | null;
	selectedZoneId: string | null;
	workspaceId: string | null;
	zones: PdfZone[];
}) {
	const listRef = useRef<HTMLUListElement>(null);
	const groups = groupZones(zones, fields);

	// "Selecting on canvas highlights in the list" (the reverse already works
	// via the button's selected styling): scroll the selected row into view.
	useEffect(() => {
		if (!selectedZoneId) {
			return;
		}
		const row = listRef.current?.querySelector(
			`[data-zone-id="${selectedZoneId}"]`
		);
		row?.scrollIntoView({ block: "nearest" });
	}, [selectedZoneId]);

	return (
		<Tabs
			className="w-80 border-l"
			defaultValue={zones.length === 0 ? "fields" : "zones"}
		>
			<div className="border-b px-3 pt-3">
				<TabsList className="w-full">
					<TabsTrigger className="flex-1" value="zones">
						Zones ({zones.length})
					</TabsTrigger>
					<TabsTrigger className="flex-1" value="fields">
						Fields
					</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent
				className="flex flex-1 flex-col gap-4 overflow-y-auto p-3 pb-24"
				value="zones"
			>
				<div className="flex items-center justify-between">
					<p className="text-muted-foreground text-xs">
						What's placed on the page.
					</p>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button size="sm" variant="outline" />}
						>
							<PlusIcon /> Add zone
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							// The shared DropdownMenuContent forces `*:whitespace-nowrap`
							// on every direct child; override it so each item's
							// two-line label + description can actually wrap.
							className="w-72 *:whitespace-normal"
						>
							{Object.entries(ZONE_TYPE_LABELS).map(([type, label]) => (
								<DropdownMenuItem
									className="flex-col items-start gap-0.5 whitespace-normal"
									key={type}
									onClick={() => onAddZone(type as PdfZone["type"])}
								>
									<span className="font-medium text-xs">{label}</span>
									<span className="text-[11px] text-muted-foreground">
										{ZONE_TYPE_DESCRIPTIONS[type as PdfZone["type"]]}
									</span>
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<ul className="space-y-1" ref={listRef}>
					{groups.map((group) => {
						if (group.items.length === 1) {
							const [zone] = group.items;
							if (!zone) {
								return null;
							}
							return (
								<ZoneRow
									indented={false}
									key={zone.id}
									label={labelForZone(zone)}
									onSelect={() => onSelectZone(zone.id)}
									selected={zone.id === selectedZoneId}
									zone={zone}
								/>
							);
						}
						return (
							<li key={group.key}>
								<p className="truncate px-2 pt-1 font-medium text-[11px] text-muted-foreground">
									{group.fieldName}
								</p>
								<ul className="space-y-0.5">
									{group.items.map((zone) => (
										<ZoneRow
											indented
											key={zone.id}
											label={groupedRowLabel(zone)}
											onSelect={() => onSelectZone(zone.id)}
											selected={zone.id === selectedZoneId}
											zone={zone}
										/>
									))}
								</ul>
							</li>
						);
					})}
					{zones.length === 0 ? (
						<li className="py-4 text-center text-muted-foreground text-xs">
							No zones yet. Add one above, drag on the page, or use the "Fields"
							tab.
						</li>
					) : null}
				</ul>

				{selectedZone ? (
					<div className="border-t pt-4">
						<ZoneInspector
							fields={fields}
							onChange={(patch) => onUpdateZone(selectedZone.id, patch)}
							onDelete={() => onDeleteZone(selectedZone.id)}
							pageCount={pageCount}
							workspaceId={workspaceId}
							zone={selectedZone}
						/>
					</div>
				) : null}
			</TabsContent>

			<TabsContent className="flex-1 overflow-y-auto p-3 pb-24" value="fields">
				<p className="mb-3 text-muted-foreground text-xs">
					Click a field or variable to drop it onto the current page.
				</p>
				<FieldPalette
					fields={fields}
					onAddField={onAddField}
					onAddVariable={onAddVariable}
					zones={zones}
				/>
			</TabsContent>
		</Tabs>
	);
}
