import { autoDarkColor } from "@StryveForms/emails/color";
import {
	EMAIL_BUTTON_STYLES,
	EMAIL_CORNER_RADII,
	EMAIL_DARK_MODES,
	EMAIL_FONT_FAMILIES,
	EMAIL_HEADER_STYLES,
	EMAIL_LOGO_ALIGNS,
	EMAIL_SOCIAL_ALIGNS,
	EMAIL_SOCIAL_DISPLAYS,
	EMAIL_SOCIAL_ICON_STYLES,
	type EmailSettings,
	type EmailSocialLink,
	normalizeSocialUrl,
} from "@StryveForms/emails/settings";
import {
	detectSocialNetwork,
	SOCIAL_NETWORK_IDS,
	SOCIAL_NETWORK_LIST,
	type SocialNetworkId,
	socialIconPath,
} from "@StryveForms/emails/social";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Separator } from "@StryveForms/ui/components/separator";
import { Switch } from "@StryveForms/ui/components/switch";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import ColorPicker, {
	NEUTRAL_PRESETS,
} from "@/components/app/branding/color-picker";
import LogoUpload from "@/components/app/branding/logo-upload";
import { apiBase } from "@/lib/api-url";

const FONT_LABELS: Record<(typeof EMAIL_FONT_FAMILIES)[number], string> = {
	georgia: "Georgia (serif)",
	helvetica: "Helvetica / Arial",
	inter: "Inter",
	system: "System default",
};

const RADIUS_LABELS: Record<(typeof EMAIL_CORNER_RADII)[number], string> = {
	large: "Large",
	none: "None",
	small: "Small",
};

const HEADER_STYLE_LABELS: Record<
	(typeof EMAIL_HEADER_STYLES)[number],
	string
> = {
	banner: "Coloured banner",
	logo: "Logo only",
	"logo-name": "Logo + product name",
};

const LOGO_ALIGN_LABELS: Record<(typeof EMAIL_LOGO_ALIGNS)[number], string> = {
	center: "Centered",
	left: "Left",
};

const BUTTON_STYLE_LABELS: Record<
	(typeof EMAIL_BUTTON_STYLES)[number],
	string
> = {
	filled: "Filled",
	outline: "Outline",
};

const DARK_MODE_LABELS: Record<(typeof EMAIL_DARK_MODES)[number], string> = {
	auto: "Auto (match the reader's email client)",
	"light-only": "Always light",
};

const SOCIAL_DISPLAY_LABELS: Record<
	(typeof EMAIL_SOCIAL_DISPLAYS)[number],
	string
> = {
	icons: "Icons only",
	"icon-label": "Icon + label",
	label: "Label only",
};

const SOCIAL_ICON_STYLE_LABELS: Record<
	(typeof EMAIL_SOCIAL_ICON_STYLES)[number],
	string
> = {
	brand: "Brand colours",
	mono: "Single colour",
	muted: "Muted grey",
};

const SOCIAL_ALIGN_LABELS: Record<
	(typeof EMAIL_SOCIAL_ALIGNS)[number],
	string
> = {
	center: "Centered",
	left: "Left",
	right: "Right",
};

