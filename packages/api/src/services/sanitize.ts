import sanitizeHtml from "sanitize-html";

/** Allowed markup for rich text answers and owner-written messages (TipTap output). */
const RICH_TEXT: sanitizeHtml.IOptions = {
	allowedTags: [
		"p",
		"br",
		"strong",
		"b",
		"em",
		"i",
		"u",
		"s",
		"del",
		"mark",
		"sub",
		"sup",
		"code",
		"pre",
		"blockquote",
		"h1",
		"h2",
		"h3",
		"h4",
		"ul",
		"ol",
		"li",
		"a",
		"span",
		"img",
		"hr",
		"table",
		"thead",
		"tbody",
		"tr",
		"th",
		"td",
		"div",
		"iframe",
	],
	allowedAttributes: {
		"*": ["style", "class", "data-type", "data-checked", "dir"],
		a: ["href", "target", "rel", "data-cta"],
		iframe: ["src", "width", "height", "allowfullscreen", "frameborder"],
		img: ["src", "alt", "width", "height"],
		span: [
			"mention",
			"mention-field-id",
			"mention-field-name",
			"mention-fallback",
			"contenteditable",
			"style",
			"class",
		],
		td: ["colspan", "rowspan"],
		th: ["colspan", "rowspan"],
	},
	allowedIframeHostnames: [
		"www.youtube.com",
		"www.youtube-nocookie.com",
		"player.vimeo.com",
	],
	allowedSchemes: ["http", "https", "mailto", "tel"],
	allowedStyles: {
		"*": {
			color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
			"background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
			"text-align": [/^(left|right|center|justify)$/],
			"font-family": [/^[\w\s,'"-]+$/],
		},
	},
	transformTags: {
		a: sanitizeHtml.simpleTransform("a", {
			rel: "noopener noreferrer",
			target: "_blank",
		}),
	},
};

export function sanitizeRichText(html: string): string {
	return sanitizeHtml(html, RICH_TEXT);
}

export function sanitizeOptional(
	html: string | null | undefined
): string | null | undefined {
	return typeof html === "string" ? sanitizeRichText(html) : html;
}
