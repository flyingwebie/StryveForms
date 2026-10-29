import type { FormField } from "@StryveForms/forms/types";

const WIDTH_CLASS: Record<string, string> = {
	"1/2": "col-span-6",
	"1/3": "col-span-4",
	"1/4": "col-span-3",
	"2/3": "col-span-8",
	"3/4": "col-span-9",
	full: "col-span-12",
};

const LAYOUT_TYPES = new Set([
	"nf-page-break",
	"nf-divider",
	"nf-image",
	"nf-video",
	"nf-audio",
	"nf-code",
]);

const MAX_PREVIEW_FIELDS = 5;

/** A mini stylised skeleton of a field, scaled to the field's own grid width. */
function FieldGhost({ color, field }: { color: string; field: FormField }) {
	const span = WIDTH_CLASS[field.width ?? "full"] ?? WIDTH_CLASS.full;
	if (field.type === "checkbox") {
		return (
			<div className={`${span} flex items-center gap-1`}>
				<span
					className="size-2 shrink-0 rounded-[2px]"
					style={{ borderColor: color, borderWidth: 1 }}
				/>
				<span className="h-1.5 w-10 rounded-full bg-current/15" />
			</div>
		);
	}
	const isTall = field.type === "rich_text" || field.multi_lines;
	return (
		<div className={`${span} flex flex-col gap-1`}>
			<span className="h-1.5 w-8 rounded-full bg-current/25" />
			<span
				className={`block w-full rounded-[3px] ${isTall ? "h-4" : "h-2.5"}`}
				style={{
					backgroundColor: `${color}1a`,
					border: `1px solid ${color}40`,
				}}
			/>
		</div>
	);
}

/**
 * A tiny rendered preview of a form's first fields, in the form's own
 * colour — the card's "thumbnail". Falls back to the cover image / logo
 * when the form has one.
 */
export function FormThumbnail({
	className,
	color,
	coverPicture,
	logoPicture,
	properties,
}: {
	className?: string;
	color: string;
	coverPicture?: string | null;
	logoPicture?: string | null;
	properties: FormField[];
}) {
	if (coverPicture) {
		return (
			<div className={`relative overflow-hidden bg-muted ${className ?? ""}`}>
				<img
					alt=""
					className="size-full object-cover"
					height={160}
					loading="lazy"
					src={coverPicture}
					width={400}
				/>
				{logoPicture ? (
					<img
						alt=""
						className="absolute bottom-2 left-2 size-6 rounded-md bg-background/80 object-contain p-0.5 shadow"
						height={24}
						loading="lazy"
						src={logoPicture}
						width={24}
					/>
				) : null}
			</div>
		);
	}

	const previewFields = properties
		.filter((f) => !(f.hidden || LAYOUT_TYPES.has(f.type)))
		.slice(0, MAX_PREVIEW_FIELDS);

	return (
		<div
			className={`relative overflow-hidden ${className ?? ""}`}
			style={{ backgroundColor: `${color}0d`, color }}
		>
			<div
				className="absolute inset-x-0 top-0 h-1"
				style={{ backgroundColor: color }}
			/>
			{previewFields.length > 0 ? (
				<div className="grid grid-cols-12 gap-2 p-3 pt-4">
					{previewFields.map((field) => (
						<FieldGhost color={color} field={field} key={field.id} />
					))}
				</div>
			) : (
				<div className="flex h-full items-center justify-center p-3 text-[11px] opacity-50">
					No fields yet
				</div>
			)}
		</div>
	);
}
