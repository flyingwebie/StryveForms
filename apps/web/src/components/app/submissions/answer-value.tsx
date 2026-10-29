import { type FormField, fieldOptions } from "@StryveForms/forms/types";
import {
	displayFileName,
	fileList,
	formatFieldValue,
	isFileField,
} from "@StryveForms/forms/values";
import { Badge } from "@StryveForms/ui/components/badge";
import { FileIcon, StarIcon } from "lucide-react";

import { ratingStars } from "./submission-format";

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\//i;
const THUMB_PX = 80;

function isEmpty(value: unknown) {
	return value === undefined || value === null || value === "";
}

/** A stored file, either a bare name (legacy) or `{ file_name, file_url }`. */
function fileNameAndUrl(file: unknown): { name: string; url: string } | null {
	if (typeof file === "string") {
		return { name: file, url: file };
	}
	const name = (file as { file_name?: string } | undefined)?.file_name;
	if (!name) {
		return null;
	}
	const url = (file as { file_url?: string }).file_url ?? name;
	return { name, url };
}

/** File thumbnails with preview (images) and a download link for everything else. */
function FileAnswer({ value }: { value: unknown }) {
	const files = Array.isArray(value) ? value : [value];
	const resolved = files.map(fileNameAndUrl).filter((f) => f !== null);
	if (resolved.length === 0) {
		return <NoAnswer />;
	}
	return (
		<div className="flex flex-wrap gap-2">
			{resolved.map(({ name, url }) => {
				const isImage = IMAGE_EXTENSION.test(name);
				return (
					<a
						className="group relative flex flex-col items-center gap-1"
						href={url}
						key={name}
						rel="noopener noreferrer"
						target="_blank"
					>
						{isImage ? (
							<img
								alt={displayFileName(name)}
								className="size-20 rounded-lg border border-border object-cover"
								height={THUMB_PX}
								src={url}
								width={THUMB_PX}
							/>
						) : (
							<span className="flex size-20 items-center justify-center rounded-lg border border-border bg-muted">
								<FileIcon className="size-6 text-muted-foreground" />
							</span>
						)}
						<span className="max-w-20 truncate text-muted-foreground text-xs underline-offset-2 group-hover:underline">
							{displayFileName(name)}
						</span>
					</a>
				);
			})}
		</div>
	);
}

/** A drawn/uploaded signature, shown larger than a regular file thumbnail. */
function SignatureAnswer({ value }: { value: unknown }) {
	const [first] = Array.isArray(value) ? value : [value];
	const resolved = fileNameAndUrl(first) ?? fileNameAndUrl(fileList(value)[0]);
	if (!resolved) {
		return <NoAnswer />;
	}
	return (
		<a href={resolved.url} rel="noopener noreferrer" target="_blank">
			<img
				alt="Signature"
				className="h-24 max-w-full rounded-lg border border-border bg-white object-contain p-2"
				height={96}
				src={resolved.url}
				width={300}
			/>
		</a>
	);
}

function RatingStarIcon({ filled }: { filled: boolean }) {
	return (
		<StarIcon
			className={
				filled
					? "size-4 fill-primary text-primary"
					: "size-4 text-muted-foreground/40"
			}
		/>
	);
}

function RatingAnswer({ field, value }: { field: FormField; value: unknown }) {
	const { max, value: filled } = ratingStars(value, field.rating_max_value);
	const stars = Array.from({ length: max }, (_, i) => i < filled);
	return (
		<div className="flex items-center gap-0.5" title={`${filled} / ${max}`}>
			{stars.map((isFilled, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length rating scale, position is the identity
				<RatingStarIcon filled={isFilled} key={i} />
			))}
			<span className="ml-1.5 text-muted-foreground text-xs">
				{filled} / {max}
			</span>
		</div>
	);
}

