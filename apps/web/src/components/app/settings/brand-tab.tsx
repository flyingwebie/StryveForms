import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import {
	applyWorkspaceBrand,
	CLASSIC_LAYOUT_DESCRIPTIONS,
	CLASSIC_LAYOUT_LABELS,
	type WorkspaceBrand,
} from "@StryveForms/forms/brand";
import {
	BACKGROUND_IMAGE_FITS,
	BORDER_RADII,
	CLASSIC_LAYOUTS,
	DARK_MODES,
	DEFAULT_COLOR,
	DEFAULT_MAX_SUBMISSIONS_TEXT,
	DEFAULT_SUBMITTED_TEXT,
	FRAME_SHADOWS,
	LAYOUTS,
	SIZES,
	THEMES,
	WIDTHS,
} from "@StryveForms/forms/settings";
import type { FormField } from "@StryveForms/forms/types";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@StryveForms/ui/components/alert-dialog";
import { Button } from "@StryveForms/ui/components/button";
import { Label } from "@StryveForms/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import { Slider } from "@StryveForms/ui/components/slider";
import { Switch } from "@StryveForms/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ColorPicker, {
	NEUTRAL_PRESETS,
} from "@/components/app/branding/color-picker";
import LogoUpload from "@/components/app/branding/logo-upload";
import ImagePicker from "@/components/app/media/image-picker";
import {
	ClassicLayoutPreview,
	LayoutPreview,
} from "@/components/form-editor/design/illustrations";
import {
	OptionCard,
	OptionCardGrid,
} from "@/components/form-editor/design/option-card";
import { FormRenderer } from "@/components/form-renderer/form-renderer";
import { formatTrpcError } from "@/lib/format-trpc-error";
import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

/** Friendly names for the design options. */
const OPTION_LABELS: Record<string, string> = {
	auto: "Match visitor's system",
	centered: "Centered",
	dark: "Dark",
	default: "Default",
	full: "Full width",
	lg: "Large",
	light: "Light",
	md: "Medium",
	minimal: "Minimal",
	none: "Square",
	notion: "Notion",
	simple: "Simple",
	sm: "Small",
	small: "Slightly rounded",
	transparent: "Transparent",
};

/** Corner radius "full" means pill-shaped, not full width. */
const RADIUS_LABELS: Record<string, string> = {
	full: "Pill",
	none: "Square",
	small: "Slightly rounded",
};

const FONTS = [
	"Inter",
	"Roboto",
	"Open Sans",
	"Lato",
	"Montserrat",
	"Poppins",
	"Source Sans Pro",
	"Nunito",
	"Playfair Display",
	"Merriweather",
];

const DEFAULT_FONT = "__default__";

const SAMPLE_PROPERTIES: FormField[] = [
	{
		id: "full_name",
		name: "Full name",
		placeholder: "Jane Cooper",
		required: true,
		type: "text",
	},
	{
		id: "email",
		name: "Work email",
		placeholder: "jane@company.com",
		required: true,
		type: "email",
	},
	{
		id: "message",
		multi_lines: true,
		name: "What are you hoping to build?",
		placeholder: "Tell us a little about your project…",
		required: false,
		type: "text",
	},
];

