import {
	BORDER_RADII,
	CAPTCHA_PROVIDERS,
	DARK_MODES,
	defaultFormSettings,
	type FormSettings,
	LANGUAGES,
	PRESENTATION_STYLES,
	RETENTION_UNITS,
	SIZES,
	THEMES,
	VISIBILITIES,
	WIDTHS,
} from "@StryveForms/forms/settings";
import { normalizePhone } from "@StryveForms/forms/validation";

import type {
	OpnformFileValue,
	OpnformForm,
	OpnformIntegration,
	OpnformProperty,
	OpnformSubmission,
} from "./types";

const UUID_SUFFIX =
	/_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)?$/i;
const SIGNATURE_NAME = /^sign_[0-9a-f-]{36}\.png$/i;
const UNSAFE_NAME_CHARS = /[^\w.-]+/g;
const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/g;
const COUNTRY_PREFIX = /^[A-Z]{2}\+/;
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const MAX_BASE_LENGTH = 50;
/** Keys OpnForm merges into `data` that aren't answers. */
const META_KEYS = ["status", "created_at", "id", "submission_id", "ip_address"];
const FILE_TYPES = new Set(["files", "signature"]);

type Raw = Record<string, unknown>;

function pick<T extends readonly string[]>(
	allowed: T,
	value: unknown,
	fallback: T[number]
): T[number] {
	return typeof value === "string" &&
		(allowed as readonly string[]).includes(value)
		? (value as T[number])
		: fallback;
}

const str = (v: unknown): string | null =>
	typeof v === "string" && v.length > 0 ? v : null;
const bool = (v: unknown, fallback = false): boolean =>
	typeof v === "boolean" ? v : fallback;
const num = (v: unknown): number | null => {
	const n = typeof v === "string" ? Number(v) : v;
	return typeof n === "number" && Number.isFinite(n) ? n : null;
};
/** PHP serialises empty objects as `[]`. */
const obj = (v: unknown): Raw =>
	v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {};

export interface MappedForm {
	legacyId: number;
	legacySlug: string;
	/** OpnForm returns the stored password to the owner; we hash it on import. */
	password: string | null;
	settings: FormSettings;
	viewsCount: number;
}

/** Converts an OpnForm form (owner view of `GET /open/forms/{id}`) into StryveForms settings. */
export function mapForm(source: OpnformForm): MappedForm {
	const f = source as Raw;
	const d = defaultFormSettings();
	const settings: FormSettings = {
		title: str(f.title) ?? "Untitled form",
		visibility: pick(VISIBILITIES, f.visibility, "public"),
		tags: Array.isArray(f.tags)
			? f.tags.filter((t): t is string => typeof t === "string")
			: [],
		properties: (Array.isArray(f.properties)
			? f.properties
			: []) as FormSettings["properties"],
		computedVariables: (Array.isArray(f.computed_variables)
			? f.computed_variables
			: []) as FormSettings["computedVariables"],
		language: pick(LANGUAGES, f.language, "en"),
		fontFamily: str(f.font_family),
		customDomain: null,
		size: pick(SIZES, f.size, d.size),
		borderRadius: pick(BORDER_RADII, f.border_radius, d.borderRadius),
		theme: pick(THEMES, f.theme, d.theme),
		presentationStyle: pick(
			PRESENTATION_STYLES,
			f.presentation_style,
			"classic"
		),
		width: pick(WIDTHS, f.width, d.width),
		layoutRtl: bool(f.layout_rtl),
		coverPicture: str(f.cover_picture),
		coverSettings: Object.keys(obj(f.cover_settings)).length
			? (obj(f.cover_settings) as FormSettings["coverSettings"])
			: null,
		logoPicture: str(f.logo_picture),
		darkMode: pick(DARK_MODES, f.dark_mode, "auto"),
		color:
			typeof f.color === "string" && HEX_COLOR.test(f.color)
				? f.color
				: d.color,
		uppercaseLabels: bool(f.uppercase_labels),
		// Imported forms keep their own OpnForm design; they never follow a
		// workspace brand unless an admin opts them in later.
		useWorkspaceBrand: false,
		brandOverrides: [],
		noBranding: bool(f.no_branding),
		transparentBackground: bool(f.transparent_background),
		translations: obj(f.translations),
		settings: obj(f.settings),
		customCode: str(f.custom_code),
		customCss: str(f.custom_css),
		submitButtonText: str(f.submit_button_text),
		databaseFieldsUpdate: Array.isArray(f.database_fields_update)
			? f.database_fields_update.filter(
					(x): x is string => typeof x === "string"
				)
			: null,
		clearEmptyFieldsOnUpdate: bool(f.clear_empty_fields_on_update),
		reFillable: bool(f.re_fillable),
		reFillButtonText: str(f.re_fill_button_text),
		submittedText: str(f.submitted_text) ?? d.submittedText,
		redirectUrl: str(f.redirect_url),
		useCaptcha: bool(f.use_captcha),
		captchaProvider: pick(CAPTCHA_PROVIDERS, f.captcha_provider, "hcaptcha"),
		closesAt: parseDate(f.closes_at)?.toISOString() ?? null,
		closedText: str(f.closed_text),
		maxSubmissionsCount: num(f.max_submissions_count),
		maxSubmissionsReachedText:
			str(f.max_submissions_reached_text) ?? d.maxSubmissionsReachedText,
		editableSubmissions: bool(f.editable_submissions),
		editableSubmissionsButtonText:
			str(f.editable_submissions_button_text) ??
			d.editableSubmissionsButtonText,
		pdfDownloadEnabled: d.pdfDownloadEnabled,
		pdfDownloadButtonText: d.pdfDownloadButtonText,
		confettiOnSubmission: bool(f.confetti_on_submission),
		showProgressBar: bool(f.show_progress_bar),
		autoSave: bool(f.auto_save, true),
		autoFocus: bool(f.auto_focus, true),
		enablePartialSubmissions: bool(f.enable_partial_submissions),
		enableIpTracking: bool(f.enable_ip_tracking),
		submissionRetentionValue: num(f.submission_retention_value),
		submissionRetentionUnit:
			typeof f.submission_retention_unit === "string" &&
			(RETENTION_UNITS as readonly string[]).includes(
				f.submission_retention_unit
			)
				? (f.submission_retention_unit as FormSettings["submissionRetentionUnit"])
				: null,
		canBeIndexed: bool(f.can_be_indexed, true),
		seoMeta: obj(f.seo_meta),
		analytics: obj(f.analytics),
	};
	return {
		legacyId: source.id,
		legacySlug: source.slug,
		password: str(f.password),
		settings,
		viewsCount: num(f.views_count) ?? 0,
	};
}

