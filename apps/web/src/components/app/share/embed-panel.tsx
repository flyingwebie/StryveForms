import type { FormDto } from "@StryveForms/api/lib/serialize";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Calendar,
	Clipboard,
	Headphones,
	HelpCircle,
	Info,
	Loader2Icon,
	type LucideIcon,
	Mail,
	MessageCircle,
	Phone,
	Send,
	Sparkles,
	UploadIcon,
	XIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ColorPicker, {
	NEUTRAL_PRESETS,
} from "@/components/app/branding/color-picker";
import { uploadAsset } from "@/lib/upload-asset";
import { useTRPC } from "@/utils/trpc";
import { CodeBlock } from "../code-block";

const DEFAULT_HEIGHT = 600;

/** Appends `embed=1` to the form's share URL, same as embed.js does for any
 * iframe it finds — baked into the generated snippets here too so a visitor
 * never needs embed.js just for that: the public page itself drops its
 * full-viewport min-height and (with "Transparent background" on) shows
 * through to the host page whenever this param is present. */
function withEmbedParam(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.searchParams.set("embed", "1");
		return parsed.toString();
	} catch {
		return url;
	}
}

const CURATED_ICONS = [
	{ Icon: MessageCircle, id: "message-circle", label: "Message" },
	{ Icon: HelpCircle, id: "help-circle", label: "Help" },
	{ Icon: Mail, id: "mail", label: "Mail" },
	{ Icon: Calendar, id: "calendar", label: "Calendar" },
	{ Icon: Clipboard, id: "clipboard", label: "Clipboard" },
	{ Icon: Sparkles, id: "sparkles", label: "Sparkles" },
	{ Icon: Info, id: "info", label: "Info" },
	{ Icon: Phone, id: "phone", label: "Phone" },
	{ Icon: Headphones, id: "headphones", label: "Support" },
	{ Icon: Send, id: "send", label: "Send" },
] as const satisfies readonly { Icon: LucideIcon; id: string; label: string }[];

type EmbedIconId = (typeof CURATED_ICONS)[number]["id"];
const ICON_IDS = new Set<string>(CURATED_ICONS.map((icon) => icon.id));
const SIZE_PRESETS = [
	{ label: "S · 48", value: 48 },
	{ label: "M · 56", value: 56 },
	{ label: "L · 64", value: 64 },
] as const;

/** Defaults baked into embed.js — kept out of the generated snippet when matched, so it stays short. */
const EMBED_DEFAULTS = {
	bgcolor: "#3B82F6",
	icon: "message-circle" as EmbedIconId,
	iconColor: "#ffffff",
	position: "right" as const,
	size: 56,
	width: "400",
};

interface EmbedPopupSettings {
	bgcolor: string;
	hideOnMobile: boolean;
	icon: EmbedIconId;
	iconColor: string;
	iconUrl: string | null;
	label: string;
	openDelaySeconds: number | null;
	panelWidth: number;
	position: "left" | "right";
	size: number;
	useWorkspaceStyle: boolean;
}

function defaultEmbedPopupSettings(brandColor: string): EmbedPopupSettings {
	return {
		bgcolor: brandColor,
		hideOnMobile: false,
		icon: "message-circle",
		iconColor: "#ffffff",
		iconUrl: null,
		label: "",
		openDelaySeconds: null,
		panelWidth: 400,
		position: "right",
		size: 56,
		useWorkspaceStyle: true,
	};
}

