/**
 * Converts JotForm forms and submissions into StryveForms' (OpnForm-compatible)
 * form model. Each question gets a "plan": the fields it becomes, how its
 * answers are read and a line for the import overview.
 */

import { mentionHtml } from "@StryveForms/forms/mentions";
import {
	defaultFormSettings,
	type FormSettings,
} from "@StryveForms/forms/settings";
import type { FormField } from "@StryveForms/forms/types";
import { createHash } from "node:crypto";

import type {
	JotformAnswer,
	JotformFormSummary,
	JotformProperties,
	JotformQuestion,
	JotformSubmission,
} from "./types";

type Raw = Record<string, unknown>;

const TAGS = /<[^>]*>/g;
const SPACES = /\s+/g;
const UNSAFE_NAME_CHARS = /[^\w.-]+/g;
const NEW_LINES = /\r?\n/;
const DATE_TIME =
	/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/;
const US_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
const PAYMENT_TYPE =
	/^control_(stripe|paypal|square|payment|authnet|braintree|mollie|payu|bluepay|cardconnect|chargify|clickbank|echeck|eway|firstdata|gocardless|iyzico|moneris|onebip|paymentwall|paysafe|paysera|payjunction|sensepass|skrill|sofort|stripeACH|stripeCheckout|twocheckout|worldpay)/i;
const MAX_BASE_LENGTH = 50;

/** How each question type turned out, for the overview. */
export type FieldStatus = "ok" | "converted" | "skipped";

export interface FieldReport {
	label: string;
	note?: string;
	qid: string;
	sourceType: string;
	status: FieldStatus;
	/** StryveForms type(s) it became, e.g. "text" or "text × 2". */
	targetType: string | null;
}

export interface MappedFile {
	fieldId: string;
	originalName: string;
	/** Name stored in the answer and on disk. */
	storedName: string;
	url: string;
}

interface AnswerContext {
	files: MappedFile[];
	/** Source submission id, used to name files. */
	submissionId: string;
}

interface QuestionPlan {
	/** Writes the answer's values into `data`. */
	answer?: (answer: JotformAnswer, data: Raw, ctx: AnswerContext) => void;
	fields: FormField[];
	report: FieldReport;
}

/* --------------------------------- Helpers -------------------------------- */

const str = (v: unknown): string | null =>
	typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
