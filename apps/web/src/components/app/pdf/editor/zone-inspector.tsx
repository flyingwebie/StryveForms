import {
	DEFAULT_PAGE_NUMBER_PATTERN,
	PDF_META_KEYS,
	type PdfZone,
} from "@StryveForms/api/services/pdf/model";
import { type FormField, fieldOptions } from "@StryveForms/forms/types";
import { isFileField } from "@StryveForms/forms/values";
import { Button } from "@StryveForms/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Trash2Icon } from "lucide-react";
import { useRef } from "react";

import { apiBase } from "@/lib/api-url";

export const META_LABELS: Record<(typeof PDF_META_KEYS)[number], string> = {
	form_title: "Form title",
	generated_at: "Date generated",
	submission_id: "Submission id",
	submitted_at: "Submitted at",
};

/** Zone types with no concept of font/colour/alignment: their own section covers everything that applies. */
const NO_TEXT_STYLE: ReadonlySet<PdfZone["type"]> = new Set([
	"line",
	"rect",
	"qrcode",
]);

type Patch = (patch: Partial<PdfZone>) => void;

/** A labelled "pick a field" dropdown, reused by every zone type that binds to one field. */
function FieldSelect({
	fields,
	onChange,
	placeholder = "Choose a field",
	value,
}: {
	fields: FormField[];
	onChange: (id: string | undefined) => void;
	placeholder?: string;
	value: string;
}) {
	return (
		<Select
			items={fields.map((f) => ({ label: f.name, value: f.id }))}
			onValueChange={(v) => onChange(v ?? undefined)}
			value={value}
		>
			<SelectTrigger className="w-full">
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{fields.map((f) => (
					<SelectItem key={f.id} value={f.id}>
						{f.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function FieldAnswerFields({
	fields,
	onChange,
	zone,
}: {
	fields: FormField[];
	onChange: Patch;
	zone: PdfZone;
}) {
	return (
		<Field>
			<FieldLabel>Field</FieldLabel>
			<FieldSelect
				fields={fields}
				onChange={(fieldId) => onChange({ fieldId })}
				value={zone.fieldId ?? ""}
			/>
		</Field>
	);
}

function StaticTextFields({
	fields,
	onChange,
	zone,
}: {
	fields: FormField[];
	onChange: Patch;
	zone: PdfZone;
}) {
	return (
		<Field>
			<FieldLabel>Text</FieldLabel>
			<RichTextEditor
				mentions={fields.map((f) => ({ id: f.id, label: f.name }))}
				onChange={(html) => onChange({ content: html })}
				placeholder="Static text…"
				toolbar="none"
				value={zone.content ?? ""}
			/>
			<FieldDescription>
				Type "@" to insert an answer as a chip — it's replaced with the real
				value when the PDF is generated.
			</FieldDescription>
		</Field>
	);
}

function MetaFields({ onChange, zone }: { onChange: Patch; zone: PdfZone }) {
	return (
		<Field>
			<FieldLabel>Shows</FieldLabel>
			<Select
				items={PDF_META_KEYS.map((key) => ({
					label: META_LABELS[key],
					value: key,
				}))}
				onValueChange={(value) =>
					onChange({ metaKey: value as (typeof PDF_META_KEYS)[number] })
				}
				value={zone.metaKey ?? "submission_id"}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{PDF_META_KEYS.map((key) => (
						<SelectItem key={key} value={key}>
							{META_LABELS[key]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

function CheckboxFields({
	fields,
	onChange,
	zone,
}: {
	fields: FormField[];
	onChange: Patch;
	zone: PdfZone;
}) {
	const field = fields.find((f) => f.id === zone.fieldId);
	const hasOptions = field?.type === "select" || field?.type === "multi_select";
	return (
		<>
			<Field>
				<FieldLabel>Field</FieldLabel>
				<FieldSelect
					fields={fields}
					onChange={(fieldId) => onChange({ fieldId })}
					value={zone.fieldId ?? ""}
				/>
			</Field>
			{hasOptions && field ? (
				<Field>
					<FieldLabel>Checked when the answer is</FieldLabel>
					<Select
						items={fieldOptions(field).map((o) => ({
							label: o.name,
							value: o.id,
						}))}
						onValueChange={(value) =>
							onChange({ checkboxValue: value ?? undefined })
						}
						value={zone.checkboxValue ?? ""}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Choose an option" />
						</SelectTrigger>
						<SelectContent>
							{fieldOptions(field).map((o) => (
								<SelectItem key={o.id} value={o.id}>
									{o.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			) : null}
		</>
	);
}

function SignatureFields({
	fields,
	onChange,
	zone,
}: {
	fields: FormField[];
	onChange: Patch;
	zone: PdfZone;
}) {
	return (
		<Field>
			<FieldLabel>Signature field</FieldLabel>
			<FieldSelect
				fields={fields.filter((f) => f.type === "signature")}
				onChange={(fieldId) => onChange({ fieldId })}
				placeholder="Choose a signature field"
				value={zone.fieldId ?? ""}
			/>
		</Field>
	);
}

function ImageFields({
	fields,
	onChange,
	workspaceId,
	zone,
}: {
	fields: FormField[];
	onChange: Patch;
	workspaceId: string | null;
	zone: PdfZone;
}) {
	const imageInputRef = useRef<HTMLInputElement>(null);
	const fromField = zone.fieldId !== undefined;

	async function handleImageUpload() {
		const file = imageInputRef.current?.files?.[0];
		if (!file) {
			return;
		}
		const body = new FormData();
		body.set("file", file);
		if (workspaceId) {
			body.set("workspaceId", workspaceId);
		}
		const res = await fetch(`${apiBase()}/api/assets`, {
			body,
			credentials: "include",
			method: "POST",
		});
		const json = await res.json();
		if (res.ok && typeof json.url === "string") {
			const name = json.url.split("/").pop();
			if (name) {
				onChange({ imageKey: `assets/${name}` });
			}
		}
	}

	return (
		<>
			<Field>
				<FieldLabel>Source</FieldLabel>
				<Select
					items={[
						{ label: "Upload a fixed image", value: "fixed" },
						{ label: "From a field's upload", value: "field" },
					]}
					onValueChange={(value) =>
						onChange(
							value === "field"
								? { fieldId: "", imageKey: undefined }
								: { fieldId: undefined }
						)
					}
					value={fromField ? "field" : "fixed"}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="fixed">Upload a fixed image</SelectItem>
						<SelectItem value="field">From a field's upload</SelectItem>
					</SelectContent>
				</Select>
				<FieldDescription>
					A fixed picture (e.g. a logo), or the file the respondent uploaded or
					signed.
				</FieldDescription>
			</Field>
			{fromField ? (
				<Field>
					<FieldLabel>Field</FieldLabel>
					<FieldSelect
						fields={fields.filter((f) => isFileField(f))}
						onChange={(fieldId) => onChange({ fieldId: fieldId ?? "" })}
						value={zone.fieldId ?? ""}
					/>
				</Field>
			) : (
				<Field>
					<FieldLabel>Image</FieldLabel>
					<Input
						accept="image/*"
						onChange={handleImageUpload}
						ref={imageInputRef}
						type="file"
					/>
					{zone.imageKey ? (
						<p className="truncate text-muted-foreground text-xs">
							{zone.imageKey}
						</p>
					) : null}
				</Field>
			)}
		</>
	);
}

function LinkFields({
	fields,
	onChange,
	zone,
}: {
	fields: FormField[];
	onChange: Patch;
	zone: PdfZone;
}) {
	return (
		<>
			<Field>
				<FieldLabel>Link text</FieldLabel>
				<RichTextEditor
					mentions={fields.map((f) => ({ id: f.id, label: f.name }))}
					onChange={(html) => onChange({ content: html })}
					placeholder="Click here…"
					toolbar="none"
					value={zone.content ?? ""}
				/>
				<FieldDescription>
					What the link says. Leave blank to show the URL itself.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel>URL</FieldLabel>
				<Input
					onChange={(e) => onChange({ linkUrl: e.target.value })}
					placeholder="https://example.com"
					value={zone.linkUrl ?? ""}
				/>
				<FieldDescription>
					Where it goes when clicked in a PDF viewer. Only http(s), mailto and
					tel links are made clickable.
				</FieldDescription>
			</Field>
		</>
	);
}

function LineFields({ onChange, zone }: { onChange: Patch; zone: PdfZone }) {
	return (
		<div className="grid grid-cols-2 gap-3">
			<Field>
				<FieldLabel>Colour</FieldLabel>
				<Input
					className="h-9 w-full p-1"
					onChange={(e) => onChange({ strokeColor: e.target.value })}
					type="color"
					value={zone.strokeColor ?? "#9ca3af"}
				/>
			</Field>
			<Field>
				<FieldLabel>Thickness</FieldLabel>
				<Input
					max={20}
					min={0.5}
					onChange={(e) =>
						onChange({ strokeWidth: Number(e.target.value) || 1 })
					}
					step={0.5}
					type="number"
					value={zone.strokeWidth ?? 1}
				/>
			</Field>
		</div>
	);
}

function RectFields({ onChange, zone }: { onChange: Patch; zone: PdfZone }) {
	return (
		<div className="grid grid-cols-2 gap-3">
			<Field>
				<FieldLabel>Fill colour</FieldLabel>
				<Input
					className="h-9 w-full p-1"
					onChange={(e) => onChange({ fillColor: e.target.value })}
					type="color"
					value={zone.fillColor ?? "#eef2ff"}
				/>
			</Field>
			<Field>
				<FieldLabel>Fill opacity</FieldLabel>
				<Input
					max={1}
					min={0}
					onChange={(e) => onChange({ fillOpacity: Number(e.target.value) })}
					step={0.05}
					type="number"
					value={zone.fillOpacity ?? 1}
				/>
			</Field>
			<Field>
				<FieldLabel>Border colour</FieldLabel>
				<Input
					className="h-9 w-full p-1"
					onChange={(e) => onChange({ strokeColor: e.target.value })}
					type="color"
					value={zone.strokeColor ?? "#6366f1"}
				/>
			</Field>
			<Field>
				<FieldLabel>Border width</FieldLabel>
				<Input
					max={20}
					min={0}
					onChange={(e) => onChange({ strokeWidth: Number(e.target.value) })}
					step={0.5}
					type="number"
					value={zone.strokeWidth ?? 1}
				/>
			</Field>
			<Field className="col-span-2">
				<FieldLabel>Corner radius</FieldLabel>
				<Input
					max={100}
					min={0}
					onChange={(e) => onChange({ cornerRadius: Number(e.target.value) })}
					type="number"
					value={zone.cornerRadius ?? 6}
				/>
			</Field>
		</div>
	);
}

function QrCodeFields({
	fields,
	onChange,
	zone,
}: {
	fields: FormField[];
	onChange: Patch;
	zone: PdfZone;
}) {
	return (
		<Field>
			<FieldLabel>Encoded text or URL</FieldLabel>
			<RichTextEditor
				mentions={fields.map((f) => ({ id: f.id, label: f.name }))}
				onChange={(html) => onChange({ content: html })}
				placeholder="https://example.com or @ an answer"
				toolbar="none"
				value={zone.content ?? ""}
			/>
			<FieldDescription>
				What the QR code decodes to when scanned. Type "@" to insert an answer.
			</FieldDescription>
		</Field>
	);
}

function PageNumberFields({
	onChange,
	zone,
}: {
	onChange: Patch;
	zone: PdfZone;
}) {
	return (
		<Field>
			<FieldLabel>Format</FieldLabel>
			<Input
				onChange={(e) => onChange({ content: e.target.value })}
				placeholder={DEFAULT_PAGE_NUMBER_PATTERN}
				value={zone.content ?? ""}
			/>
			<FieldDescription>
				Use {"{n}"} for the page number and {"{total}"} for the page count, e.g.
				"Page {"{n}"} of {"{total}"}".
			</FieldDescription>
		</Field>
	);
}

function TextStyleFields({
	onChange,
	zone,
}: {
	onChange: Patch;
	zone: PdfZone;
}) {
	return (
		<div className="grid grid-cols-2 gap-3">
			<Field>
				<FieldLabel>Font size</FieldLabel>
				<Input
					max={96}
					min={4}
					onChange={(e) =>
						onChange({
							style: { ...zone.style, fontSize: Number(e.target.value) || 1 },
						})
					}
					type="number"
					value={zone.style.fontSize}
				/>
			</Field>
			<Field>
				<FieldLabel>Weight</FieldLabel>
				<Select
					items={[
						{ label: "Normal", value: "normal" },
						{ label: "Bold", value: "bold" },
					]}
					onValueChange={(value) =>
						onChange({
							style: { ...zone.style, fontWeight: value as "bold" | "normal" },
						})
					}
					value={zone.style.fontWeight}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="normal">Normal</SelectItem>
						<SelectItem value="bold">Bold</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel>Colour</FieldLabel>
				<Input
					className="h-9 w-full p-1"
					onChange={(e) =>
						onChange({ style: { ...zone.style, color: e.target.value } })
					}
					type="color"
					value={zone.style.color}
				/>
			</Field>
			<Field>
				<FieldLabel>Align</FieldLabel>
				<Select
					items={[
						{ label: "Left", value: "left" },
						{ label: "Center", value: "center" },
						{ label: "Right", value: "right" },
					]}
					onValueChange={(value) =>
						onChange({
							style: {
								...zone.style,
								align: value as "center" | "left" | "right",
							},
						})
					}
					value={zone.style.align}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="left">Left</SelectItem>
						<SelectItem value="center">Center</SelectItem>
						<SelectItem value="right">Right</SelectItem>
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel>Line height</FieldLabel>
				<Input
					max={3}
					min={0.8}
					onChange={(e) =>
						onChange({
							style: {
								...zone.style,
								lineHeight: Number(e.target.value) || 1,
							},
						})
					}
					step={0.1}
					type="number"
					value={zone.style.lineHeight}
				/>
			</Field>
			<Field>
				<FieldLabel>Overflow</FieldLabel>
				<Select
					items={[
						{ label: "Shrink to fit", value: "shrink" },
						{ label: "Wrap", value: "wrap" },
						{ label: "Clip", value: "clip" },
					]}
					onValueChange={(value) =>
						onChange({
							style: {
								...zone.style,
								overflow: value as "clip" | "shrink" | "wrap",
							},
						})
					}
					value={zone.style.overflow}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="shrink">Shrink to fit</SelectItem>
						<SelectItem value="wrap">Wrap</SelectItem>
						<SelectItem value="clip">Clip</SelectItem>
					</SelectContent>
				</Select>
			</Field>
		</div>
	);
}

function PageField({
	onChange,
	pageCount,
	zone,
}: {
	onChange: Patch;
	pageCount: number;
	zone: PdfZone;
}) {
	return (
		<Field>
			<FieldLabel>Page</FieldLabel>
			<Select
				items={Array.from({ length: pageCount }, (_, i) => ({
					label: `Page ${i + 1}`,
					value: String(i),
				}))}
				onValueChange={(value) => onChange({ page: Number(value) })}
				value={String(zone.page)}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{Array.from({ length: pageCount }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: the page number IS the identity here
						<SelectItem key={i} value={String(i)}>
							Page {i + 1}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

/** Property editor for the selected zone: type-specific fields, common text style controls, and the page picker. */
export default function ZoneInspector({
	fields,
	onChange,
	onDelete,
	pageCount,
	workspaceId,
	zone,
}: {
	fields: FormField[];
	onChange: Patch;
	onDelete: () => void;
	pageCount: number;
	workspaceId: string | null;
	zone: PdfZone;
}) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-medium text-sm">Zone</h3>
				<Button onClick={onDelete} size="icon-sm" variant="ghost">
					<Trash2Icon className="text-destructive" />
				</Button>
			</div>

			{zone.type === "field" ? (
				<FieldAnswerFields fields={fields} onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "static" ? (
				<StaticTextFields fields={fields} onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "meta" ? (
				<MetaFields onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "checkbox" ? (
				<CheckboxFields fields={fields} onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "signature" ? (
				<SignatureFields fields={fields} onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "image" ? (
				<ImageFields
					fields={fields}
					onChange={onChange}
					workspaceId={workspaceId}
					zone={zone}
				/>
			) : null}
			{zone.type === "link" ? (
				<LinkFields fields={fields} onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "line" ? (
				<LineFields onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "rect" ? (
				<RectFields onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "qrcode" ? (
				<QrCodeFields fields={fields} onChange={onChange} zone={zone} />
			) : null}
			{zone.type === "pagenumber" ? (
				<PageNumberFields onChange={onChange} zone={zone} />
			) : null}
			{NO_TEXT_STYLE.has(zone.type) ? null : (
				<TextStyleFields onChange={onChange} zone={zone} />
			)}

			<PageField onChange={onChange} pageCount={pageCount} zone={zone} />
		</div>
	);
}