function Section({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) {
	return (
		<div className="space-y-4">
			<h3 className="font-semibold text-base">{title}</h3>
			{children}
		</div>
	);
}

function ColorField({
	hint,
	label,
	neutral = false,
	onChange,
	value,
}: {
	hint?: string;
	label: string;
	/** Offer neutral presets (backgrounds, text) instead of accent colours. */
	neutral?: boolean;
	onChange: (color: string) => void;
	value: string;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<ColorPicker
				onChange={onChange}
				presets={neutral ? NEUTRAL_PRESETS : undefined}
				value={value}
			/>
			{hint ? <p className="text-subtle-foreground text-xs">{hint}</p> : null}
		</div>
	);
}

/** A light colour with an optional dark-mode override: "auto" shows the derived swatch. */
function DarkColorField({
	autoTarget,
	label,
	onChange,
	value,
}: {
	/** Target lightness (0-100) used to preview the auto-derived colour. */
	autoTarget: number;
	label: string;
	onChange: (color: string | null) => void;
	value: string | null;
}) {
	const lightValue = value; // null means "derive automatically"
	return (
		<div className="space-y-2 border-border border-b pb-4 last:border-b-0 last:pb-0">
			<div className="flex items-center justify-between gap-3">
				<Label>{label}</Label>
				<div className="flex items-center gap-2">
					<span className="text-subtle-foreground text-xs">Custom</span>
					<Switch
						checked={lightValue !== null}
						onCheckedChange={(checked) => onChange(checked ? "#18181b" : null)}
					/>
				</div>
			</div>
			{lightValue === null ? (
				<p className="text-subtle-foreground text-xs italic">
					Auto-derived from the light colour (target lightness {autoTarget}%).
				</p>
			) : (
				<ColorPicker
					onChange={onChange}
					presets={NEUTRAL_PRESETS}
					value={lightValue}
				/>
			)}
		</div>
	);
}

/** Resolves (network, auto-detected or picked) icon colour for the preview thumbnail. */
function previewIconUrl(
	network: SocialNetworkId,
	style: EmailSettings["socialIconStyle"],
	size: number,
	color: string
) {
	return `${apiBase()}${socialIconPath(network, style, size, color)}`;
}

function SocialLinkRow({
	index,
	link,
	onChange,
	onRemove,
	settings,
}: {
	index: number;
	link: EmailSocialLink;
	onChange: (patch: Partial<EmailSocialLink>) => void;
	onRemove: () => void;
	settings: EmailSettings;
}) {
	const [networkIsManual, setNetworkIsManual] = useState(false);

	const trimmedUrl = link.url.trim();
	const status: "empty" | "invalid" | "ok" = (() => {
		if (!trimmedUrl) {
			return "empty";
		}
		try {
			const parsed = new URL(normalizeSocialUrl(trimmedUrl));
			return parsed.protocol ? "ok" : "invalid";
		} catch {
			return "invalid";
		}
	})();

	return (
		<div className="space-y-1.5 rounded-lg border border-border p-3">
			<div className="flex items-center gap-2">
				<img
					alt=""
					className="size-7 shrink-0 rounded-full"
					height={28}
					src={previewIconUrl(
						link.network,
						settings.socialIconStyle,
						settings.socialIconSize,
						settings.socialIconColor
					)}
					width={28}
				/>
				<Select
					items={SOCIAL_NETWORK_LIST.map((n) => ({
						label: n.label,
						value: n.id,
					}))}
					onValueChange={(v) => {
						if (!v) {
							return;
						}
						setNetworkIsManual(true);
						onChange({ network: v as SocialNetworkId });
					}}
					value={link.network}
				>
					<SelectTrigger className="w-36 shrink-0">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SOCIAL_NETWORK_IDS.map((id) => (
							<SelectItem key={id} value={id}>
								{SOCIAL_NETWORK_LIST.find((n) => n.id === id)?.label ?? id}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					className="w-28"
					onChange={(e) => onChange({ label: e.target.value })}
					placeholder={
						SOCIAL_NETWORK_LIST.find((n) => n.id === link.network)?.label
					}
					value={link.label}
				/>
				<Input
					aria-invalid={status === "invalid"}
					className="flex-1"
					onBlur={() => {
						if (!networkIsManual && trimmedUrl) {
							onChange({ network: detectSocialNetwork(trimmedUrl) });
						}
					}}
					onChange={(e) => onChange({ url: e.target.value })}
					placeholder="https:// or a handle"
					value={link.url}
				/>
				<Button
					aria-label={`Remove social link ${index + 1}`}
					onClick={onRemove}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<XIcon />
				</Button>
			</div>
			{status === "invalid" ? (
				<p className="pl-9 text-destructive text-xs">
					Enter a valid URL (we'll add https:// for you if you leave it off).
				</p>
			) : null}
			{status === "empty" ? (
				<p className="pl-9 text-subtle-foreground text-xs italic">
					Empty — this row is removed automatically when you save.
				</p>
			) : null}
		</div>
	);
}

export default function EmailSettingsForm({
	onChange,
	value,
}: {
	onChange: (next: EmailSettings) => void;
	value: EmailSettings;
}) {
	const set = <K extends keyof EmailSettings>(
		key: K,
		fieldValue: EmailSettings[K]
	) => onChange({ ...value, [key]: fieldValue });

	const addSocialLink = () =>
		set("socialLinks", [
			...value.socialLinks,
			{ label: "", network: "website", url: "" },
		]);
	const updateSocialLink = (index: number, patch: Partial<EmailSocialLink>) =>
		set(
			"socialLinks",
			value.socialLinks.map((link, i) =>
				i === index ? { ...link, ...patch } : link
			)
		);
	const removeSocialLink = (index: number) =>
		set(
			"socialLinks",
			value.socialLinks.filter((_, i) => i !== index)
		);

	return (
		<div className="space-y-8">
			<Section title="Colours">
				<div className="grid grid-cols-2 gap-4">
					<ColorField
						label="Accent"
						onChange={(c) => set("accentColor", c)}
						value={value.accentColor}
					/>
					<ColorField
						label="Page background"
						neutral
						onChange={(c) => set("backgroundColor", c)}
						value={value.backgroundColor}
					/>
					<ColorField
						label="Card background"
						neutral
						onChange={(c) => set("contentBackgroundColor", c)}
						value={value.contentBackgroundColor}
					/>
					<ColorField
						label="Heading text"
						neutral
						onChange={(c) => set("headingColor", c)}
						value={value.headingColor}
					/>
					<ColorField
						label="Body text"
						neutral
						onChange={(c) => set("textColor", c)}
						value={value.textColor}
					/>
					<ColorField
						label="Muted text"
						neutral
						onChange={(c) => set("mutedColor", c)}
						value={value.mutedColor}
					/>
				</div>
			</Section>

			<Separator />

			<Section title="Dark mode">
				<div className="space-y-2">
					<Label>Support</Label>
					<Select
						items={EMAIL_DARK_MODES.map((m) => ({
							label: DARK_MODE_LABELS[m],
							value: m,
						}))}
						onValueChange={(v) => v && set("emailDarkMode", v)}
						value={value.emailDarkMode}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{EMAIL_DARK_MODES.map((m) => (
								<SelectItem key={m} value={m}>
									{DARK_MODE_LABELS[m]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="text-subtle-foreground text-xs">
						"Auto" adds proper `color-scheme` CSS so Apple Mail, Gmail and
						Outlook.com switch to a dark palette automatically. Each colour
						below defaults to an automatic dark counterpart, or pick your own.
					</p>
				</div>

				{value.emailDarkMode === "auto" ? (
					<div className="space-y-4 rounded-lg border border-border p-3">
						<DarkColorField
							autoTarget={10}
							label="Page background"
							onChange={(c) => set("darkBackgroundColor", c)}
							value={value.darkBackgroundColor}
						/>
						<DarkColorField
							autoTarget={16}
							label="Card background"
							onChange={(c) => set("darkContentBackgroundColor", c)}
							value={value.darkContentBackgroundColor}
						/>
						<DarkColorField
							autoTarget={96}
							label="Heading text"
							onChange={(c) => set("darkHeadingColor", c)}
							value={value.darkHeadingColor}
						/>
						<DarkColorField
							autoTarget={88}
							label="Body text"
							onChange={(c) => set("darkTextColor", c)}
							value={value.darkTextColor}
						/>
						<DarkColorField
							autoTarget={64}
							label="Muted text"
							onChange={(c) => set("darkMutedColor", c)}
							value={value.darkMutedColor}
						/>
						<DarkColorField
							autoTarget={50}
							label="Accent (buttons, banner)"
							onChange={(c) => set("darkAccentColor", c)}
							value={value.darkAccentColor}
						/>
						<p className="text-subtle-foreground text-xs">
							Right now, auto colours resolve to: background{" "}
							{autoDarkColor(value.backgroundColor, 10)}, card{" "}
							{autoDarkColor(value.contentBackgroundColor, 16)}.
						</p>
					</div>
				) : null}
			</Section>

			<Separator />

			<Section title="Typography">
				<div className="space-y-2">
					<Label>Font</Label>
					<Select
						items={EMAIL_FONT_FAMILIES.map((f) => ({
							label: FONT_LABELS[f],
							value: f,
						}))}
						onValueChange={(v) => v && set("fontFamily", v)}
						value={value.fontFamily}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{EMAIL_FONT_FAMILIES.map((f) => (
								<SelectItem key={f} value={f}>
									{FONT_LABELS[f]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</Section>

			<Separator />

			<Section title="Header & logo">
				<LogoUpload
					label="Email logo"
					onChange={(url) => set("logoUrl", url)}
					value={value.logoUrl}
				/>
				<LogoUpload
					label="Dark mode logo (optional — shown instead of the logo above when the reader is in dark mode)"
					onChange={(url) => set("logoDarkUrl", url)}
					value={value.logoDarkUrl}
				/>
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="email-logo-width">Logo width (px)</Label>
						<Input
							id="email-logo-width"
							max={400}
							min={24}
							onChange={(e) =>
								set("logoWidth", Number(e.target.value) || value.logoWidth)
							}
							type="number"
							value={value.logoWidth}
						/>
					</div>
					<div className="space-y-2">
						<Label>Logo alignment</Label>
						<Select
							items={EMAIL_LOGO_ALIGNS.map((a) => ({
								label: LOGO_ALIGN_LABELS[a],
								value: a,
							}))}
							onValueChange={(v) => v && set("logoAlign", v)}
							value={value.logoAlign}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EMAIL_LOGO_ALIGNS.map((a) => (
									<SelectItem key={a} value={a}>
										{LOGO_ALIGN_LABELS[a]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className="space-y-2">
					<Label>Header style</Label>
					<Select
						items={EMAIL_HEADER_STYLES.map((s) => ({
							label: HEADER_STYLE_LABELS[s],
							value: s,
						}))}
						onValueChange={(v) => v && set("headerStyle", v)}
						value={value.headerStyle}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{EMAIL_HEADER_STYLES.map((s) => (
								<SelectItem key={s} value={s}>
									{HEADER_STYLE_LABELS[s]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</Section>

			<Separator />

			<Section title="Buttons & corners">
				<div className="grid grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label>Button style</Label>
						<Select
							items={EMAIL_BUTTON_STYLES.map((s) => ({
								label: BUTTON_STYLE_LABELS[s],
								value: s,
							}))}
							onValueChange={(v) => v && set("buttonStyle", v)}
							value={value.buttonStyle}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EMAIL_BUTTON_STYLES.map((s) => (
									<SelectItem key={s} value={s}>
										{BUTTON_STYLE_LABELS[s]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Corner radius</Label>
						<Select
							items={EMAIL_CORNER_RADII.map((r) => ({
								label: RADIUS_LABELS[r],
								value: r,
							}))}
							onValueChange={(v) => v && set("cornerRadius", v)}
							value={value.cornerRadius}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EMAIL_CORNER_RADII.map((r) => (
									<SelectItem key={r} value={r}>
										{RADIUS_LABELS[r]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</Section>

			<Separator />

			<Section title="Footer">
				<div className="space-y-2">
					<Label htmlFor="email-footer-text">Footer text</Label>
					<Textarea
						id="email-footer-text"
						onChange={(e) => set("footerText", e.target.value || null)}
						placeholder="Questions? Reply to this email or contact us at…"
						value={value.footerText ?? ""}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="email-company-address">Company address</Label>
					<Input
						id="email-company-address"
						onChange={(e) => set("companyAddress", e.target.value || null)}
						placeholder="123 Main St, Springfield"
						value={value.companyAddress ?? ""}
					/>
				</div>

				<div className="space-y-2">
					<Label>Social links</Label>
					<p className="text-subtle-foreground text-xs">
						Paste a profile URL (or just a handle/domain) — we detect the
						network automatically; override it with the picker if needed.
					</p>
					<div className="space-y-2">
						{value.socialLinks.map((link, index) => (
							<SocialLinkRow
								index={index}
								// biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id before saving
								key={index}
								link={link}
								onChange={(patch) => updateSocialLink(index, patch)}
								onRemove={() => removeSocialLink(index)}
								settings={value}
							/>
						))}
					</div>
					{value.socialLinks.length < 10 ? (
						<Button
							onClick={addSocialLink}
							size="sm"
							type="button"
							variant="outline"
						>
							<PlusIcon />
							Add link
						</Button>
					) : null}
				</div>

				<div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-3">
					<div className="space-y-2">
						<Label>Show as</Label>
						<Select
							items={EMAIL_SOCIAL_DISPLAYS.map((d) => ({
								label: SOCIAL_DISPLAY_LABELS[d],
								value: d,
							}))}
							onValueChange={(v) => v && set("socialDisplay", v)}
							value={value.socialDisplay}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EMAIL_SOCIAL_DISPLAYS.map((d) => (
									<SelectItem key={d} value={d}>
										{SOCIAL_DISPLAY_LABELS[d]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Alignment</Label>
						<Select
							items={EMAIL_SOCIAL_ALIGNS.map((a) => ({
								label: SOCIAL_ALIGN_LABELS[a],
								value: a,
							}))}
							onValueChange={(v) => v && set("socialAlign", v)}
							value={value.socialAlign}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EMAIL_SOCIAL_ALIGNS.map((a) => (
									<SelectItem key={a} value={a}>
										{SOCIAL_ALIGN_LABELS[a]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Icon colour</Label>
						<Select
							items={EMAIL_SOCIAL_ICON_STYLES.map((s) => ({
								label: SOCIAL_ICON_STYLE_LABELS[s],
								value: s,
							}))}
							onValueChange={(v) => v && set("socialIconStyle", v)}
							value={value.socialIconStyle}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EMAIL_SOCIAL_ICON_STYLES.map((s) => (
									<SelectItem key={s} value={s}>
										{SOCIAL_ICON_STYLE_LABELS[s]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{value.socialIconStyle === "mono" ? (
						<ColorField
							label="Icon colour"
							onChange={(c) => set("socialIconColor", c)}
							value={value.socialIconColor}
						/>
					) : null}
					<div className="space-y-2">
						<Label htmlFor="email-social-size">Icon size (px)</Label>
						<Input
							id="email-social-size"
							max={64}
							min={16}
							onChange={(e) =>
								set(
									"socialIconSize",
									Number(e.target.value) || value.socialIconSize
								)
							}
							type="number"
							value={value.socialIconSize}
						/>
					</div>
				</div>

				<div className="flex items-center justify-between rounded-lg border border-border p-3">
					<div>
						<p className="font-medium text-sm">Show "Sent with StryveForms"</p>
						<p className="text-subtle-foreground text-xs">
							A small credit line in the footer of every email.
						</p>
					</div>
					<Switch
						checked={value.showPoweredBy}
						onCheckedChange={(checked) => set("showPoweredBy", checked)}
					/>
				</div>
			</Section>
		</div>
	);
}
