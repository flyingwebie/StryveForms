/**
 * Catalogue of every block a form can contain.
 *
 * `type` is what gets stored in `form.properties[].type`. Some catalogue
 * entries are variants of another stored type (e.g. "radio" is stored as
 * `select` with `without_dropdown: true`), matching OpnForm so imported
 * forms keep working unchanged.
 */

export const INPUT_TYPES = [
	"text",
	"rich_text",
	"date",
	"url",
	"phone_number",
	"email",
	"checkbox",
	"select",
	"multi_select",
	"matrix",
	"number",
	"rating",
	"scale",
	"slider",
	"files",
	"signature",
	"barcode",
	"payment",
] as const;

export const LAYOUT_TYPES = [
	"nf-text",
	"nf-page-break",
	"nf-divider",
	"nf-image",
	"nf-video",
	"nf-audio",
	"nf-code",
] as const;

export type InputType = (typeof INPUT_TYPES)[number];
export type LayoutType = (typeof LAYOUT_TYPES)[number];
export type FieldType = InputType | LayoutType;

export type PresentationStyle = "classic" | "focused";

export type SummaryType =
	| "text_list"
	| "date_summary"
	| "boolean"
	| "distribution"
	| "matrix"
	| "numeric_stats"
	| "rating"
	| "payment";

export interface BlockDefinition {
	availableIn: readonly PresentationStyle[];
	category: "input" | "choice" | "advanced" | "layout" | "media";
	defaultName: string;
	/** Extra keys applied when the block is added in the editor. */
	defaultValues: Record<string, unknown>;
	/** One-line, plain-language explanation shown in the add-block panel. */
	description: string;
	/** Name of a lucide-react icon. */
	icon: string;
	/** Catalogue id, e.g. `radio`. */
	id: string;
	isInput: boolean;
	/** Allowed number of blocks of this kind per form. */
	maxCount?: number;
	summaryType?: SummaryType;
	title: string;
	/** Stored `type`. Differs from `id` for variants such as radio or password. */
	type: FieldType;
}

const BOTH: readonly PresentationStyle[] = ["classic", "focused"];
const CLASSIC: readonly PresentationStyle[] = ["classic"];
const FOCUSED: readonly PresentationStyle[] = ["focused"];

const TWO_OPTIONS = {
	options: [
		{ id: "Option 1", name: "Option 1" },
		{ id: "Option 2", name: "Option 2" },
	],
};

