import type { FormField } from "@StryveForms/forms/types";
import {
	displayFileName,
	formatFieldValue,
	isFileField,
} from "@StryveForms/forms/values";

/** Renders one submission answer: plain text, a list, or file links. */
export default function CellValue({
	field,
	value,
}: {
	field: FormField;
	value: unknown;
}) {
	if (value === undefined || value === null || value === "") {
		return <span className="text-muted-foreground">—</span>;
	}

	if (isFileField(field)) {
		const files = Array.isArray(value) ? value : [value];
		return (
			<div className="flex flex-wrap gap-2">
				{files.map((file) => {
					const fileName =
						typeof file === "string"
							? file
							: (file as { file_name?: string }).file_name;
					const fileUrl =
						typeof file === "string"
							? file
							: (file as { file_url?: string }).file_url;
					if (!fileName) {
						return null;
					}
					return (
						<a
							className="underline"
							href={fileUrl ?? "#"}
							key={fileName}
							rel="noopener noreferrer"
							target="_blank"
						>
							{displayFileName(fileName)}
						</a>
					);
				})}
			</div>
		);
	}

	const display = formatFieldValue(field, value);
	if (display === null) {
		return <span className="text-muted-foreground">—</span>;
	}
	if (typeof display === "string") {
		return <span>{display}</span>;
	}
	return (
		<span>
			{display
				.map((item) => (typeof item === "string" ? item : item.name))
				.join(", ")}
		</span>
	);
}
