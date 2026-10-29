import type { FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import {
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { useEditor } from "../../state/editor-context";

function StringListEditor({
	description,
	items,
	label,
	onChange,
}: {
	description: string;
	items: string[];
	label: string;
	onChange: (items: string[]) => void;
}) {
	return (
		<FieldSet className="gap-1.5">
			<FieldLabel>{label}</FieldLabel>
			<FieldDescription>{description}</FieldDescription>
			{items.map((item, index) => {
				const rowKey = `${label}-row-${index}`;
				return (
					<div className="flex items-center gap-1" key={rowKey}>
						<Input
							className="flex-1"
							onChange={(e) =>
								onChange(
									items.map((v, i) => (i === index ? e.target.value : v))
								)
							}
							value={item}
						/>
						<Button
							onClick={() => onChange(items.filter((_, i) => i !== index))}
							size="icon-xs"
							type="button"
							variant="ghost"
						>
							<Trash2Icon />
						</Button>
					</div>
				);
			})}
			<Button
				onClick={() =>
					onChange([...items, `${label.slice(0, -1)} ${items.length + 1}`])
				}
				size="sm"
				type="button"
				variant="outline"
			>
				<PlusIcon /> Add {label.toLowerCase().slice(0, -1)}
			</Button>
		</FieldSet>
	);
}

export function MatrixPanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();
	const rows = field.rows ?? [];
	const columns = (field.columns ?? []).map(String);

	return (
		<FieldSet>
			<StringListEditor
				description="One question per row; respondents pick a column for each."
				items={rows}
				label="Rows"
				onChange={(next) => updateField(field.id, { rows: next })}
			/>
			<StringListEditor
				description="The answer choices available for every row."
				items={columns}
				label="Columns"
				onChange={(next) => updateField(field.id, { columns: next })}
			/>
		</FieldSet>
	);
}
