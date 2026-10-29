import type { FormField } from "@StryveForms/forms/types";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";

import { useEditor } from "../../state/editor-context";

const DECODERS = [
	{ label: "QR code", value: "qr_reader" },
	{ label: "EAN-13", value: "ean_reader" },
	{ label: "EAN-8", value: "ean_8_reader" },
	{ label: "Code 128", value: "code_128_reader" },
	{ label: "Code 39", value: "code_39_reader" },
	{ label: "UPC", value: "upc_reader" },
	{ label: "UPC-E", value: "upc_e_reader" },
];

export function BarcodePanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();
	const decoders = field.decoders ?? [];

	function toggle(value: string, checked: boolean) {
		const next = checked
			? [...decoders, value]
			: decoders.filter((d) => d !== value);
		updateField(field.id, { decoders: next });
	}

	return (
		<FieldSet className="gap-2">
			<FieldLabel>Scannable formats</FieldLabel>
			<FieldDescription>
				Which barcode/QR formats the camera scanner recognizes. Pick only what
				you need — fewer formats scan faster.
			</FieldDescription>
			{DECODERS.map((decoder) => (
				<Field key={decoder.value} orientation="horizontal">
					<Checkbox
						checked={decoders.includes(decoder.value)}
						id={`${field.id}-${decoder.value}`}
						onCheckedChange={(checked) =>
							toggle(decoder.value, checked === true)
						}
					/>
					<FieldLabel htmlFor={`${field.id}-${decoder.value}`}>
						{decoder.label}
					</FieldLabel>
				</Field>
			))}
		</FieldSet>
	);
}
