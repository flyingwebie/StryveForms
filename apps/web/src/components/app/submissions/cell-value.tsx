import type { FormField } from "@StryveForms/forms/types";
import {
	displayFileName,
	formatFieldValue,
	isFileField,
} from "@StryveForms/forms/values";
import { StarIcon } from "lucide-react";

import { ratingStars } from "./submission-format";

function RatingCellStar({ filled }: { filled: boolean }) {
	return (
		<StarIcon
			className={
				filled
					? "size-3.5 fill-primary text-primary"
					: "size-3.5 text-muted-foreground/40"
			}
		/>
	);
}

/** Compact star row for a "rating" field, e.g. "★★★★★ 5 / 5". */
function RatingCell({ field, value }: { field: FormField; value: unknown }) {
	const { max, value: filled } = ratingStars(value, field.rating_max_value);
	const stars = Array.from({ length: max }, (_, i) => i < filled);
	return (
		<div className="flex items-center gap-0.5">
			{stars.map((isFilled, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length rating scale, position is the identity
				<RatingCellStar filled={isFilled} key={i} />
			))}
		</div>
	);
}

/** Renders one submission answer: plain text, a list, file links, or stars for a rating. */
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

	if (field.type === "rating") {
		return <RatingCell field={field} value={value} />;
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
