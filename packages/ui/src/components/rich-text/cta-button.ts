import { mergeAttributes, Node } from "@tiptap/core";

export interface CtaButtonAttrs {
	href: string;
	label: string;
}

/** Default look: a solid, rounded, inline-block link — renders reliably across email clients. */
const BUTTON_STYLE =
	"display:inline-block;padding:10px 24px;background-color:#111827;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;font-family:inherit;";

/**
 * "Button" toolbar tool: a call-to-action link styled as a button, for email
 * bodies (e.g. "View submission", "Visit our site"). A real schema node (not
 * just a styled mark) so the inline style always round-trips through
 * `editor.getHTML()` / re-parsing, unlike attaching a custom style to the
 * built-in `link` mark.
 */
export const CtaButton = Node.create({
	addAttributes() {
		return {
			href: { default: "" },
			label: { default: "Click here" },
		};
	},

	atom: true,

	draggable: true,

	group: "block",

	name: "ctaButton",

	parseHTML() {
		return [{ tag: 'a[data-cta="true"]' }];
	},

	renderHTML({ node }) {
		const { href, label } = node.attrs as CtaButtonAttrs;
		return [
			"a",
			mergeAttributes({
				"data-cta": "true",
				href,
				rel: "noopener noreferrer",
				style: BUTTON_STYLE,
				target: "_blank",
			}),
			label,
		];
	},

	renderText({ node }) {
		return String((node.attrs as CtaButtonAttrs).label);
	},
});
