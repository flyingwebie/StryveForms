import type { FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PlusIcon } from "lucide-react";

import { listItemId } from "../dnd/drag-data";
import { useEditor } from "../state/editor-context";
import { FieldRow } from "./field-row";

/** Clean outline of the form's fields; adding blocks happens in the slide-out panel. */
export function BuildTab() {
	const { openAddBlockPanel, readOnly, state } = useEditor();
	const properties = state.settings.properties as FormField[];

	return (
		// pb-24 (~6rem): keeps the Add block button clear of the floating
		// TanStack devtools button that overlaps the bottom of this panel.
		<div className="flex flex-col gap-3 p-3 pb-24">
			<div className="flex items-center justify-between gap-2">
				<p className="font-medium text-subtle-foreground text-xs uppercase tracking-wide">
					Fields
				</p>
				<span className="text-muted-foreground text-xs">
					{properties.length}
				</span>
			</div>
			{properties.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					No fields yet. Add your first block to get started.
				</p>
			) : (
				<SortableContext
					items={properties.map((f) => listItemId(f.id))}
					strategy={verticalListSortingStrategy}
				>
					<div className="flex flex-col gap-0.5">
						{properties.map((field) => (
							<FieldRow field={field} key={field.id} />
						))}
					</div>
				</SortableContext>
			)}
			{readOnly ? null : (
				<Button onClick={() => openAddBlockPanel(null)} type="button">
					<PlusIcon /> Add block
				</Button>
			)}
		</div>
	);
}