/** `2024-05-01 12:00:00` (UTC, OpnForm format) or ISO → Date. */
export function parseDate(value: unknown): Date | null {
	if (typeof value !== "string" || value.length === 0) {
		return null;
	}
	const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? null : date;
}

/* --------------------------------- Assets -------------------------------- */

/** Finds images/media hosted by the OpnForm instance that must be copied over. */
export function findHostedAssets(
	value: unknown,
	isHosted: (url: string) => boolean
): string[] {
	const found = new Set<string>();
	const visit = (v: unknown) => {
		if (typeof v === "string") {
			for (const match of v.matchAll(URL_IN_TEXT)) {
				if (isHosted(match[0])) {
					found.add(match[0]);
				}
			}
		} else if (Array.isArray(v)) {
			v.forEach(visit);
		} else if (v && typeof v === "object") {
			Object.values(v).forEach(visit);
		}
	};
	visit(value);
	return [...found];
}

/** Deep-replaces URLs in any JSON value. */
export function replaceUrls<T>(value: T, replacements: Map<string, string>): T {
	if (replacements.size === 0) {
		return value;
	}
	const walk = (v: unknown): unknown => {
		if (typeof v === "string") {
			let out = v;
			for (const [from, to] of replacements) {
				out = out.split(from).join(to);
			}
			return out;
		}
		if (Array.isArray(v)) {
			return v.map(walk);
		}
		if (v && typeof v === "object") {
			return Object.fromEntries(
				Object.entries(v).map(([k, val]) => [k, walk(val)])
			);
		}
		return v;
	};
	return walk(value) as T;
}

/* ------------------------------- Submissions ----------------------------- */

export interface MappedFile {
	fieldId: string;
	originalName: string;
	/** Name stored in the answer and on disk. */
	storedName: string;
	url: string;
}

export interface MappedSubmission {
	completionTime: number | null;
	createdAt: Date;
	data: Record<string, unknown>;
	files: MappedFile[];
	legacyId: number;
	meta: Record<string, unknown>;
	publicId: string | null;
	status: "completed" | "partial";
}

/** Keeps OpnForm's `name_<uuid>.ext` names; otherwise builds one. */
export function storedFileName(name: string): string {
	if (UUID_SUFFIX.test(name) || SIGNATURE_NAME.test(name)) {
		return name;
	}
	const dot = name.lastIndexOf(".");
	const hasExt = dot > 0 && dot < name.length - 1;
	const ext = hasExt
		? name
				.slice(dot + 1)
				.toLowerCase()
				.replace(UNSAFE_NAME_CHARS, "")
		: "";
	const base = (hasExt ? name.slice(0, dot) : name)
		.replace(UNSAFE_NAME_CHARS, "_")
		.slice(0, MAX_BASE_LENGTH);
	const unique = `${base || "file"}_${crypto.randomUUID()}`;
	return ext ? `${unique}.${ext}` : unique;
}