function ScaleAnswer({ field, value }: { field: FormField; value: unknown }) {
	const max =
		field.type === "slider"
			? (field.slider_max_value ?? 100)
			: (field.scale_max_value ?? 10);
	const raw = typeof value === "number" ? value : Number(value);
	const score = Number.isFinite(raw) ? raw : 0;
	const pct = Math.max(0, Math.min(100, (score / Math.max(1, max)) * 100));
	return (
		<div className="max-w-48 space-y-1">
			<span className="font-medium text-sm">
				{score} <span className="text-muted-foreground">/ {max}</span>
			</span>
			<div className="h-1.5 w-full rounded-full bg-muted">
				<div
					className="h-full rounded-full bg-primary"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}

function ChipsAnswer({ field, value }: { field: FormField; value: unknown }) {
	const values = Array.isArray(value) ? value.map(String) : [String(value)];
	const options = fieldOptions(field);
	return (
		<div className="flex flex-wrap gap-1.5">
			{values.map((v) => (
				<Badge key={v} variant="secondary">
					{options.find((o) => o.id === v)?.name ?? v}
				</Badge>
			))}
		</div>
	);
}

/** Row × column grid stored as `{ row: column }`; shown as a small two-column table. */
function MatrixAnswer({ field, value }: { field: FormField; value: unknown }) {
	const rows = field.rows ?? [];
	const answers =
		typeof value === "object" && value !== null
			? (value as Record<string, unknown>)
			: {};
	if (rows.length === 0) {
		return <NoAnswer />;
	}
	return (
		<table className="w-full max-w-sm overflow-hidden rounded-lg border border-border text-sm">
			<tbody>
				{rows.map((row) => (
					<tr className="border-border border-b last:border-0" key={row}>
						<td className="bg-muted/50 p-2 font-medium">{row}</td>
						<td className="p-2">
							{isEmpty(answers[row]) ? (
								<span className="text-muted-foreground">No answer</span>
							) : (
								String(answers[row])
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function PaymentAnswer({ value }: { value: unknown }) {
	const paid = typeof value === "string" && value.startsWith("pi_");
	if (!paid) {
		return <span className="text-muted-foreground">No payment recorded</span>;
	}
	return (
		<div className="flex items-center gap-2">
			<Badge variant="default">Paid</Badge>
			<span className="font-mono text-muted-foreground text-xs">
				{String(value)}
			</span>
		</div>
	);
}

function NoAnswer() {
	return <span className="text-muted-foreground">No answer</span>;
}

/** Plain text that keeps the respondent's line breaks (long text, rich text). */
function LongTextAnswer({ text }: { text: string }) {
	return <p className="whitespace-pre-wrap">{text}</p>;
}

function LinkAnswer({ href, text }: { href: string; text: string }) {
	return (
		<a className="text-primary underline underline-offset-2" href={href}>
			{text}
		</a>
	);
}

/** Fields with a dedicated visual (not plain formatted text). */
const CUSTOM_RENDERERS: Partial<
	Record<
		string,
		(props: { field: FormField; value: unknown }) => React.JSX.Element
	>
> = {
	matrix: MatrixAnswer,
	multi_select: ChipsAnswer,
	payment: ({ value }) => <PaymentAnswer value={value} />,
	rating: RatingAnswer,
	scale: ScaleAnswer,
	slider: ScaleAnswer,
};

/** A clickable link for emails, phone numbers and URLs that look valid. */
function linkAnswer(
	field: FormField,
	value: unknown
): React.JSX.Element | null {
	if (typeof value !== "string") {
		return null;
	}
	if (field.type === "email" && EMAIL_RE.test(value)) {
		return <LinkAnswer href={`mailto:${value}`} text={value} />;
	}
	if (field.type === "phone_number") {
		return <LinkAnswer href={`tel:${value}`} text={value} />;
	}
	if (field.type === "url" && URL_RE.test(value)) {
		return <LinkAnswer href={value} text={value} />;
	}
	return null;
}

/** Long text (rich text, or a multi-line text field) keeps its line breaks. */
function longTextAnswer(
	field: FormField,
	value: unknown
): React.JSX.Element | null {
	const isLongText =
		field.type === "rich_text" ||
		(field.type === "text" && Boolean(field.multi_lines));
	if (!(isLongText && typeof value === "string")) {
		return null;
	}
	return <LongTextAnswer text={formatFieldValue(field, value) as string} />;
}

/** The generic fallback: formatted text, a formatted list, or "No answer". */
function genericAnswer(field: FormField, value: unknown): React.JSX.Element {
	const display = formatFieldValue(field, value);
	if (display === null) {
		return <NoAnswer />;
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

/**
 * Renders one submission answer by field type: files as thumbnails,
 * signatures as an image, ratings/scale as stars or a score, checkboxes and
 * multi-select as chips, matrix as a small table, dates/booleans formatted,
 * emails/phones/URLs as links, long text with line breaks kept, and payment
 * fields as a paid/unpaid badge.
 */
export default function AnswerValue({
	field,
	value,
}: {
	field: FormField;
	value: unknown;
}) {
	if (isEmpty(value)) {
		return <NoAnswer />;
	}
	if (isFileField(field)) {
		return field.type === "signature" ? (
			<SignatureAnswer value={value} />
		) : (
			<FileAnswer value={value} />
		);
	}
	if (field.type === "checkbox") {
		return (
			<Badge variant={value === true ? "default" : "outline"}>
				{value === true ? "Yes" : "No"}
			</Badge>
		);
	}
	const Custom = CUSTOM_RENDERERS[field.type];
	if (Custom) {
		return <Custom field={field} value={value} />;
	}
	return (
		linkAnswer(field, value) ??
		longTextAnswer(field, value) ??
		genericAnswer(field, value)
	);
}
