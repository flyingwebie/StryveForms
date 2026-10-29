import { resolveMentions } from "@StryveForms/forms/mentions";
import type { FormField } from "@StryveForms/forms/types";
import type { ReactNode } from "react";
import type { FormSize, FormTheme } from "./theme";
import { labelTheme } from "./theme";

/**
 * Container-query variants (`@md:` etc), not viewport (`md:`) ones: a field's
 * width must respond to the actual width of the form's own box — the mobile
 * preview panel, an embedded/narrow column, or a real phone — not the
 * browser window, which can stay wide while the form itself is narrow.
 * Requires `@container` on an ancestor (set on the form root / canvas).
 */
const WIDTH_CLASS: Record<string, string> = {
	"1/2": "col-span-12 @md:col-span-6",
	"1/3": "col-span-12 @md:col-span-4",
	"1/4": "col-span-12 @md:col-span-3",
	"2/3": "col-span-12 @md:col-span-8",
	"3/4": "col-span-12 @md:col-span-9",
	full: "col-span-12",
};

const ALIGN_CLASS: Record<string, string> = {
	center: "text-center",
	justify: "text-justify",
	left: "text-left",
	right: "text-right",
};

export interface FieldWrapperProps {
	children: ReactNode;
	error?: string;
	field: FormField;
	/** Checkbox / toggle switch: the control renders first, with its label inline to the right. */
	inlineLabel?: boolean;
	mentionValues: Record<string, unknown>;
	presentation: "classic" | "focused";
	required: boolean;
	size: FormSize;
	theme: FormTheme;
	uppercaseLabels: boolean;
}

export function fieldWidthClass(field: FormField): string {
	return WIDTH_CLASS[field.width ?? "full"] ?? WIDTH_CLASS.full;
}

/** Same grid-span classes as {@link fieldWidthClass}, keyed by width directly — used by the editor's live resize preview. */
export function widthClassFor(width: FormField["width"]): string {
	return WIDTH_CLASS[width ?? "full"] ?? WIDTH_CLASS.full;
}

function HelpText({ html, id }: { html: string; id: string }) {
	return (
		<div
			className="text-neutral-500 text-sm dark:text-neutral-400"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: form owner's own HTML help text; mentions are HTML-escaped by resolveMentions
			dangerouslySetInnerHTML={{ __html: html }}
			id={id}
		/>
	);
}

function RequiredMark() {
	return (
		<span
			aria-hidden="true"
			className="ml-1 inline-flex size-3 items-center justify-center rounded-full bg-red-500/20 text-red-500 dark:bg-red-500/20 dark:text-red-400"
		>
			*
		</span>
	);
}

interface LabelLayoutProps {
	children: ReactNode;
	field: FormField;
	help: string;
	helpAbove: boolean;
	helpId: string;
	labelClassName: string;
	required: boolean;
}

/** Checkbox / toggle switch: control first, label inline to its right, help below. */
function InlineLabelLayout({
	children,
	field,
	help,
	helpAbove,
	helpId,
	labelClassName,
	required,
}: LabelLayoutProps) {
	return (
		<>
			{help && helpAbove ? <HelpText html={help} id={helpId} /> : null}
			<label className="flex items-center gap-2" htmlFor={field.id}>
				{children}
				{field.hide_field_name ? null : (
					<span className={labelClassName}>
						{field.name}
						{required ? <RequiredMark /> : null}
					</span>
				)}
			</label>
			{help && !helpAbove ? <HelpText html={help} id={helpId} /> : null}
		</>
	);
}

/** Every other field: label above, then help, then the control. */
function StackedLabelLayout({
	children,
	field,
	help,
	helpAbove,
	helpId,
	labelClassName,
	required,
}: LabelLayoutProps) {
	return (
		<>
			{field.hide_field_name ? null : (
				<label className={labelClassName} htmlFor={field.id}>
					{field.name}
					{required ? <RequiredMark /> : null}
				</label>
			)}
			{help && helpAbove ? <HelpText html={help} id={helpId} /> : null}
			{children}
			{help && !helpAbove ? <HelpText html={help} id={helpId} /> : null}
		</>
	);
}

/** Wraps an input with its label, help text, required marker and error — classic & focused share this. */
export function FieldWrapper({
	children,
	error,
	field,
	inlineLabel,
	mentionValues,
	presentation,
	required,
	size,
	theme,
	uppercaseLabels,
}: FieldWrapperProps) {
	const help = field.help ? resolveMentions(field.help, mentionValues) : "";
	const helpAbove = field.help_position === "above_input";
	const errorId = `${field.id}-error`;
	const helpId = `${field.id}-help`;
	const labelClassName = labelTheme({
		size,
		theme,
		uppercase: uppercaseLabels,
	});
	const Layout = inlineLabel ? InlineLabelLayout : StackedLabelLayout;

	return (
		<div
			className={`${fieldWidthClass(field)} ${ALIGN_CLASS[field.align ?? "left"] ?? ""} flex flex-col gap-1.5 ${presentation === "focused" ? "gap-2" : ""}`}
		>
			<Layout
				field={field}
				help={help}
				helpAbove={helpAbove}
				helpId={helpId}
				labelClassName={labelClassName}
				required={required}
			>
				{children}
			</Layout>
			{error ? (
				<p
					className="break-words text-red-500 text-xs"
					id={errorId}
					role="alert"
				>
					{error}
				</p>
			) : null}
		</div>
	);
}