export const BLOCKS: readonly BlockDefinition[] = [
	{
		id: "text",
		description: "A single-line text answer.",
		type: "text",
		title: "Text",
		icon: "Type",
		category: "input",
		defaultName: "Your name",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: {
			multi_lines: false,
			max_char_limit: 2000,
			placeholder: "Type your answer",
		},
	},
	{
		id: "rich_text",
		description: "A multi-line answer with bold, lists and links.",
		type: "rich_text",
		title: "Rich text",
		icon: "PilcrowSquare",
		category: "input",
		defaultName: "Description",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: { max_char_limit: 2000, placeholder: "Write your answer" },
	},
	{
		id: "email",
		description: "An email address, validated as you type.",
		type: "email",
		title: "Email",
		icon: "AtSign",
		category: "input",
		defaultName: "Email",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: { max_char_limit: 2000, placeholder: "name@example.com" },
	},
	{
		id: "phone_number",
		description: "A phone number with country code picker.",
		type: "phone_number",
		title: "Phone",
		icon: "Phone",
		category: "input",
		defaultName: "Phone number",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: { placeholder: "+1 202 555 0142" },
	},
	{
		id: "url",
		description: "A web link, validated as a URL.",
		type: "url",
		title: "URL",
		icon: "Link",
		category: "input",
		defaultName: "Link",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: { max_char_limit: 2000, placeholder: "https://example.com" },
	},
	{
		id: "number",
		description: "A numeric answer, digits only.",
		type: "number",
		title: "Number",
		icon: "Hash",
		category: "input",
		defaultName: "Number",
		isInput: true,
		availableIn: BOTH,
		summaryType: "numeric_stats",
		defaultValues: { placeholder: "Type a number" },
	},
	{
		id: "date",
		description: "A date, or date range, picked from a calendar.",
		type: "date",
		title: "Date",
		icon: "Calendar",
		category: "input",
		defaultName: "Date",
		isInput: true,
		availableIn: BOTH,
		summaryType: "date_summary",
		defaultValues: {},
	},
	{
		id: "password",
		description: "A masked text answer, hidden as it's typed.",
		type: "text",
		title: "Password",
		icon: "KeyRound",
		category: "input",
		defaultName: "Password",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: {
			secret_input: true,
			multi_lines: false,
			max_char_limit: 2000,
			placeholder: "Enter your password",
		},
	},
	{
		id: "select",
		description: "A dropdown with one choice from a list of options.",
		type: "select",
		title: "Dropdown",
		icon: "ChevronDownSquare",
		category: "choice",
		defaultName: "Dropdown",
		isInput: true,
		availableIn: BOTH,
		summaryType: "distribution",
		defaultValues: { placeholder: "Select an option", select: TWO_OPTIONS },
	},
	{
		id: "radio",
		description: "A list of options shown as single-choice radio buttons.",
		type: "select",
		title: "Single choice",
		icon: "CircleDot",
		category: "choice",
		defaultName: "Single choice",
		isInput: true,
		availableIn: BOTH,
		summaryType: "distribution",
		defaultValues: { select: TWO_OPTIONS, without_dropdown: true },
	},
	{
		id: "multi_select",
		description: "A list of options respondents can pick several of.",
		type: "multi_select",
		title: "Multiple choice",
		icon: "ListChecks",
		category: "choice",
		defaultName: "Multiple choice",
		isInput: true,
		availableIn: BOTH,
		summaryType: "distribution",
		defaultValues: { placeholder: "Select options", multi_select: TWO_OPTIONS },
	},
	{
		id: "checkbox",
		description: "A single yes/no checkbox.",
		type: "checkbox",
		title: "Checkbox",
		icon: "SquareCheck",
		category: "choice",
		defaultName: "Checkbox",
		isInput: true,
		availableIn: BOTH,
		summaryType: "boolean",
		defaultValues: {},
	},
	{
		id: "toggle_switch",
		description: "A single yes/no answer shown as a toggle switch.",
		type: "checkbox",
		title: "Toggle switch",
		icon: "ToggleRight",
		category: "choice",
		defaultName: "Toggle switch",
		isInput: true,
		availableIn: BOTH,
		summaryType: "boolean",
		defaultValues: { use_toggle_switch: true },
	},
	{
		id: "rating",
		description: "A star rating out of a chosen maximum.",
		type: "rating",
		title: "Rating",
		icon: "Star",
		category: "choice",
		defaultName: "Rating",
		isInput: true,
		availableIn: BOTH,
		summaryType: "rating",
		defaultValues: { rating_max_value: 5 },
	},
	{
		id: "scale",
		description: "A numeric scale respondents slide or click along.",
		type: "scale",
		title: "Scale",
		icon: "Gauge",
		category: "choice",
		defaultName: "Scale",
		isInput: true,
		availableIn: BOTH,
		summaryType: "numeric_stats",
		defaultValues: {
			scale_min_value: 1,
			scale_max_value: 5,
			scale_step_value: 1,
		},
	},
	{
		id: "slider",
		description: "A draggable slider between a minimum and maximum value.",
		type: "slider",
		title: "Slider",
		icon: "SlidersHorizontal",
		category: "choice",
		defaultName: "Slider",
		isInput: true,
		availableIn: BOTH,
		summaryType: "numeric_stats",
		defaultValues: {
			slider_min_value: 0,
			slider_max_value: 50,
			slider_step_value: 1,
		},
	},
	{
		id: "matrix",
		description: "A grid of rows and columns respondents fill in or pick from.",
		type: "matrix",
		title: "Matrix",
		icon: "Grid3x3",
		category: "choice",
		defaultName: "Matrix",
		isInput: true,
		availableIn: BOTH,
		summaryType: "matrix",
		defaultValues: {
			rows: ["Row 1"],
			columns: [1, 2, 3],
			selection_data: { "Row 1": null },
		},
	},
	{
		id: "files",
		description: "Lets respondents upload one or more files.",
		type: "files",
		title: "File upload",
		icon: "Paperclip",
		category: "advanced",
		defaultName: "File upload",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: {},
	},
	{
		id: "signature",
		description: "Lets respondents draw a signature.",
		type: "signature",
		title: "Signature",
		icon: "Signature",
		category: "advanced",
		defaultName: "Signature",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: {},
	},
	{
		id: "barcode",
		description: "Scans a barcode using the device camera.",
		type: "barcode",
		title: "Barcode reader",
		icon: "ScanBarcode",
		category: "advanced",
		defaultName: "Scan barcode",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: { decoders: ["qr_reader", "ean_reader", "ean_8_reader"] },
	},
	{
		id: "qrcode",
		description: "Scans a QR code using the device camera.",
		type: "barcode",
		title: "QR code reader",
		icon: "QrCode",
		category: "advanced",
		defaultName: "Scan QR code",
		isInput: true,
		availableIn: BOTH,
		summaryType: "text_list",
		defaultValues: { decoders: ["qr_reader"] },
	},
	{
		id: "nf-text",
		description:
			"Plain text or formatted content shown between fields, not an answer.",
		type: "nf-text",
		title: "Text",
		icon: "Text",
		category: "layout",
		defaultName: "Text",
		isInput: false,
		availableIn: BOTH,
		defaultValues: { content: "<p>Write something here…</p>" },
	},
	{
		id: "nf-page-break",
		description:
			"Starts a new screen. Every question up to the next page break shows together.",
		type: "nf-page-break",
		title: "Page break",
		icon: "SeparatorHorizontal",
		category: "layout",
		defaultName: "Page break",
		isInput: false,
		availableIn: FOCUSED,
		defaultValues: {},
	},
	{
		id: "nf-divider",
		description: "A horizontal rule used to visually separate sections.",
		type: "nf-divider",
		title: "Divider",
		icon: "Minus",
		category: "layout",
		defaultName: "Divider",
		isInput: false,
		availableIn: CLASSIC,
		defaultValues: {},
	},
	{
		id: "nf-image",
		description: "An image shown inline in the form.",
		type: "nf-image",
		title: "Image",
		icon: "Image",
		category: "media",
		defaultName: "Image",
		isInput: false,
		availableIn: CLASSIC,
		defaultValues: {},
	},
	{
		id: "nf-video",
		description: "An embedded or uploaded video.",
		type: "nf-video",
		title: "Video",
		icon: "Video",
		category: "media",
		defaultName: "Video",
		isInput: false,
		availableIn: BOTH,
		defaultValues: {},
	},
	{
		id: "nf-audio",
		description: "An embedded or uploaded audio clip.",
		type: "nf-audio",
		title: "Audio",
		icon: "AudioLines",
		category: "media",
		defaultName: "Audio",
		isInput: false,
		availableIn: BOTH,
		defaultValues: {},
	},
	{
		id: "nf-code",
		description: "Custom HTML, for embeds the other blocks don't cover.",
		type: "nf-code",
		title: "HTML code",
		icon: "Code",
		category: "media",
		defaultName: "HTML code",
		isInput: false,
		availableIn: BOTH,
		defaultValues: { content: "" },
	},
];