/** Reads a (possibly stale or hand-edited) jsonb value back into a safe settings object. */
function parseEmbedPopupSettings(
	raw: unknown,
	brandColor: string
): EmbedPopupSettings {
	const fallback = defaultEmbedPopupSettings(brandColor);
	if (!raw || typeof raw !== "object") {
		return fallback;
	}
	const value = raw as Record<string, unknown>;
	const icon =
		typeof value.icon === "string" && ICON_IDS.has(value.icon)
			? (value.icon as EmbedIconId)
			: fallback.icon;
	return {
		bgcolor:
			typeof value.bgcolor === "string" ? value.bgcolor : fallback.bgcolor,
		hideOnMobile: Boolean(value.hideOnMobile),
		icon,
		iconColor:
			typeof value.iconColor === "string"
				? value.iconColor
				: fallback.iconColor,
		iconUrl: typeof value.iconUrl === "string" ? value.iconUrl : null,
		label: typeof value.label === "string" ? value.label.slice(0, 60) : "",
		openDelaySeconds:
			typeof value.openDelaySeconds === "number"
				? value.openDelaySeconds
				: null,
		panelWidth:
			typeof value.panelWidth === "number"
				? value.panelWidth
				: fallback.panelWidth,
		position: value.position === "left" ? "left" : "right",
		size:
			typeof value.size === "number" && [48, 56, 64].includes(value.size)
				? value.size
				: fallback.size,
		useWorkspaceStyle:
			typeof value.useWorkspaceStyle === "boolean"
				? value.useWorkspaceStyle
				: fallback.useWorkspaceStyle,
	};
}

/** The button colour and icon colour actually used — the workspace brand colour unless customized. */
function effectiveColors(settings: EmbedPopupSettings, brandColor: string) {
	if (settings.useWorkspaceStyle) {
		return { bgcolor: brandColor, iconColor: "#ffffff" };
	}
	return { bgcolor: settings.bgcolor, iconColor: settings.iconColor };
}

/** Only emits keys that differ from embed.js's built-in defaults, so the snippet stays short. */
function buildPopupSnippetConfig(
	settings: EmbedPopupSettings,
	brandColor: string,
	shareUrl: string
) {
	const { bgcolor, iconColor } = effectiveColors(settings, brandColor);
	const out: Record<string, unknown> = { formUrl: shareUrl };
	if (bgcolor !== EMBED_DEFAULTS.bgcolor) {
		out.bgcolor = bgcolor;
	}
	if (settings.iconUrl) {
		out.iconUrl = settings.iconUrl;
	} else if (settings.icon !== EMBED_DEFAULTS.icon) {
		out.icon = settings.icon;
	}
	if (iconColor !== EMBED_DEFAULTS.iconColor) {
		out.iconColor = iconColor;
	}
	if (settings.position !== EMBED_DEFAULTS.position) {
		out.position = settings.position;
	}
	if (settings.size !== EMBED_DEFAULTS.size) {
		out.size = settings.size;
	}
	if (String(settings.panelWidth) !== EMBED_DEFAULTS.width) {
		out.width = String(settings.panelWidth);
	}
	if (settings.label.trim()) {
		out.label = settings.label.trim();
	}
	if (settings.openDelaySeconds !== null) {
		out.openDelay = settings.openDelaySeconds;
	}
	if (settings.hideOnMobile) {
		out.hideOnMobile = true;
	}
	return out;
}

/** A mock webpage running the real generated snippet, so the preview always matches what you copy. */
function EmbedPreviewFrame({
	height = 420,
	snippetHtml,
}: {
	height?: number;
	snippetHtml: string;
}) {
	const doc = useMemo(
		() => `<!doctype html><html><head><meta charset="utf-8" />
<style>
html,body{margin:0;height:100%;font-family:ui-sans-serif,system-ui,sans-serif;background:#f8fafc;color:#0f172a;}
.sf-preview-page{max-width:640px;margin:0 auto;padding:48px 24px;box-sizing:border-box;}
.sf-preview-page h1{font-size:26px;margin:0 0 10px;}
.sf-preview-page p{color:#64748b;line-height:1.6;margin:0 0 8px;}
</style></head>
<body>
<div class="sf-preview-page">
<h1>Acme Inc.</h1>
<p>This is a live preview of your website with the embed installed below.</p>
<p>Click the button to see what visitors will experience.</p>
</div>
${snippetHtml}
</body></html>`,
		[snippetHtml]
	);

	return (
		<div className="overflow-hidden rounded-xl border border-border">
			<div
				aria-hidden="true"
				className="flex items-center gap-1.5 border-border border-b bg-muted/50 px-3 py-2"
			>
				<span className="size-2.5 rounded-full bg-red-400" />
				<span className="size-2.5 rounded-full bg-amber-400" />
				<span className="size-2.5 rounded-full bg-emerald-400" />
				<span className="ml-2 truncate rounded-md bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
					yourwebsite.com
				</span>
			</div>
			{/* Runs the exact snippet above inside a sandboxed, same-origin iframe. */}
			<iframe
				className="block w-full bg-white"
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
				srcDoc={doc}
				style={{ height }}
				title="Embed preview"
			/>
		</div>
	);
}