function isFileValue(v: unknown): v is OpnformFileValue {
	return Boolean(
		v && typeof v === "object" && "file_url" in v && "file_name" in v
	);
}

function isFileProperty(p: OpnformProperty): boolean {
	return FILE_TYPES.has(p.type) || (p.type === "url" && Boolean(p.file_upload));
}

function mapAnswer(
	property: OpnformProperty,
	value: unknown,
	files: MappedFile[]
): unknown {
	if (isFileProperty(property)) {
		const list = (Array.isArray(value) ? value : [value]).filter(isFileValue);
		const names = list.map((file) => {
			const storedName = storedFileName(file.file_name);
			files.push({
				fieldId: property.id,
				originalName: file.file_name,
				storedName,
				url: file.file_url,
			});
			return storedName;
		});
		return property.type === "signature" ? (names[0] ?? null) : names;
	}
	if (
		property.type === "phone_number" &&
		typeof value === "string" &&
		COUNTRY_PREFIX.test(value)
	) {
		return normalizePhone(value);
	}
	return value;
}

function mapMeta(source: OpnformSubmission): Record<string, unknown> {
	const meta: Record<string, unknown> = { importedFrom: "opnform" };
	const attribution = obj(source.meta?.attribution);
	if (Object.keys(attribution).length > 0) {
		meta.attribution = attribution;
	}
	if (typeof source.data.ip_address === "string") {
		meta.ip_address = source.data.ip_address;
	}
	return meta;
}

export function mapSubmission(
	source: OpnformSubmission,
	properties: OpnformProperty[]
): MappedSubmission {
	const fieldIds = new Set(properties.map((p) => p.id));
	const data: Record<string, unknown> = { ...source.data };
	for (const key of META_KEYS) {
		if (!fieldIds.has(key)) {
			delete data[key];
		}
	}
	const files: MappedFile[] = [];
	for (const property of properties) {
		const value = data[property.id];
		if (value !== undefined && value !== null) {
			data[property.id] = mapAnswer(property, value, files);
		}
	}
	return {
		completionTime: num(source.completion_time),
		createdAt: parseDate(source.data.created_at) ?? new Date(),
		data,
		files,
		legacyId: source.id,
		meta: mapMeta(source),
		publicId: str(source.submission_id),
		status: source.data.status === "partial" ? "partial" : "completed",
	};
}

/* ------------------------------ Integrations ----------------------------- */

const SUPPORTED_INTEGRATIONS = new Set([
	"email",
	"webhook",
	"slack",
	"discord",
	"telegram",
	"n8n",
	"zapier",
	"make",
	"pabbly",
	"albato",
	"activepieces",
]);

export interface MappedIntegration {
	data: Record<string, unknown>;
	integrationId: string;
	legacyId: number;
	logic: Record<string, unknown> | null;
	/** Shown to the user when the integration needs attention after import. */
	note: string | null;
	status: "active" | "inactive";
}

export function mapIntegration(
	source: OpnformIntegration
): MappedIntegration | null {
	if (!SUPPORTED_INTEGRATIONS.has(source.integration_id)) {
		return null;
	}
	const data = obj(source.data);
	const logic = Object.keys(obj(source.logic)).length
		? obj(source.logic)
		: null;
	let note: string | null = null;
	let status: "active" | "inactive" =
		source.status === "active" ? "active" : "inactive";
	if (source.integration_id === "telegram") {
		note =
			"Telegram was linked through OpnForm's bot. Add a chat id and set TELEGRAM_BOT_TOKEN, then turn it back on.";
		status = "inactive";
	}
	if (
		source.integration_id === "zapier" &&
		!str(data.hook_url) &&
		!str(data.webhook_url)
	) {
		note =
			"Zapier subscribes to forms itself. Reconnect the Zap using a webhook trigger.";
		status = "inactive";
	}
	return {
		data,
		integrationId: source.integration_id,
		legacyId: source.id,
		logic,
		note,
		status,
	};
}

/** Integrations we can't recreate (they need OAuth with the old instance). */
export function unsupportedIntegrationNote(source: OpnformIntegration): string {
	if (source.integration_id === "google_sheets") {
		return "Google Sheets needs to be reconnected (it used OpnForm's Google sign-in).";
	}
	return `The ${source.integration_id} integration isn't available in StryveForms yet.`;
}