/** A small stand-in form used to preview the brand guideline live. */
function sampleForm(brand: WorkspaceBrand): PublicFormDto {
	const base: PublicFormDto = {
		analytics: {},
		autoFocus: true,
		autoSave: false,
		borderRadius: "small",
		canBeIndexed: false,
		captchaProvider: "hcaptcha",
		classicLayout: "card",
		closedText: null,
		color: DEFAULT_COLOR,
		computedVariables: [],
		confettiOnSubmission: false,
		coverPicture: null,
		coverSettings: null,
		customCode: null,
		customCss: null,
		darkMode: "light",
		editableSubmissions: false,
		editableSubmissionsButtonText: "Edit submission",
		enablePartialSubmissions: false,
		fontFamily: null,
		hasPassword: false,
		id: "brand-preview",
		language: "en",
		layoutRtl: false,
		logoPicture: null,
		// Round-5 brand extras — the preview starts with every one unset so
		// `applyWorkspaceBrand` below can show exactly what the draft sets.
		logoPictureDark: null,
		layout: "framed",
		pageBackgroundColor: null,
		frameBackgroundColor: null,
		frameBorderColor: null,
		frameBorderWidth: 0,
		frameShadow: "sm",
		backgroundImage: null,
		backgroundImageCredit: null,
		backgroundImageFit: "cover",
		backgroundImagePositionX: 50,
		backgroundImagePositionY: 50,
		backgroundOverlayOpacity: 0,
		backgroundOverlayBlur: 0,
		headerImage: null,
		headerImageCredit: null,
		headerImageHeight: 160,
		focusedImageLayoutDefault: "none",
		maxSubmissionsReachedText: DEFAULT_MAX_SUBMISSIONS_TEXT,
		noBranding: true,
		pdfDownloadButtonText: null,
		pdfDownloadEnabled: false,
		presentationStyle: "classic",
		properties: SAMPLE_PROPERTIES,
		reFillable: false,
		reFillButtonText: null,
		seoMeta: {},
		settings: {},
		shareUrl: "",
		showBrandLogo: true,
		showProgressBar: false,
		size: "md",
		slug: "brand-preview",
		submitButtonText: "Submit",
		submittedText: DEFAULT_SUBMITTED_TEXT,
		theme: "default",
		title: "Request a demo",
		transparentBackground: false,
		translations: {},
		uppercaseLabels: false,
		useCaptcha: false,
		visibility: "public",
		width: "centered",
	};
	return applyWorkspaceBrand(
		base,
		{ brandOverrides: [], useWorkspaceBrand: true },
		brand
	);
}

/** A control row with a switch for whether the brand sets this key at all. */
function BrandRow({
	children,
	description,
	enabled,
	label,
	onToggle,
}: {
	children: React.ReactNode;
	description?: string;
	enabled: boolean;
	label: string;
	onToggle: (enabled: boolean) => void;
}) {
	return (
		<div className="space-y-2 border-border border-b py-4 first:pt-0 last:border-b-0 last:pb-0">
			<div className="flex items-center justify-between gap-3">
				<div>
					<Label>{label}</Label>
					{description ? (
						<p className="text-muted-foreground text-xs">{description}</p>
					) : null}
				</div>
				<Switch checked={enabled} onCheckedChange={onToggle} />
			</div>
			{enabled ? (
				children
			) : (
				<p className="text-muted-foreground text-xs italic">
					Not set — each form decides.
				</p>
			)}
		</div>
	);
}

type SetBrand = <K extends keyof WorkspaceBrand>(
	key: K,
	value: WorkspaceBrand[K]
) => void;
type UnsetBrand = (key: keyof WorkspaceBrand) => void;

/**
 * The Classic layout picker row (item 1), offering the same four picker
 * cards as the Design tab's "Classic layout" field, plus the plain-language
 * description for whichever preset is selected. Split out so `NewBrandRows`
 * stays under the cognitive-complexity budget.
 */
function ClassicLayoutRow({
	draft,
	set,
	unset,
}: {
	draft: WorkspaceBrand;
	set: SetBrand;
	unset: UnsetBrand;
}) {
	return (
		<BrandRow
			description="The overall Classic look every following form uses: a framed card, a card over a background image, a frameless banner (Google Forms style), or a framed card with a banner."
			enabled={draft.classicLayout !== undefined}
			label="Classic layout"
			onToggle={(enabled) =>
				enabled ? set("classicLayout", "card") : unset("classicLayout")
			}
		>
			<div className="space-y-3">
				<OptionCardGrid>
					{CLASSIC_LAYOUTS.map((option) => (
						<OptionCard
							illustration={<ClassicLayoutPreview variant={option} />}
							key={option}
							label={CLASSIC_LAYOUT_LABELS[option]}
							onSelect={() => set("classicLayout", option)}
							selected={draft.classicLayout === option}
						/>
					))}
				</OptionCardGrid>
				<p className="text-muted-foreground text-xs">
					{draft.classicLayout
						? CLASSIC_LAYOUT_DESCRIPTIONS[draft.classicLayout]
						: CLASSIC_LAYOUT_DESCRIPTIONS.card}
				</p>
			</div>
		</BrandRow>
	);
}