/** Icon grid plus an "upload your own image" option. Never defaults to an emoji. */
function IconPicker({
	iconUrl,
	onClearImage,
	onSelectIcon,
	onUploadImage,
	value,
}: {
	iconUrl: string | null;
	onClearImage: () => void;
	onSelectIcon: (id: EmbedIconId) => void;
	onUploadImage: (url: string) => void;
	value: EmbedIconId;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	async function handleFile(file: File) {
		setUploading(true);
		try {
			onUploadImage(await uploadAsset(file));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	}

	return (
		<div className="space-y-2">
			<Label>Launcher icon</Label>
			<p className="text-muted-foreground text-xs">
				Shown on the floating button. Pick one of these, or upload your own
				square image.
			</p>
			<div className="grid grid-cols-5 gap-2">
				{CURATED_ICONS.map(({ Icon, id, label }) => (
					<button
						className="flex aspect-square items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted data-selected:border-primary data-selected:bg-primary/10 data-selected:text-primary"
						data-selected={!iconUrl && value === id}
						key={id}
						onClick={() => onSelectIcon(id)}
						title={label}
						type="button"
					>
						<Icon className="size-4" />
						<span className="sr-only">{label}</span>
					</button>
				))}
			</div>
			<div className="flex items-center gap-2">
				{iconUrl ? (
					<>
						<img
							alt="Custom launcher icon"
							className="size-8 rounded-lg border border-border object-contain"
							height={32}
							src={iconUrl}
							width={32}
						/>
						<Button
							onClick={onClearImage}
							size="sm"
							type="button"
							variant="outline"
						>
							<XIcon /> Remove image
						</Button>
					</>
				) : (
					<Button
						disabled={uploading}
						onClick={() => inputRef.current?.click()}
						size="sm"
						type="button"
						variant="outline"
					>
						{uploading ? (
							<Loader2Icon className="animate-spin" />
						) : (
							<UploadIcon />
						)}
						Upload custom icon
					</Button>
				)}
				<input
					accept="image/*"
					className="hidden"
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file) {
							handleFile(file);
						}
						event.target.value = "";
					}}
					ref={inputRef}
					type="file"
				/>
			</div>
		</div>
	);
}

/**
 * The popup's full customization form: workspace-style toggle + colours,
 * icon, position/size, optional label, panel width, open behaviour, and
 * hide-on-mobile — each with a plain-language description.
 */
