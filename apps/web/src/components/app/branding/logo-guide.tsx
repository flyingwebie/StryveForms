import { Button } from "@StryveForms/ui/components/button";
import { cn } from "@StryveForms/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { InfoIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ReactNode } from "react";

import ColorPicker from "./color-picker";
import LogoUpload from "./logo-upload";

export type BrandMode = "light" | "dark";

/** The instance brand values edited here, light and dark. */
export interface BrandModeValues {
	faviconDarkUrl: string | null;
	faviconUrl: string | null;
	logoDarkUrl: string | null;
	logoUrl: string | null;
	primaryColor: string;
	primaryColorDark: string | null;
}

function GuideCard({
	children,
	description,
	fallback,
	recommended,
	shownIn,
	title,
}: {
	children: ReactNode;
	description: ReactNode;
	/** Shown when a dark-mode value is unset: what's used instead. */
	fallback?: string | null;
	recommended?: string;
	shownIn: string[];
	title: string;
}) {
	return (
		<div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row">
			<div className="w-full shrink-0 sm:w-44">{children}</div>
			<div className="min-w-0 space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<h4 className="font-semibold text-sm">{title}</h4>
					{fallback ? (
						<span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
							{fallback}
						</span>
					) : null}
				</div>
				<p className="text-muted-foreground text-sm">{description}</p>
				{recommended ? (
					<p className="text-xs">
						<span className="font-medium text-foreground">Recommended: </span>
						<span className="text-muted-foreground">{recommended}</span>
					</p>
				) : null}
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="text-subtle-foreground text-xs">Shown in</span>
					{shownIn.map((place) => (
						<span
							className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground"
							key={place}
						>
							{place}
						</span>
					))}
				</div>
			</div>
		</div>
	);
}

/** Light / Dark switch for the brand editor and its preview. */
export function BrandModeSwitch({
	onChange,
	value,
}: {
	onChange: (mode: BrandMode) => void;
	value: BrandMode;
}) {
	const options = [
		{ icon: SunIcon, label: "Light mode", value: "light" as const },
		{ icon: MoonIcon, label: "Dark mode", value: "dark" as const },
	];
	return (
		<div className="inline-flex rounded-lg bg-secondary p-1">
			{options.map(({ icon: Icon, label, value: mode }) => (
				<button
					aria-pressed={value === mode}
					className={cn(
						"flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25",
						value === mode
							? "bg-background text-foreground shadow-xs"
							: "text-muted-foreground hover:text-foreground"
					)}
					key={mode}
					onClick={() => onChange(mode)}
					type="button"
				>
					<Icon className="size-4" />
					{label}
				</button>
			))}
		</div>
	);
}

/**
 * Brand assets and colour for one colour scheme. Light is the base; every
 * dark-mode value is optional and falls back to its light counterpart, which
 * the card says plainly ("Using your light logo"), so admins know what
 * people will see before they upload anything.
 */
export default function LogoGuide({
	mode,
	onChange,
	values,
}: {
	mode: BrandMode;
	onChange: (patch: Partial<BrandModeValues>) => void;
	values: BrandModeValues;
}) {
	if (mode === "light") {
		return (
			<div className="space-y-3">
				<GuideCard
					description="Your full logo on a transparent background, for light backgrounds. A horizontal wordmark (symbol + name) works best: it's shown instead of the product name. A square symbol works too, with the product name next to it."
					recommended="SVG, or a transparent PNG at least 360×72 px"
					shownIn={["Sidebar", "Emails"]}
					title="Logo"
				>
					<LogoUpload
						label="Logo"
						onChange={(url) => onChange({ logoUrl: url })}
						value={values.logoUrl}
					/>
				</GuideCard>
				<GuideCard
					description="A square icon: just your symbol, without the name. Used wherever there's only room for a small square."
					recommended="SVG, or a 512×512 px PNG"
					shownIn={["Browser tab", "Collapsed sidebar", "Form editor"]}
					title="App icon & favicon"
				>
					<LogoUpload
						kind="icon"
						label="App icon"
						onChange={(url) => onChange({ faviconUrl: url })}
						value={values.faviconUrl}
					/>
				</GuideCard>
				<GuideCard
					description="Buttons, links, the active menu item, focus rings and soft highlights."
					shownIn={["Buttons", "Links", "Sidebar", "Sign-in page"]}
					title="Brand colour"
				>
					<ColorPicker
						onChange={(color) => onChange({ primaryColor: color })}
						value={values.primaryColor}
					/>
				</GuideCard>
				<FormsNote />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<GuideCard
				description="A light or white version of your logo, for dark mode and the coloured sign-in panel. Until you add one, your light logo is shown on a small white tile so it stays readable."
				fallback={values.logoDarkUrl ? null : "Using your light logo"}
				recommended="Same size and format as the light logo, in white or light colours"
				shownIn={["Dark mode sidebar", "Sign-in panel"]}
				title="Logo"
			>
				<LogoUpload
					backdrop="dark"
					label="Dark mode logo"
					onChange={(url) => onChange({ logoDarkUrl: url })}
					value={values.logoDarkUrl}
				/>
			</GuideCard>
			<GuideCard
				description="Only needed if your light icon is hard to see on dark backgrounds (for example a black symbol). Browsers pick it automatically when the device is in dark mode."
				fallback={values.faviconDarkUrl ? null : "Using your light icon"}
				recommended="SVG, or a 512×512 px PNG"
				shownIn={["Browser tab (dark)", "Collapsed sidebar", "Form editor"]}
				title="App icon & favicon"
			>
				<LogoUpload
					backdrop="dark"
					kind="icon"
					label="Dark mode app icon"
					onChange={(url) => onChange({ faviconDarkUrl: url })}
					value={values.faviconDarkUrl}
				/>
			</GuideCard>
			<GuideCard
				description="Dark backgrounds usually need a slightly lighter, brighter version of your brand colour to keep enough contrast."
				fallback={values.primaryColorDark ? null : "Same as light mode"}
				shownIn={["Buttons", "Links", "Sidebar", "Sign-in page"]}
				title="Brand colour"
			>
				{values.primaryColorDark ? (
					<div className="space-y-2">
						<ColorPicker
							onChange={(color) => onChange({ primaryColorDark: color })}
							value={values.primaryColorDark}
						/>
						<Button
							onClick={() => onChange({ primaryColorDark: null })}
							size="sm"
							type="button"
							variant="ghost"
						>
							Use the light colour
						</Button>
					</div>
				) : (
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							<span
								className="size-6 rounded-md border border-border"
								style={{ backgroundColor: values.primaryColor }}
							/>
							<span className="font-mono text-xs">
								{values.primaryColor.toUpperCase()}
							</span>
						</div>
						<Button
							onClick={() =>
								onChange({ primaryColorDark: values.primaryColor })
							}
							size="sm"
							type="button"
							variant="outline"
						>
							Set a dark mode colour
						</Button>
					</div>
				)}
			</GuideCard>
			<FormsNote />
		</div>
	);
}

function FormsNote() {
	return (
		<p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-info text-sm">
			<InfoIcon className="mt-0.5 size-4 shrink-0" />
			<span>
				These brand the app itself. To put a logo on your forms, set it per
				workspace in{" "}
				<Link
					className="font-medium underline underline-offset-2"
					search={{ tab: "brand" }}
					to="/dashboard/settings"
				>
					Settings → Brand
				</Link>
				.
			</span>
		</p>
	);
}
