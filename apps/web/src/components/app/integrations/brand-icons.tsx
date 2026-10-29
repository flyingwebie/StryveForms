/**
 * Brand marks for each integration (simple-icons, CC0, where available), shown
 * white on a badge in the brand's colour. Slack, Activepieces, Albato and
 * Pabbly Connect aren't in simple-icons, so those four are hand-drawn below:
 * Slack's real four-colour "swoosh" pinwheel (its license isn't CC0, so it
 * can't ship via simple-icons, but reproducing its well-known public mark
 * here for "which tool this integration posts to" is the same fair use every
 * app with a Slack integration relies on); Activepieces, Albato and Pabbly
 * Connect don't have a redistributable source for their exact marks, so
 * those three are original glyphs in the spirit of their branding (a flow
 * glyph, an infinity/connection loop, and a bold "P" monogram).
 */
import { cn } from "@StryveForms/ui/lib/utils";
import { Mail, Webhook } from "lucide-react";
import type { SVGProps } from "react";
import { siDiscord, siMake, siN8n, siTelegram, siZapier } from "simple-icons";

import { SimpleIcon } from "../brand/simple-icon";

/** Slack's real mark: four rounded "swooshes" (bar + circle) in its brand colours. */
function SlackMark(props: SVGProps<SVGSVGElement>) {
	return (
		<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
			<rect fill="#36c5f0" height="7.6" rx="1.4" width="2.8" x="8.6" y="2.6" />
			<circle cx="10" cy="11.4" fill="#36c5f0" r="1.9" />
			<rect fill="#2eb67d" height="2.8" rx="1.4" width="7.6" x="13.8" y="8.6" />
			<circle cx="12.6" cy="10" fill="#2eb67d" r="1.9" />
			<rect
				fill="#ecb22e"
				height="7.6"
				rx="1.4"
				width="2.8"
				x="12.6"
				y="13.8"
			/>
			<circle cx="14" cy="12.6" fill="#ecb22e" r="1.9" />
			<rect fill="#e01e5a" height="2.8" rx="1.4" width="7.6" x="2.6" y="12.6" />
			<circle cx="11.4" cy="14" fill="#e01e5a" r="1.9" />
		</svg>
	);
}

/** Activepieces: an ascending connected path, standing in for an automation flow. */
function ActivepiecesGlyph(props: SVGProps<SVGSVGElement>) {
	return (
		<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
			<path
				d="M4 18L9.5 12.5L13 16L20 6"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2.6"
			/>
			<circle cx="4" cy="18" fill="currentColor" r="1.6" />
			<circle cx="13" cy="16" fill="currentColor" r="1.6" />
			<circle cx="20" cy="6" fill="currentColor" r="1.6" />
		</svg>
	);
}

/** Albato: an infinity loop, standing in for connecting two apps together. */
function AlbatoGlyph(props: SVGProps<SVGSVGElement>) {
	return (
		<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
			<path
				d="M6 12c0-2.2 1.8-4 4-4 1.6 0 2.8 1 4 2.4 1.2-1.4 2.4-2.4 4-2.4 2.2 0 4 1.8 4 4s-1.8 4-4 4c-1.6 0-2.8-1-4-2.4-1.2 1.4-2.4 2.4-4 2.4-2.2 0-4-1.8-4-4z"
				fill="currentColor"
			/>
		</svg>
	);
}

/** Pabbly Connect: a bold "P" monogram, matching Pabbly's own lettermark style. */
function PabblyGlyph(props: SVGProps<SVGSVGElement>) {
	return (
		<svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
			<path d="M6 3h4a6 6 0 0 1 0 12H10v6H6z" fill="currentColor" />
		</svg>
	);
}

function Lettermark({ letter }: { letter: string }) {
	return <span className="font-bold text-[13px] leading-none">{letter}</span>;
}

/** id -> { background, foreground glyph }. Falls back to a neutral lettermark. */
const BRANDS: Record<string, { bg: string; render: () => React.ReactNode }> = {
	activepieces: {
		bg: "#6e41e2",
		render: () => <ActivepiecesGlyph className="size-4" />,
	},
	albato: { bg: "#f2542d", render: () => <AlbatoGlyph className="size-4" /> },
	discord: {
		bg: "#5865f2",
		render: () => <SimpleIcon className="size-5" path={siDiscord.path} />,
	},
	email: { bg: "#2563eb", render: () => <Mail className="size-4" /> },
	make: {
		bg: "#6d00cc",
		render: () => <SimpleIcon className="size-5" path={siMake.path} />,
	},
	n8n: {
		bg: "#ea4b71",
		render: () => <SimpleIcon className="size-5" path={siN8n.path} />,
	},
	pabbly: { bg: "#11a96d", render: () => <PabblyGlyph className="size-4" /> },
	// Slack's mark is already multi-colour, so it sits on a white badge instead
	// of a brand-colour one (otherwise its own purple would clash with the swooshes).
	slack: { bg: "#ffffff", render: () => <SlackMark className="size-5" /> },
	telegram: {
		bg: "#26a5e4",
		render: () => <SimpleIcon className="size-4" path={siTelegram.path} />,
	},
	webhook: { bg: "#334155", render: () => <Webhook className="size-4" /> },
	zapier: {
		bg: "#ff4a00",
		render: () => <SimpleIcon className="size-4" path={siZapier.path} />,
	},
};

/** Coloured badge for an integration id, e.g. inside a list row or catalogue tile. */
export function IntegrationBadge({
	className,
	id,
}: {
	className?: string;
	id: string;
}) {
	const brand = BRANDS[id] ?? {
		bg: "#64748b",
		render: () => <Lettermark letter={id.slice(0, 1).toUpperCase()} />,
	};
	return (
		<div
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-lg text-white ring-1 ring-black/5 dark:ring-white/10",
				className
			)}
			style={{ backgroundColor: brand.bg }}
		>
			{brand.render()}
		</div>
	);
}