function PopupCustomizer({
	brandColor,
	onChange,
	settings,
}: {
	brandColor: string;
	onChange: (next: EmbedPopupSettings) => void;
	settings: EmbedPopupSettings;
}) {
	function patch(next: Partial<EmbedPopupSettings>) {
		onChange({ ...settings, ...next });
	}

	return (
		<div className="space-y-5">
			<div className="space-y-2 rounded-xl border border-border p-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<Label htmlFor="embed-popup-workspace-style">
							Use workspace style
						</Label>
						<p className="text-muted-foreground text-xs">
							Matches your workspace's brand colour automatically. Turn off to
							pick a colour just for this popup.
						</p>
					</div>
					<Switch
						checked={settings.useWorkspaceStyle}
						id="embed-popup-workspace-style"
						onCheckedChange={(checked) =>
							patch(
								checked
									? { useWorkspaceStyle: true }
									: {
											bgcolor: settings.bgcolor,
											iconColor: settings.iconColor,
											useWorkspaceStyle: false,
										}
							)
						}
					/>
				</div>
				{settings.useWorkspaceStyle ? (
					<p className="text-muted-foreground text-xs italic">
						Using your workspace colour ({brandColor}).
					</p>
				) : (
					<div className="space-y-3 pt-1">
						<div className="space-y-1.5">
							<Label className="text-muted-foreground text-xs">
								Button colour
							</Label>
							<ColorPicker
								onChange={(bgcolor) => patch({ bgcolor })}
								value={settings.bgcolor}
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-muted-foreground text-xs">
								Icon colour
							</Label>
							<ColorPicker
								onChange={(iconColor) => patch({ iconColor })}
								presets={NEUTRAL_PRESETS}
								value={settings.iconColor}
							/>
						</div>
					</div>
				)}
			</div>

			<IconPicker
				iconUrl={settings.iconUrl}
				onClearImage={() => patch({ iconUrl: null })}
				onSelectIcon={(icon) => patch({ icon, iconUrl: null })}
				onUploadImage={(iconUrl) => patch({ iconUrl })}
				value={settings.icon}
			/>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-1.5">
					<Label>Position</Label>
					<p className="text-muted-foreground text-xs">
						Which bottom corner the button sits in.
					</p>
					<div className="flex gap-2">
						<Button
							onClick={() => patch({ position: "left" })}
							size="sm"
							type="button"
							variant={settings.position === "left" ? "default" : "outline"}
						>
							Bottom left
						</Button>
						<Button
							onClick={() => patch({ position: "right" })}
							size="sm"
							type="button"
							variant={settings.position === "right" ? "default" : "outline"}
						>
							Bottom right
						</Button>
					</div>
				</div>
				<div className="space-y-1.5">
					<Label>Button size</Label>
					<p className="text-muted-foreground text-xs">
						How big the launcher button is.
					</p>
					<div className="flex gap-2">
						{SIZE_PRESETS.map((preset) => (
							<Button
								key={preset.value}
								onClick={() => patch({ size: preset.value })}
								size="sm"
								type="button"
								variant={settings.size === preset.value ? "default" : "outline"}
							>
								{preset.label}
							</Button>
						))}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div className="space-y-1.5">
					<Label htmlFor="embed-popup-label">Label text (optional)</Label>
					<p className="text-muted-foreground text-xs">
						A short pill next to the button, e.g. "Contact us".
					</p>
					<Input
						id="embed-popup-label"
						maxLength={60}
						onChange={(event) => patch({ label: event.target.value })}
						placeholder="Contact us"
						value={settings.label}
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="embed-popup-width">Panel width (px)</Label>
					<p className="text-muted-foreground text-xs">
						How wide the form panel opens.
					</p>
					<Input
						id="embed-popup-width"
						max={720}
						min={280}
						onChange={(event) =>
							patch({
								panelWidth: Number(event.target.value) || DEFAULT_HEIGHT,
							})
						}
						type="number"
						value={settings.panelWidth}
					/>
				</div>
			</div>

			<div className="space-y-3 rounded-xl border border-border p-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<Label htmlFor="embed-popup-auto-open">Open automatically</Label>
						<p className="text-muted-foreground text-xs">
							Pops the panel open on its own after visitors arrive, instead of
							waiting for a click.
						</p>
					</div>
					<Switch
						checked={settings.openDelaySeconds !== null}
						id="embed-popup-auto-open"
						onCheckedChange={(checked) =>
							patch({ openDelaySeconds: checked ? 3 : null })
						}
					/>
				</div>
				{settings.openDelaySeconds === null ? null : (
					<div className="flex items-center gap-2">
						<Label
							className="text-muted-foreground text-xs"
							htmlFor="embed-popup-delay"
						>
							Delay (seconds)
						</Label>
						<Input
							className="w-20"
							id="embed-popup-delay"
							max={60}
							min={0}
							onChange={(event) =>
								patch({ openDelaySeconds: Number(event.target.value) || 0 })
							}
							type="number"
							value={settings.openDelaySeconds}
						/>
					</div>
				)}
				<div className="flex items-center justify-between gap-3 border-border border-t pt-3">
					<div>
						<Label htmlFor="embed-popup-hide-mobile">Hide on mobile</Label>
						<p className="text-muted-foreground text-xs">
							Don't show the floating button on small screens.
						</p>
					</div>
					<Switch
						checked={settings.hideOnMobile}
						id="embed-popup-hide-mobile"
						onCheckedChange={(hideOnMobile) => patch({ hideOnMobile })}
					/>
				</div>
			</div>
		</div>
	);
}

/**
 * Embed snippets for pasting the form into another site: an iframe (with the
 * widget script auto-resizing it to fit, or a fixed height if preferred), and
 * a floating "popup" launcher that opens the form in a panel, with full
 * launcher customization and a live preview of both.
 */