const BLOCKS_BY_ID = new Map(BLOCKS.map((b) => [b.id, b]));

export function getBlock(id: string): BlockDefinition | undefined {
	return BLOCKS_BY_ID.get(id);
}

export function isInputType(type: string): type is InputType {
	return (INPUT_TYPES as readonly string[]).includes(type);
}

export function isLayoutType(type: string): type is LayoutType {
	return type.startsWith("nf-");
}

/** Picks the catalogue entry that best describes a stored field (radio vs dropdown, etc.). */
export function blockForField(field: {
	secret_input?: unknown;
	type: string;
	use_toggle_switch?: unknown;
	without_dropdown?: unknown;
	decoders?: unknown;
}): BlockDefinition | undefined {
	if (field.type === "select" && field.without_dropdown) {
		return getBlock("radio");
	}
	if (field.type === "text" && field.secret_input) {
		return getBlock("password");
	}
	if (field.type === "checkbox" && field.use_toggle_switch) {
		return getBlock("toggle_switch");
	}
	if (
		field.type === "barcode" &&
		Array.isArray(field.decoders) &&
		field.decoders.length === 1 &&
		field.decoders[0] === "qr_reader"
	) {
		return getBlock("qrcode");
	}
	return (
		BLOCKS.find((b) => b.id === field.type) ??
		BLOCKS.find((b) => b.type === field.type)
	);
}
