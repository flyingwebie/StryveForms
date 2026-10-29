/** Sidebar folder colour swatches. Hex values, not theme tokens — folders are user-picked, not brand-driven. */
export const FOLDER_COLORS = [
	{ name: "Slate", value: "#64748b" },
	{ name: "Red", value: "#ef4444" },
	{ name: "Orange", value: "#f97316" },
	{ name: "Amber", value: "#f59e0b" },
	{ name: "Yellow", value: "#eab308" },
	{ name: "Lime", value: "#84cc16" },
	{ name: "Green", value: "#22c55e" },
	{ name: "Teal", value: "#14b8a6" },
	{ name: "Cyan", value: "#06b6d4" },
	{ name: "Blue", value: "#3b82f6" },
	{ name: "Indigo", value: "#6366f1" },
	{ name: "Violet", value: "#8b5cf6" },
	{ name: "Purple", value: "#a855f7" },
	{ name: "Pink", value: "#ec4899" },
	{ name: "Rose", value: "#f43f5e" },
] as const;

/** Small emoji set for folder icons — matches the workspace icon picker's style. */
export const FOLDER_EMOJIS = [
	"📁",
	"📂",
	"⭐",
	"🚀",
	"💼",
	"🎯",
	"📊",
	"🧩",
	"🔥",
	"💡",
	"📌",
	"🗂️",
	"📝",
	"🎨",
	"🛠️",
	"📣",
] as const;

const [firstColor] = FOLDER_COLORS;
const [firstEmoji] = FOLDER_EMOJIS;
export const DEFAULT_FOLDER_COLOR = firstColor.value;
export const DEFAULT_FOLDER_ICON = firstEmoji;

/** Sentinel used in the `?folder=` search param for "items with no folder". */
export const NO_FOLDER = "none";

/** Drag payload mime type used to drop form cards/rows onto a sidebar folder. */
export const FORM_DRAG_MIME = "application/x-stryveforms-form-ids";

/** Drag payload mime type used to reorder/nest a folder by dragging it in the sidebar. */
export const FOLDER_DRAG_MIME = "application/x-stryveforms-folder-id";

/** localStorage key for which folders are expanded in a workspace's sidebar tree. */
export function expandedFoldersStorageKey(
	workspaceId: string,
	kind: "form" | "template"
) {
	return `stryveforms.folders.expanded.${workspaceId}.${kind}`;
}