export function EmbedPanel({
	appOrigin,
	brandColor,
	form,
}: {
	appOrigin: string;
	brandColor: string;
	form: FormDto;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [fixedHeight, setFixedHeight] = useState(false);
	const [height, setHeight] = useState(DEFAULT_HEIGHT);

	const rawSettings = (form.settings as Record<string, unknown> | null) ?? {};
	const [draft, setDraft] = useState<EmbedPopupSettings>(() =>
		parseEmbedPopupSettings(rawSettings.embedPopup, brandColor)
	);
	const saved = parseEmbedPopupSettings(rawSettings.embedPopup, brandColor);
	const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

	const save = useMutation(
		trpc.form.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.form.get.queryKey({ id: form.id }),
				});
				toast.success("Popup customization saved");
			},
		})
	);

	const embedShareUrl = withEmbedParam(form.shareUrl);
	const iframeStyle = fixedHeight
		? `border:none;width:100%;height:${height}px`
		: "border:none;width:100%";
	const iframeCode = fixedHeight
		? `<iframe data-stryveforms src="${embedShareUrl}" style="${iframeStyle}"></iframe>`
		: `<iframe data-stryveforms src="${embedShareUrl}" style="${iframeStyle}"></iframe>\n<script src="${appOrigin}/widgets/embed.js"></script>`;

	const popupConfig = buildPopupSnippetConfig(draft, brandColor, embedShareUrl);
	const popupCode = `<script data-sf='${JSON.stringify(popupConfig)}' src="${appOrigin}/widgets/embed.js"></script>`;

	return (
		<Tabs className="min-w-0" defaultValue="iframe">
			<TabsList>
				<TabsTrigger value="iframe">Iframe</TabsTrigger>
				<TabsTrigger value="popup">Popup launcher</TabsTrigger>
			</TabsList>
			<TabsContent className="min-w-0" value="iframe">
				<div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
					<div className="min-w-0 space-y-3">
						<label
							className="flex items-center gap-2 text-sm"
							htmlFor="fixed-height"
						>
							<input
								checked={fixedHeight}
								className="size-4 accent-primary"
								id="fixed-height"
								onChange={(event) => setFixedHeight(event.target.checked)}
								type="checkbox"
							/>
							Fixed height
						</label>
						{fixedHeight ? (
							<div className="flex items-center gap-2">
								<Label className="text-muted-foreground" htmlFor="embed-height">
									Height (px)
								</Label>
								<Input
									className="w-24"
									id="embed-height"
									min={200}
									onChange={(event) =>
										setHeight(Number(event.target.value) || DEFAULT_HEIGHT)
									}
									type="number"
									value={height}
								/>
							</div>
						) : (
							<p className="text-muted-foreground text-xs">
								Turn off fixed height to auto-resize the iframe to fit the form
								content.
							</p>
						)}
						<Label>Embed code</Label>
						<CodeBlock code={iframeCode} filename="embed.html" />
					</div>
					<div className="min-w-0 space-y-3">
						<Label>Live preview</Label>
						<EmbedPreviewFrame height={420} snippetHtml={iframeCode} />
					</div>
				</div>
			</TabsContent>
			<TabsContent className="min-w-0" value="popup">
				<div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
					<div className="min-w-0 space-y-5">
						<PopupCustomizer
							brandColor={brandColor}
							onChange={setDraft}
							settings={draft}
						/>
						<Button
							className="w-full"
							disabled={!dirty || save.isPending}
							onClick={() =>
								save.mutate({
									data: { settings: { ...rawSettings, embedPopup: draft } },
									id: form.id,
								})
							}
						>
							{save.isPending ? "Saving…" : "Save customization"}
						</Button>
						<div className="space-y-2">
							<Label>Embed code</Label>
							<CodeBlock code={popupCode} filename="popup.html" />
						</div>
					</div>
					<div className="min-w-0 space-y-3">
						<Label>Live preview</Label>
						<EmbedPreviewFrame height={520} snippetHtml={popupCode} />
					</div>
				</div>
			</TabsContent>
		</Tabs>
	);
}