const num = (v: unknown): number | null => {
	const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
	return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const yes = (v: unknown): boolean =>
	v === true || v === "Yes" || v === "yes" || v === "1" || v === "true";
const plain = (html: unknown): string =>
	typeof html === "string"
		? html.replace(TAGS, " ").replace(SPACES, " ").trim()
		: "";

function escapeHtml(text: string): string {
	return text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

/** Some JotForm settings are JSON strings. */
function json(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function obj(value: unknown): Raw {
	const parsed = json(value);
	return parsed && typeof parsed === "object" && !Array.isArray(parsed)
		? (parsed as Raw)
		: {};
}

function optionList(value: unknown): { id: string; name: string }[] {
	if (typeof value !== "string") {
		return [];
	}
	const seen = new Set<string>();
	const options: { id: string; name: string }[] = [];
	for (const raw of value.split("|")) {
		const name = raw.trim();
		if (name && !seen.has(name)) {
			seen.add(name);
			options.push({ id: name, name });
		}
	}
	return options;
}

/** Stable ids so running the import again updates the same fields. */
export function fieldId(qid: string, part?: string): string {
	return part ? `jf_${qid}_${part}` : `jf_${qid}`;
}

function labelOf(q: JotformQuestion): string {
	return plain(q.text) || str(q.name) || `Question ${q.qid}`;
}

function base(
	q: JotformQuestion,
	type: string,
	extra: Partial<FormField> = {}
) {
	const field: FormField = {
		id: fieldId(q.qid),
		name: labelOf(q),
		type,
		...extra,
	};
	if (yes(q.required)) {
		field.required = true;
	}
	if (yes(q.hidden)) {
		field.hidden = true;
	}
	if (yes(q.readonly)) {
		field.disabled = true;
	}
	const help = plain(q.description) || plain(q.subLabel);
	if (help) {
		field.help = help;
	}
	const hint = str(q.hint);
	if (hint && field.placeholder === undefined) {
		field.placeholder = hint;
	}
	return field;
}

function report(
	q: JotformQuestion,
	status: FieldStatus,
	targetType: string | null,
	note?: string
): FieldReport {
	return {
		label: labelOf(q),
		qid: q.qid,
		sourceType: q.type.replace("control_", ""),
		status,
		targetType,
		...(note ? { note } : {}),
	};
}

/** The readable answer JotForm already formats (used for converted fields). */
function prettyAnswer(answer: JotformAnswer): string | null {
	const pretty = str(answer.prettyFormat);
	if (pretty) {
		return plain(pretty) || pretty;
	}
	const value = answer.answer;
	if (value === undefined || value === null || value === "") {
		return null;
	}
	if (typeof value === "string" || typeof value === "number") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.map(String).join(", ");
	}
	return Object.values(value as Raw)
		.filter((v) => v !== "" && v !== null && v !== undefined)
		.map(String)
		.join(", ");
}

function list(value: unknown): string[] {
	const parsed = json(value);
	if (Array.isArray(parsed)) {
		return parsed
			.flat()
			.map((v) => String(v).trim())
			.filter(Boolean);
	}
	if (typeof parsed === "string") {
		return parsed
			.split(NEW_LINES)
			.map((v) => v.trim())
			.filter(Boolean);
	}
	return [];
}

const pad = (n: string | number) => String(n).padStart(2, "0");

/**
 * JotForm dates are wall-clock values chosen by the respondent. They're stored
 * without a time zone (`2024-05-01T13:30:00`) so they display as entered.
 */
export function toLocalIso(value: unknown): string | null {
	const answer = obj(value);
	const datetime =
		str(answer.datetime) ?? (typeof value === "string" ? value : null);
	if (datetime) {
		const match = DATE_TIME.exec(datetime.trim());
		if (match) {
			const [, y, m, d, h = "00", min = "00"] = match;
			return `${y}-${m}-${d}T${h}:${min}:00`;
		}
		const us = US_DATE.exec(datetime.trim());
		if (us) {
			return `${us[3]}-${pad(us[1] ?? "1")}-${pad(us[2] ?? "1")}T00:00:00`;
		}
	}
	const year = num(answer.year);
	const month = num(answer.month);
	const day = num(answer.day);
	if (!(year && month && day)) {
		return null;
	}
	let hour = num(answer.hour) ?? 0;
	const minute = num(answer.min) ?? num(answer.minute) ?? 0;
	const ampm = str(answer.ampm)?.toUpperCase();
	if (ampm === "PM" && hour < 12) {
		hour += 12;
	}
	if (ampm === "AM" && hour === 12) {
		hour = 0;
	}
	return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
}

/**
 * Keeps a readable name and makes it unique. The same `seed` always gives the
 * same name, so running the import again doesn't copy a file twice.
 */
export function storedFileName(name: string, seed: string): string {
	const dot = name.lastIndexOf(".");
	const hasExt = dot > 0 && dot < name.length - 1;
	const ext = hasExt
		? name
				.slice(dot + 1)
				.toLowerCase()
				.replace(UNSAFE_NAME_CHARS, "")
		: "";
	const stem = (hasExt ? name.slice(0, dot) : name)
		.replace(UNSAFE_NAME_CHARS, "_")
		.slice(0, MAX_BASE_LENGTH);
	// A uuid-shaped suffix, so the app shows the name without it.
	const hex = createHash("sha256").update(`jotform:${seed}`).digest("hex");
	const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
	const unique = `${stem || "file"}_${id}`;
	return ext ? `${unique}.${ext}` : unique;
}

function fileNameFromUrl(url: string): string {
	try {
		const last = new URL(url).pathname.split("/").pop() ?? "";
		return decodeURIComponent(last) || "file";
	} catch {
		return url.split("/").pop() || "file";
	}
}

/* ------------------------------ Question plans ---------------------------- */

const NAME_PARTS = ["prefix", "first", "middle", "last", "suffix"] as const;
const NAME_DEFAULTS: Record<(typeof NAME_PARTS)[number], string> = {
	first: "First name",
	last: "Last name",
	middle: "Middle name",
	prefix: "Prefix",
	suffix: "Suffix",
};
const ADDRESS_PARTS = [
	{ key: "addr_line1", label: "Street address", width: "full" },
	{ key: "addr_line2", label: "Street address line 2", width: "full" },
	{ key: "city", label: "City", width: "1/2" },
	{ key: "state", label: "State / Province", width: "1/2" },
	{ key: "postal", label: "Postal / Zip code", width: "1/2" },
	{ key: "country", label: "Country", width: "1/2" },
] as const;

/** Splits a composite question (full name, address) into text fields. */
function splitPlan(
	q: JotformQuestion,
	parts: { key: string; label: string; width: FormField["width"] }[],
	note: string
): QuestionPlan {
	const required = yes(q.required);
	const title = labelOf(q);
	const fields = parts.map((part, index) => {
		const field: FormField = {
			id: fieldId(q.qid, part.key),
			name: index === 0 ? `${title} — ${part.label}` : part.label,
			type: "text",
			width: part.width,
		};
		if (required && part.key !== "addr_line2" && part.key !== "middle") {
			field.required = true;
		}
		if (yes(q.hidden)) {
			field.hidden = true;
		}
		return field;
	});
	return {
		answer: (answer, data) => {
			const value = obj(answer.answer);
			for (const part of parts) {
				const text = str(value[part.key]);
				if (text) {
					data[fieldId(q.qid, part.key)] = text;
				}
			}
		},
		fields,
		report: report(q, "converted", `text × ${fields.length}`, note),
	};
}

function fullNamePlan(q: JotformQuestion): QuestionPlan {
	const labels = obj(q.sublabels);
	const parts = NAME_PARTS.filter(
		(p) => p === "first" || p === "last" || yes(q[p])
	);
	const width: FormField["width"] = parts.length > 2 ? "1/3" : "1/2";
	return splitPlan(
		q,
		parts.map((key) => ({
			key,
			label: str(labels[key]) ?? NAME_DEFAULTS[key],
			width: key === "prefix" || key === "suffix" ? "1/4" : width,
		})),
		"Split into separate name fields"
	);
}

function addressPlan(q: JotformQuestion): QuestionPlan {
	const labels = obj(q.sublabels);
	return splitPlan(
		q,
		ADDRESS_PARTS.map((p) => ({
			key: p.key,
			label: str(labels[p.key]) ?? p.label,
			width: p.width,
		})),
		"Split into street, city, state, postal code and country"
	);
}

function textPlan(
	q: JotformQuestion,
	type: string,
	extra: Partial<FormField> = {},
	options: { note?: string; status?: FieldStatus } = {}
): QuestionPlan {
	const field = base(q, type, extra);
	return {
		answer: (answer, data) => {
			const raw = answer.answer;
			const value =
				typeof raw === "string" || typeof raw === "number"
					? String(raw).trim()
					: prettyAnswer(answer);
			if (value) {
				data[field.id] = type === "number" ? (num(value) ?? value) : value;
			}
		},
		fields: [field],
		report: report(q, options.status ?? "ok", type, options.note),
	};
}

/** Questions converted to plain text (their readable answer is kept). */
function convertedPlan(q: JotformQuestion, note: string): QuestionPlan {
	const field = base(q, "text", { multi_lines: true });
	return {
		answer: (answer, data) => {
			const value = prettyAnswer(answer);
			if (value) {
				data[field.id] = value;
			}
		},
		fields: [field],
		report: report(q, "converted", "text", note),
	};
}

function textboxPlan(q: JotformQuestion): QuestionPlan {
	const validation = String(q.validation ?? "").toLowerCase();
	const maxLength = num(q.maxsize);
	const extra: Partial<FormField> = maxLength
		? { max_char_limit: maxLength }
		: {};
	if (validation === "email") {
		return textPlan(q, "email", extra);
	}
	if (validation === "url") {
		return textPlan(q, "url", extra);
	}
	if (validation === "numeric") {
		return textPlan(q, "number");
	}
	return textPlan(q, "text", { multi_lines: false, ...extra });
}

function textareaPlan(q: JotformQuestion): QuestionPlan {
	const editor = String(q.wysiwyg ?? "").toLowerCase();
	const rich = editor !== "" && editor !== "disable" && editor !== "no";
	const [kind, amount] = String(q.entryLimit ?? "").split("-");
	const limit = kind === "Letters" ? num(amount) : null;
	const extra: Partial<FormField> = limit ? { max_char_limit: limit } : {};
	return rich
		? textPlan(q, "rich_text", extra)
		: textPlan(q, "text", { multi_lines: true, ...extra });
}

function phonePlan(q: JotformQuestion): QuestionPlan {
	const field = base(q, "phone_number", { use_simple_text_input: true });
	return {
		answer: (answer, data) => {
			const value = obj(answer.answer);
			const text =
				str(value.full) ??
				([str(value.country), str(value.area), str(value.phone)]
					.filter(Boolean)
					.join(" ") ||
					prettyAnswer(answer));
			if (text) {
				data[field.id] = text;
			}
		},
		fields: [field],
		report: report(q, "ok", "phone_number"),
	};
}

function choicePlan(
	q: JotformQuestion,
	kind: "dropdown" | "radio" | "checkbox" | "autocomplete"
): QuestionPlan {
	const options = optionList(q.options ?? q.items);
	if (options.length === 0) {
		return convertedPlan(
			q,
			"Its choices come from a JotForm preset list, so it was converted to text"
		);
	}
	const multiple = kind === "checkbox" || yes(q.multipleSelections);
	const type = multiple ? "multi_select" : "select";
	const extra: Partial<FormField> = multiple
		? { multi_select: { options } }
		: { select: { options } };
	if (kind === "radio" || kind === "checkbox") {
		extra.without_dropdown = true;
	}
	if (yes(q.allowOther)) {
		extra.allow_creation = true;
	}
	const field = base(q, type, extra);
	let note: string | undefined;
	if (extra.allow_creation) {
		note = "“Other” answers are kept as extra options";
	} else if (kind === "autocomplete") {
		note = "Autocomplete became a dropdown";
	}
	return {
		answer: (answer, data) => {
			const values = list(answer.answer);
			if (values.length === 0) {
				return;
			}
			data[field.id] = multiple ? values : values.join(", ");
		},
		fields: [field],
		report: report(q, note ? "converted" : "ok", type, note),
	};
}

function datePlan(q: JotformQuestion): QuestionPlan {
	const withTime = yes(q.allowTime);
	const format = String(q.format ?? "").toLowerCase();
	const field = base(q, "date", {
		date_format: format.startsWith("mm") ? "MM-dd-yyyy" : "dd/MM/yyyy",
		...(withTime
			? {
					time_format: String(q.timeFormat ?? "").includes("24") ? "24" : "12",
					with_time: true,
				}
			: {}),
	});
	return {
		answer: (answer, data) => {
			const iso = toLocalIso(answer.answer ?? answer.prettyFormat);
			if (iso) {
				data[field.id] = iso;
			}
		},
		fields: [field],
		report: report(q, "ok", "date"),
	};
}

function filesPlan(q: JotformQuestion, signature: boolean): QuestionPlan {
	const field = base(
		q,
		signature ? "signature" : "files",
		signature ? {} : { multiple: !(q.multiple === "No") }
	);
	return {
		answer: (answer, data, ctx) => {
			const urls = list(answer.answer).filter((u) => u.startsWith("http"));
			const names = urls.map((url) => {
				const originalName = fileNameFromUrl(url);
				const storedName = storedFileName(
					originalName,
					`${ctx.submissionId}-${ctx.files.length + 1}`
				);
				ctx.files.push({ fieldId: field.id, originalName, storedName, url });
				return storedName;
			});
			if (names.length > 0) {
				data[field.id] = signature ? names[0] : names;
			}
		},
		fields: [field],
		report: report(
			q,
			"ok",
			signature ? "signature" : "files",
			signature ? undefined : "Uploaded files are copied"
		),
	};
}

function numberPlan(
	q: JotformQuestion,
	type: "rating" | "scale" | "slider" | "number",
	extra: Partial<FormField>
): QuestionPlan {
	const field = base(q, type, extra);
	return {
		answer: (answer, data) => {
			const value = num(answer.answer) ?? num(prettyAnswer(answer));
			if (value !== null) {
				data[field.id] = value;
			}
		},
		fields: [field],
		report: report(q, "ok", type),
	};
}

function matrixPlan(q: JotformQuestion): QuestionPlan {
	const rows = optionList(q.mrows).map((o) => o.name);
	const columns = optionList(q.mcolumns).map((o) => o.name);
	const input = String(q.inputType ?? "Radio Button").toLowerCase();
	if (!input.startsWith("radio") || rows.length === 0 || columns.length === 0) {
		return convertedPlan(
			q,
			"Only single-choice matrices are supported, so its answers were kept as text"
		);
	}
	const field = base(q, "matrix", {
		columns,
		rows,
		selection_data: Object.fromEntries(rows.map((r) => [r, null])),
	});
	return {
		answer: (answer, data) => {
			const parsed = json(answer.answer);
			const result: Record<string, string> = {};
			const set = (rowKey: string, value: unknown) => {
				const row = rows[Number(rowKey)] ?? rowKey;
				const picked = Array.isArray(value) ? value[0] : value;
				if (rows.includes(row) && picked !== undefined && picked !== "") {
					result[row] = String(picked);
				}
			};
			if (Array.isArray(parsed)) {
				for (const [index, value] of parsed.entries()) {
					set(String(index), value);
				}
			} else if (parsed && typeof parsed === "object") {
				for (const [key, value] of Object.entries(parsed)) {
					set(key, value);
				}
			}
			if (Object.keys(result).length > 0) {
				data[field.id] = result;
			} else {
				const pretty = prettyAnswer(answer);
				if (pretty) {
					data[field.id] = pretty;
				}
			}
		},
		fields: [field],
		report: report(q, "ok", "matrix"),
	};
}

function headingPlan(q: JotformQuestion): QuestionPlan {
	const tag =
		String(q.headerType ?? "").toLowerCase() === "large" ? "h2" : "h3";
	const title = escapeHtml(labelOf(q));
	const sub = plain(q.subHeader);
	return {
		fields: [
			{
				content: `<${tag}>${title}</${tag}>${sub ? `<p>${escapeHtml(sub)}</p>` : ""}`,
				id: fieldId(q.qid),
				name: labelOf(q),
				type: "nf-text",
			},
		],
		report: report(q, "ok", "nf-text"),
	};
}

function layoutPlan(
	q: JotformQuestion,
	type: string,
	extra: Partial<FormField> = {},
	note?: string
): QuestionPlan {
	return {
		fields: [
			{
				id: fieldId(q.qid),
				name: labelOf(q) || type,
				type,
				...extra,
			},
		],
		report: report(q, note ? "converted" : "ok", type, note),
	};
}

function skippedPlan(q: JotformQuestion, note: string): QuestionPlan {
	return { fields: [], report: report(q, "skipped", null, note) };
}

/** Builds the plan for one question. */
export function planQuestion(q: JotformQuestion): QuestionPlan | null {
	const { type } = q;
	switch (type) {
		case "control_textbox":
			return textboxPlan(q);
		case "control_textarea":
			return textareaPlan(q);
		case "control_email":
			return textPlan(q, "email");
		case "control_phone":
			return phonePlan(q);
		case "control_number":
		case "control_spinner":
			return numberPlan(q, "number", {
				...(num(q.minValue) === null ? {} : { min: num(q.minValue) }),
				...(num(q.maxValue) === null ? {} : { max: num(q.maxValue) }),
			});
		case "control_fullname":
			return fullNamePlan(q);
		case "control_address":
			return addressPlan(q);
		case "control_dropdown":
			return choicePlan(q, "dropdown");
		case "control_radio":
			return choicePlan(q, "radio");
		case "control_checkbox":
			return choicePlan(q, "checkbox");
		case "control_autocomp":
			return choicePlan(q, "autocomplete");
		case "control_datetime":
		case "control_birthdate":
			return datePlan(q);
		case "control_time":
			return convertedPlan(q, "Time fields are kept as text");
		case "control_fileupload":
			return filesPlan(q, false);
		case "control_signature":
			return filesPlan(q, true);
		case "control_rating":
		case "control_starRating":
			return numberPlan(q, "rating", {
				rating_max_value: num(q.stars) ?? num(q.scaleAmount) ?? 5,
			});
		case "control_scale":
			return numberPlan(q, "scale", {
				scale_max_value: num(q.scaleAmount) ?? 5,
				scale_min_value: num(q.scaleFrom) ?? 1,
				scale_step_value: 1,
			});
		case "control_slider":
			return numberPlan(q, "slider", {
				slider_max_value: num(q.maxValue) ?? 100,
				slider_min_value: num(q.minValue) ?? 0,
				slider_step_value: num(q.stepValue) ?? 1,
			});
		case "control_matrix":
			return matrixPlan(q);
		case "control_head":
			return headingPlan(q);
		case "control_text":
			return layoutPlan(q, "nf-text", {
				content: typeof q.text === "string" ? q.text : "",
				name: "Text",
			});
		case "control_image":
			return str(q.src)
				? layoutPlan(q, "nf-image", { image_block: str(q.src) ?? undefined })
				: skippedPlan(q, "The image has no address");
		case "control_divider":
			return layoutPlan(q, "nf-divider");
		case "control_pagebreak":
			return layoutPlan(q, "nf-page-break", { name: "Page break" });
		case "control_collapse":
			return {
				...headingPlan(q),
				report: report(
					q,
					"converted",
					"nf-text",
					"Collapsible sections are shown as a heading"
				),
			};
		case "control_button":
			return null;
		case "control_captcha":
			return skippedPlan(
				q,
				"Captcha isn't copied — turn it on in the form's settings"
			);
		case "control_appointment":
			return convertedPlan(q, "Booked slots are kept as text");
		case "control_widget":
			return convertedPlan(q, "Widgets are kept as text answers");
		case "control_inline":
			return convertedPlan(q, "Fill-in-the-blank answers are kept as text");
		case "control_spacer":
			return skippedPlan(q, "Spacers aren't needed");
		default:
			if (PAYMENT_TYPE.test(type) || q.paymentType) {
				return convertedPlan(
					q,
					"Payment details are kept as text; payments aren't collected"
				);
			}
			return convertedPlan(
				q,
				`“${type.replace("control_", "")}” isn't available, so it was converted to text`
			);
	}
}

/* ---------------------------------- Forms --------------------------------- */

export interface MappedForm {
	/** One line per question, for the overview. */
	fields: FieldReport[];
	settings: FormSettings;
	/** Things the user should know (logic, notifications…). */
	warnings: string[];
}

function hasItems(value: unknown): boolean {
	const parsed = json(value);
	if (Array.isArray(parsed)) {
		return parsed.length > 0;
	}
	return Boolean(
		parsed && typeof parsed === "object" && Object.keys(parsed).length
	);
}

/** Converts a JotForm form (summary + questions + properties) into settings. */
export function mapForm(
	form: JotformFormSummary,
	questions: JotformQuestion[],
	properties: JotformProperties = {}
): MappedForm {
	const defaults = defaultFormSettings();
	const fields: FormField[] = [];
	const reports: FieldReport[] = [];
	let submitText: string | null = null;
	for (const question of questions) {
		if (question.type === "control_button") {
			submitText = plain(question.text) || submitText;
			continue;
		}
		const plan = planQuestion(question);
		if (plan) {
			fields.push(...plan.fields);
			reports.push(plan.report);
		}
	}
	// A trailing page break would leave an empty last page.
	while (fields.at(-1)?.type === "nf-page-break") {
		fields.pop();
	}

	const redirect =
		properties.activeRedirect === "thankurl" ? str(properties.thankurl) : null;
	const thanksText = str(properties.thanktext);
	const thanks = thanksText ? tagsToMentions(thanksText, questions) : null;
	const warnings: string[] = [];
	if (hasItems(properties.conditions)) {
		warnings.push(
			"Conditional logic isn't copied — recreate it in the editor (Logic tab of each field)."
		);
	}
	if (hasItems(properties.emails)) {
		warnings.push(
			"Email notifications aren't copied — add them again under Integrations."
		);
	}
	if (hasItems(properties.integrations)) {
		warnings.push(
			"JotForm integrations need to be set up again in StryveForms."
		);
	}

	const settings: FormSettings = {
		...defaults,
		brandOverrides: [],
		presentationStyle:
			String(form.type ?? "").toUpperCase() === "CARD" ? "focused" : "classic",
		properties: fields as FormSettings["properties"],
		redirectUrl: redirect,
		submitButtonText: submitText,
		submittedText: thanks ?? defaults.submittedText,
		title: plain(form.title) || plain(properties.title) || "Untitled form",
		// JotForm's design can't be converted, so imported forms use the
		// workspace brand.
		useWorkspaceBrand: true,
		visibility: form.status === "DISABLED" ? "closed" : "public",
	};
	return { fields: reports, settings, warnings };
}

/* ------------------------------- Submissions ------------------------------ */

export interface MappedSubmission {
	createdAt: Date;
	data: Raw;
	files: MappedFile[];
	legacyId: string;
	meta: Raw;
	updatedAt: Date;
}

const EASTERN = new Intl.DateTimeFormat("en-US", {
	day: "2-digit",
	hour: "2-digit",
	hourCycle: "h23",
	minute: "2-digit",
	month: "2-digit",
	second: "2-digit",
	timeZone: "America/New_York",
	year: "numeric",
});

/** Minutes New York is behind UTC at this instant (240 or 300). */
function easternOffset(utc: Date): number {
	const parts = Object.fromEntries(
		EASTERN.formatToParts(utc).map((p) => [p.type, p.value])
	);
	const asUtc = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
		Number(parts.second)
	);
	return Math.round((utc.getTime() - asUtc) / 60_000);
}

/** JotForm reports submission times in US Eastern time (`2024-05-01 13:30:00`). */
export function parseJotformDate(value: unknown): Date | null {
	const match = typeof value === "string" ? DATE_TIME.exec(value.trim()) : null;
	if (!match) {
		return null;
	}
	const [, y, m, d, h = "0", min = "0", s = "0"] = match;
	const wall = Date.UTC(
		Number(y),
		Number(m) - 1,
		Number(d),
		Number(h),
		Number(min),
		Number(s)
	);
	const offset = easternOffset(new Date(wall + 5 * 60 * 60_000));
	return new Date(wall + offset * 60_000);
}

function answersOf(
	submission: JotformSubmission
): Record<string, JotformAnswer> {
	const { answers } = submission;
	if (!answers || Array.isArray(answers)) {
		return {};
	}
	return answers;
}

/** Converts a submission using the same plans as the form. */
export function mapSubmission(
	submission: JotformSubmission,
	questions: JotformQuestion[]
): MappedSubmission {
	const answers = answersOf(submission);
	const data: Raw = {};
	const ctx: AnswerContext = { files: [], submissionId: submission.id };
	for (const question of questions) {
		const answer = answers[question.qid];
		if (!answer) {
			continue;
		}
		const plan = planQuestion(question);
		plan?.answer?.(answer, data, ctx);
	}
	const createdAt = parseJotformDate(submission.created_at) ?? new Date();
	const meta: Raw = { importedFrom: "jotform", jotformId: submission.id };
	if (str(submission.ip)) {
		meta.ip_address = submission.ip;
	}
	if (str(submission.notes)) {
		meta.notes = submission.notes;
	}
	if (yes(submission.flag)) {
		meta.flagged = true;
	}
	return {
		createdAt,
		data,
		files: ctx.files,
		legacyId: submission.id,
		meta,
		updatedAt: parseJotformDate(submission.updated_at) ?? createdAt,
	};
}

/* ------------------------------ Integrations ------------------------------ */

const FIELD_TAG = /\{([A-Za-z0-9_:-]+)\}/g;

export interface MappedIntegration {
	data: Raw;
	integrationId: "email" | "webhook";
	/** Stable key so running the import again updates it. */
	key: string;
	/** Shown in the overview and the import log. */
	note: string | null;
	status: "active" | "inactive";
}

/** `{email}` style JotForm tags → StryveForms mentions of the same answer. */
function tagsToMentions(text: string, questions: JotformQuestion[]): string {
	const byName = new Map<string, FormField>();
	for (const question of questions) {
		const first = planQuestion(question)?.fields[0];
		if (first && question.name) {
			byName.set(question.name, first);
		}
	}
	return text.replace(FIELD_TAG, (tag, name: string) => {
		const field = byName.get(name.split(":")[0] ?? name);
		return field ? mentionHtml(field) : tag;
	});
}

function emailList(value: unknown): Raw[] {
	const parsed = json(value);
	if (Array.isArray(parsed)) {
		return parsed.filter((e): e is Raw => Boolean(e && typeof e === "object"));
	}
	if (parsed && typeof parsed === "object") {
		return Object.values(parsed).filter((e): e is Raw =>
			Boolean(e && typeof e === "object")
		);
	}
	return [];
}

/**
 * JotForm email notifications and autoresponders become email integrations,
 * webhooks become webhook integrations.
 */
export function mapIntegrations(
	properties: JotformProperties,
	questions: JotformQuestion[],
	webhooks: string[] = []
): MappedIntegration[] {
	const result: MappedIntegration[] = [];
	for (const [index, email] of emailList(properties.emails).entries()) {
		const to = tagsToMentions(str(email.to) ?? "", questions);
		if (!to) {
			continue;
		}
		// `html` is only a "true"/"false" flag; the text is in `body`.
		const body = str(email.body);
		const autoresponder = String(email.type ?? "").startsWith("auto");
		const data: Raw = {
			email_content: body
				? tagsToMentions(body, questions)
				: "<p>New form submission</p>",
			include_submission_data: !body,
			reply_to: tagsToMentions(str(email.replyTo) ?? "", questions),
			send_to: to,
			sender_name: str(email.fromName) ?? str(email.name) ?? "",
			subject: tagsToMentions(str(email.subject) ?? "", questions),
		};
		result.push({
			data,
			integrationId: "email",
			key: `email:${index}`,
			note: autoresponder
				? "Autoresponder copied as an email to the respondent. Check its wording."
				: null,
			status: yes(email.disabled) ? "inactive" : "active",
		});
	}
	for (const [index, url] of webhooks.entries()) {
		result.push({
			data: { webhook_url: url },
			integrationId: "webhook",
			key: `webhook:${index}:${url}`,
			note: "Webhooks now receive StryveForms' JSON format. Update the receiving app if it expects JotForm's.",
			status: "active",
		});
	}
	return result;
}
