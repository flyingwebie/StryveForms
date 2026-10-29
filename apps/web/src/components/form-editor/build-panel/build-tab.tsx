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
		// pb-24 (~6rem): keeps the last field row clear of the floating
		// TanStack devtools button that overlaps the bottom of this panel.
		<div className="flex flex-col gap-3 p-3 pb-24">
			<div className="flex items-center justify-between gap-2">
				<p className="font-medium text-muted-foreground text-xs">Fields</p>
				{readOnly ? null : (
					<Button
						onClick={() => openAddBlockPanel(null)}
						size="sm"
						type="button"
						variant="outline"
					>
						<PlusIcon /> Add block
					</Button>
				)}
			</div>
			{properties.length === 0 ? (
				<p className="p-6 text-center text-muted-foreground text-xs">
					No fields yet. Click "Add block" to open the block library.
				</p>
			) : (
				<SortableContext
					items={properties.map((f) => listItemId(f.id))}
					strategy={verticalListSortingStrategy}
				>
					<div className="flex flex-col gap-1">
						{properties.map((field) => (
							<FieldRow field={field} key={field.id} />
						))}
					</div>
				</SortableContext>
			)}
		</div>
	);
}