/**
 * The round-5 brand rows (logo dark, layout, page/frame colours, background
 * & header image, hide branding) — split out from `BrandSettingsTab` so that
 * component stays under the cognitive-complexity budget.
 */
function NewBrandRows({
	draft,
	set,
	unset,
	workspaceId,
}: {
	draft: WorkspaceBrand;
	set: SetBrand;
	unset: UnsetBrand;
	workspaceId: string;
}) {
	return (
		<>
			<BrandRow
				description="Shown when the resolved colour scheme is dark. Falls back to the light logo if empty, and vice versa."
				enabled={draft.logoPictureDark !== undefined}
				label="Logo (dark theme)"
				onToggle={(enabled) =>
					enabled ? set("logoPictureDark", null) : unset("logoPictureDark")
				}
			>
				<LogoUpload
					label="Dark-theme logo"
					onChange={(url) => set("logoPictureDark", url)}
					value={draft.logoPictureDark ?? null}
				/>
			</BrandRow>

			<ClassicLayoutRow draft={draft} set={set} unset={unset} />

			<BrandRow
				description="Shows the brand logo above the title for the Classic layout."
				enabled={draft.showBrandLogo !== undefined}
				label="Show brand logo"
				onToggle={(enabled) =>
					enabled ? set("showBrandLogo", true) : unset("showBrandLogo")
				}
			>
				<NativeSelect
					onChange={(e) => set("showBrandLogo", e.target.value === "on")}
					value={draft.showBrandLogo ? "on" : "off"}
				>
					<NativeSelectOption value="off">Off</NativeSelectOption>
					<NativeSelectOption value="on">On</NativeSelectOption>
				</NativeSelect>
			</BrandRow>

			<BrandRow
				description={
					'Fine-tuning for the Classic layout above: "Framed" wraps the form in a bordered card; "Frameless" removes the card entirely.'
				}
				enabled={draft.layout !== undefined}
				label="Layout (advanced)"
				onToggle={(enabled) =>
					enabled ? set("layout", "framed") : unset("layout")
				}
			>
				<OptionCardGrid>
					{LAYOUTS.map((option) => (
						<OptionCard
							illustration={<LayoutPreview variant={option} />}
							key={option}
							label={option}
							onSelect={() => set("layout", option)}
							selected={draft.layout === option}
						/>
					))}
				</OptionCardGrid>
			</BrandRow>

			<BrandRow
				description="The colour behind the form, outside the card."
				enabled={draft.pageBackgroundColor !== undefined}
				label="Page background colour"
				onToggle={(enabled) =>
					enabled
						? set("pageBackgroundColor", "#F4F4F5")
						: unset("pageBackgroundColor")
				}
			>
				<ColorPicker
					onChange={(color) => set("pageBackgroundColor", color)}
					presets={NEUTRAL_PRESETS}
					value={draft.pageBackgroundColor ?? "#F4F4F5"}
				/>
			</BrandRow>

			<BrandRow
				description={
					'Card background, border colour/width, and shadow (only visible when layout is "framed").'
				}
				enabled={draft.frameBackgroundColor !== undefined}
				label="Frame appearance"
				onToggle={(enabled) => {
					if (enabled) {
						set("frameBackgroundColor", "#FFFFFF");
						set("frameBorderColor", "#E4E4E7");
						set("frameBorderWidth", 1);
						set("frameShadow", "sm");
					} else {
						unset("frameBackgroundColor");
						unset("frameBorderColor");
						unset("frameBorderWidth");
						unset("frameShadow");
					}
				}}
			>
				<div className="space-y-3">
					<div className="space-y-1">
						<Label className="text-xs">Background</Label>
						<ColorPicker
							onChange={(color) => set("frameBackgroundColor", color)}
							presets={NEUTRAL_PRESETS}
							value={draft.frameBackgroundColor ?? "#FFFFFF"}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Border colour</Label>
						<ColorPicker
							onChange={(color) => set("frameBorderColor", color)}
							presets={NEUTRAL_PRESETS}
							value={draft.frameBorderColor ?? "#E4E4E7"}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">
							Border width — {draft.frameBorderWidth ?? 0}px
						</Label>
						<Slider
							max={12}
							min={0}
							onValueChange={(next) =>
								set("frameBorderWidth", Array.isArray(next) ? next[0] : next)
							}
							value={[draft.frameBorderWidth ?? 0]}
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">Shadow</Label>
						<NativeSelect
							onChange={(e) =>
								set(
									"frameShadow",
									e.target.value as (typeof FRAME_SHADOWS)[number]
								)
							}
							value={draft.frameShadow ?? "sm"}
						>
							{FRAME_SHADOWS.map((shadow) => (
								<NativeSelectOption key={shadow} value={shadow}>
									{shadow}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>
				</div>
			</BrandRow>

			<BackgroundImageRow
				draft={draft}
				set={set}
				unset={unset}
				workspaceId={workspaceId}
			/>
			<HeaderImageRow
				draft={draft}
				set={set}
				unset={unset}
				workspaceId={workspaceId}
			/>
			<NoBrandingRow draft={draft} set={set} unset={unset} />
		</>
	);
}

/** The "Background image" brand row — split out of `NewBrandRows` to keep its complexity down. */
function BackgroundImageRow({
	draft,
	set,
	unset,
	workspaceId,
}: {
	draft: WorkspaceBrand;
	set: SetBrand;
	unset: UnsetBrand;
	workspaceId: string;
}) {
	return (
		<BrandRow
			description="A full-bleed image behind the form, with an optional dim/blur overlay for legibility."
			enabled={draft.backgroundImage !== undefined}
			label="Background image"
			onToggle={(enabled) => {
				if (enabled) {
					set("backgroundImage", null);
					set("backgroundImageFit", "cover");
					set("backgroundImagePositionX", 50);
					set("backgroundImagePositionY", 50);
					set("backgroundOverlayOpacity", 0);
					set("backgroundOverlayBlur", 0);
				} else {
					unset("backgroundImage");
					unset("backgroundImageFit");
					unset("backgroundImagePositionX");
					unset("backgroundImagePositionY");
					unset("backgroundOverlayOpacity");
					unset("backgroundOverlayBlur");
				}
			}}
		>
			<div className="space-y-3">
				<ImagePicker
					onChange={(picked) => {
						set("backgroundImage", picked?.url ?? null);
						set("backgroundImageCredit", picked?.credit ?? null);
					}}
					value={
						draft.backgroundImage
							? {
									credit: draft.backgroundImageCredit ?? undefined,
									url: draft.backgroundImage,
								}
							: null
					}
					workspaceId={workspaceId}
				/>
				{draft.backgroundImage ? (
					<>
						<div className="space-y-1">
							<Label className="text-xs">Fit</Label>
							<NativeSelect
								onChange={(e) =>
									set(
										"backgroundImageFit",
										e.target.value as (typeof BACKGROUND_IMAGE_FITS)[number]
									)
								}
								value={draft.backgroundImageFit ?? "cover"}
							>
								{BACKGROUND_IMAGE_FITS.map((fit) => (
									<NativeSelectOption key={fit} value={fit}>
										{fit}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</div>
						<div className="space-y-1">
							<Label className="text-xs">
								Overlay dim — {draft.backgroundOverlayOpacity ?? 0}%
							</Label>
							<Slider
								max={100}
								min={0}
								onValueChange={(next) =>
									set(
										"backgroundOverlayOpacity",
										Array.isArray(next) ? next[0] : next
									)
								}
								value={[draft.backgroundOverlayOpacity ?? 0]}
							/>
						</div>
						<div className="space-y-1">
							<Label className="text-xs">
								Overlay blur — {draft.backgroundOverlayBlur ?? 0}px
							</Label>
							<Slider
								max={40}
								min={0}
								onValueChange={(next) =>
									set(
										"backgroundOverlayBlur",
										Array.isArray(next) ? next[0] : next
									)
								}
								value={[draft.backgroundOverlayBlur ?? 0]}
							/>
						</div>
					</>
				) : null}
			</div>
		</BrandRow>
	);
}

/** The "Header image" brand row — split out of `NewBrandRows` to keep its complexity down. */
function HeaderImageRow({
	draft,
	set,
	unset,
	workspaceId,
}: {
	draft: WorkspaceBrand;
	set: SetBrand;
	unset: UnsetBrand;
	workspaceId: string;
}) {
	return (
		<BrandRow
			description="A banner shown above the form."
			enabled={draft.headerImage !== undefined}
			label="Header image"
			onToggle={(enabled) => {
				if (enabled) {
					set("headerImage", null);
					set("headerImageHeight", 160);
				} else {
					unset("headerImage");
					unset("headerImageHeight");
				}
			}}
		>
			<div className="space-y-3">
				<ImagePicker
					onChange={(picked) => {
						set("headerImage", picked?.url ?? null);
						set("headerImageCredit", picked?.credit ?? null);
					}}
					value={
						draft.headerImage
							? {
									credit: draft.headerImageCredit ?? undefined,
									url: draft.headerImage,
								}
							: null
					}
					workspaceId={workspaceId}
				/>
				{draft.headerImage ? (
					<div className="space-y-1">
						<Label className="text-xs">
							Height — {draft.headerImageHeight ?? 160}px
						</Label>
						<Slider
							max={480}
							min={60}
							onValueChange={(next) =>
								set("headerImageHeight", Array.isArray(next) ? next[0] : next)
							}
							value={[draft.headerImageHeight ?? 160]}
						/>
					</div>
				) : null}
			</div>
		</BrandRow>
	);
}

/** The "Hide StryveForms branding" row — split out of `NewBrandRows` to keep its complexity down. */
function NoBrandingRow({
	draft,
	set,
	unset,
}: {
	draft: WorkspaceBrand;
	set: SetBrand;
	unset: UnsetBrand;
}) {
	return (
		<BrandRow
			description="Removed from the 'Hide StryveForms branding' setting on the Design tab — set it here once for every form, or let a form override it."
			enabled={draft.noBranding !== undefined}
			label="Hide StryveForms branding"
			onToggle={(enabled) =>
				enabled ? set("noBranding", false) : unset("noBranding")
			}
		>
			<NativeSelect
				onChange={(e) => set("noBranding", e.target.value === "on")}
				value={draft.noBranding ? "on" : "off"}
			>
				<NativeSelectOption value="off">Off</NativeSelectOption>
				<NativeSelectOption value="on">On</NativeSelectOption>
			</NativeSelect>
		</BrandRow>
	);
}

export default function BrandSettingsTab({
	workspace,
}: {
	workspace: WorkspaceSummary;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const detail = useQuery(
		trpc.workspace.get.queryOptions({ id: workspace.id })
	);
	const coverage = useQuery(
		trpc.workspace.brandCoverage.queryOptions({ id: workspace.id })
	);
	const [draft, setDraft] = useState<WorkspaceBrand>({});
	const [savedDraft, setSavedDraft] = useState<WorkspaceBrand>({});

	useEffect(() => {
		const brand = (detail.data?.brand as WorkspaceBrand | undefined) ?? {};
		setDraft(brand);
		setSavedDraft(brand);
	}, [detail.data]);

	const isAdmin = workspace.role === "admin";
	const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
	const preview = useMemo(() => sampleForm(draft), [draft]);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.workspace.get.queryKey() });

	const update = useMutation(
		trpc.workspace.updateBrand.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await invalidate();
				setSavedDraft(draft);
				toast.success("Brand guideline saved");
			},
		})
	);

	const applyToAll = useMutation(
		trpc.workspace.applyBrandToAllForms.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.workspace.brandCoverage.queryKey(),
				});
				toast.success(
					`${result.formsUpdated} form${result.formsUpdated === 1 ? "" : "s"} now follow${result.formsUpdated === 1 ? "s" : ""} the brand`
				);
			},
		})
	);

	function set<K extends keyof WorkspaceBrand>(
		key: K,
		value: WorkspaceBrand[K]
	) {
		setDraft((current) => ({ ...current, [key]: value }));
	}

	function unset(key: keyof WorkspaceBrand) {
		setDraft((current) => {
			const next = { ...current };
			delete next[key];
			return next;
		});
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="text-muted-foreground text-sm">
					Set the look every new form uses by default. Any form can still
					override individual settings.
				</p>
				{coverage.data ? (
					<p className="text-muted-foreground text-xs">
						{coverage.data.following} of {coverage.data.total} forms follow this
						brand · {coverage.data.overriding} override some settings
					</p>
				) : null}
			</div>

			<div className="grid gap-8 lg:grid-cols-2">
				<div className="divide-y-0">
					<BrandRow
						enabled={draft.color !== undefined}
						label="Brand color"
						onToggle={(enabled) =>
							enabled ? set("color", DEFAULT_COLOR) : unset("color")
						}
					>
						<ColorPicker
							onChange={(color) => set("color", color)}
							value={draft.color ?? DEFAULT_COLOR}
						/>
					</BrandRow>

					<BrandRow
						enabled={draft.fontFamily !== undefined}
						label="Font"
						onToggle={(enabled) =>
							enabled ? set("fontFamily", null) : unset("fontFamily")
						}
					>
						<NativeSelect
							onChange={(e) =>
								set(
									"fontFamily",
									e.target.value === DEFAULT_FONT ? null : e.target.value
								)
							}
							value={draft.fontFamily ?? DEFAULT_FONT}
						>
							<NativeSelectOption value={DEFAULT_FONT}>
								Default
							</NativeSelectOption>
							{FONTS.map((font) => (
								<NativeSelectOption key={font} value={font}>
									{font}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</BrandRow>

					<BrandRow
						enabled={draft.theme !== undefined}
						label="Theme"
						onToggle={(enabled) =>
							enabled ? set("theme", "default") : unset("theme")
						}
					>
						<NativeSelect
							onChange={(e) =>
								set("theme", e.target.value as (typeof THEMES)[number])
							}
							value={draft.theme ?? "default"}
						>
							{THEMES.map((theme) => (
								<NativeSelectOption key={theme} value={theme}>
									{OPTION_LABELS[theme] ?? theme}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</BrandRow>

					<BrandRow
						enabled={draft.borderRadius !== undefined}
						label="Corner radius"
						onToggle={(enabled) =>
							enabled ? set("borderRadius", "small") : unset("borderRadius")
						}
					>
						<NativeSelect
							onChange={(e) =>
								set(
									"borderRadius",
									e.target.value as (typeof BORDER_RADII)[number]
								)
							}
							value={draft.borderRadius ?? "small"}
						>
							{BORDER_RADII.map((radius) => (
								<NativeSelectOption key={radius} value={radius}>
									{RADIUS_LABELS[radius] ?? radius}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</BrandRow>

					<BrandRow
						enabled={draft.size !== undefined}
						label="Field size"
						onToggle={(enabled) =>
							enabled ? set("size", "md") : unset("size")
						}
					>
						<NativeSelect
							onChange={(e) =>
								set("size", e.target.value as (typeof SIZES)[number])
							}
							value={draft.size ?? "md"}
						>
							{SIZES.map((size) => (
								<NativeSelectOption key={size} value={size}>
									{OPTION_LABELS[size] ?? size}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</BrandRow>

					<BrandRow
						enabled={draft.width !== undefined}
						label="Width"
						onToggle={(enabled) =>
							enabled ? set("width", "centered") : unset("width")
						}
					>
						<NativeSelect
							onChange={(e) =>
								set("width", e.target.value as (typeof WIDTHS)[number])
							}
							value={draft.width ?? "centered"}
						>
							{WIDTHS.map((width) => (
								<NativeSelectOption key={width} value={width}>
									{OPTION_LABELS[width] ?? width}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</BrandRow>

					<BrandRow
						enabled={draft.darkMode !== undefined}
						label="Dark mode"
						onToggle={(enabled) =>
							enabled ? set("darkMode", "auto") : unset("darkMode")
						}
					>
						<NativeSelect
							onChange={(e) =>
								set("darkMode", e.target.value as (typeof DARK_MODES)[number])
							}
							value={draft.darkMode ?? "auto"}
						>
							{DARK_MODES.map((mode) => (
								<NativeSelectOption key={mode} value={mode}>
									{OPTION_LABELS[mode] ?? mode}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</BrandRow>

					<BrandRow
						enabled={draft.uppercaseLabels !== undefined}
						label="Uppercase labels"
						onToggle={(enabled) =>
							enabled ? set("uppercaseLabels", false) : unset("uppercaseLabels")
						}
					>
						<NativeSelect
							onChange={(e) => set("uppercaseLabels", e.target.value === "on")}
							value={draft.uppercaseLabels ? "on" : "off"}
						>
							<NativeSelectOption value="off">Off</NativeSelectOption>
							<NativeSelectOption value="on">On</NativeSelectOption>
						</NativeSelect>
					</BrandRow>

					<BrandRow
						enabled={draft.logoPicture !== undefined}
						label="Logo (light theme)"
						onToggle={(enabled) =>
							enabled ? set("logoPicture", null) : unset("logoPicture")
						}
					>
						<LogoUpload
							label="Brand logo"
							onChange={(url) => set("logoPicture", url)}
							value={draft.logoPicture ?? null}
						/>
					</BrandRow>

					<NewBrandRows
						draft={draft}
						set={set}
						unset={unset}
						workspaceId={workspace.id}
					/>
				</div>

				<div className="space-y-3">
					<Label>Live preview</Label>
					<div className="rounded-lg border border-border bg-muted/30 p-4">
						<FormRenderer form={preview} mode="preview" />
					</div>
				</div>
			</div>

			<div className="sticky bottom-0 flex items-center justify-between gap-3 border-border border-t bg-background py-4">
				<div className="flex items-center gap-2">
					<Button
						disabled={!(isAdmin && dirty) || update.isPending}
						onClick={() => update.mutate({ brand: draft, id: workspace.id })}
					>
						{update.isPending ? "Saving…" : "Save brand"}
					</Button>
					<Button
						disabled={!dirty}
						onClick={() => setDraft(savedDraft)}
						type="button"
						variant="ghost"
					>
						Discard
					</Button>
				</div>

				{isAdmin ? (
					<AlertDialog>
						<AlertDialogTrigger
							render={
								<Button
									disabled={applyToAll.isPending}
									type="button"
									variant="outline"
								/>
							}
						>
							Apply to all forms
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Apply brand to every form?</AlertDialogTitle>
								<AlertDialogDescription>
									Every form in this workspace will start following the brand
									guideline, and any per-form overrides will be cleared. This
									can't be undone automatically.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									onClick={() => applyToAll.mutate({ id: workspace.id })}
								>
									Apply to all forms
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				) : null}
			</div>
		</div>
	);
}
