import {
	type BrandKey,
	CLASSIC_LAYOUT_DESCRIPTIONS,
	CLASSIC_LAYOUT_LABELS,
	type FormBrandLink,
	isBrandInherited,
	NESTED_BRAND_KEYS,
	resolveClassicLayout,
	resolveTopImage,
	type WorkspaceBrand,
} from "@StryveForms/forms/brand";
import type {
	ClassicLayout,
	FormSettings,
	ImageCredit,
} from "@StryveForms/forms/settings";
import {
	BACKGROUND_IMAGE_FITS,
	BORDER_RADII,
	CLASSIC_LAYOUTS,
	DARK_MODES,
	FRAME_SHADOWS,
	LANGUAGES,
	SIZES,
	THEMES,
	WIDTHS,
} from "@StryveForms/forms/settings";
import type { FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import { Slider } from "@StryveForms/ui/components/slider";
import { Switch } from "@StryveForms/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RotateCcwIcon } from "lucide-react";
import ImagePicker from "@/components/app/media/image-picker";
import { useTRPC } from "@/utils/trpc";
import { FOCUSED_IMAGE_LAYOUTS } from "../../form-renderer/image-layout";
import { UploadButton } from "../shared/upload-button";
import { useEditor } from "../state/editor-context";
import {
	ClassicLayoutPreview,
	DarkModePreview,
	RadiusPreview,
	SizePreview,
	ThemePreview,
	WidthPreview,
} from "./illustrations";
import { OptionCard, OptionCardGrid } from "./option-card";
import { PresentationStyleSwitch } from "./presentation-style-switch";

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

const FOCUSED_IMAGE_LAYOUT_LABELS: Record<string, string> = {
	none: "No image",
	"split-left": "Split left",
	"split-right": "Split right",
	stack: "Stack",
	wallpaper: "Wallpaper",
};

type BooleanSettingKey = {
	[K in keyof FormSettings]: FormSettings[K] extends boolean ? K : never;
}[keyof FormSettings];

/** The active workspace's brand guideline, or null while loading / unset. */
function useWorkspaceBrandValue(): WorkspaceBrand | null {
	const { meta } = useEditor();
	const trpc = useTRPC();
	const query = useQuery(
		trpc.workspace.get.queryOptions({ id: meta.workspaceId })
	);
	return (query.data?.brand as WorkspaceBrand | undefined) ?? null;
}

/**
 * The value a brand-controlled control should display: the workspace brand's
 * value when the form follows it and hasn't overridden this key, otherwise
 * the form's own stored value.
 */
function useBrandValue<K extends BrandKey & keyof FormSettings>(
	key: K
): FormSettings[K] {
	const { state } = useEditor();
	const brand = useWorkspaceBrandValue();
	const { settings } = state;
	const link: FormBrandLink = {
		brandOverrides: settings.brandOverrides,
		useWorkspaceBrand: settings.useWorkspaceBrand,
	};
	if (brand && isBrandInherited(key, link, brand)) {
		return brand[key] as FormSettings[K];
	}
	return settings[key];
}

/** Patches a brand-controlled setting, marking it as overridden when the form follows the brand. */
function useBrandPatch() {
	const { patch, state } = useEditor();
	return (key: BrandKey, value: unknown) => {
		const { settings } = state;
		const brandOverrides =
			settings.useWorkspaceBrand && !settings.brandOverrides.includes(key)
				? [...settings.brandOverrides, key]
				: settings.brandOverrides;
		patch({ [key]: value, brandOverrides } as Partial<FormSettings>);
	};
}

/**
 * Same as `useBrandValue`/`useBrandPatch`, but for the brand extras (layout,
 * frame colours, background/header image…) that live nested inside
 * `settings.settings` instead of their own top-level field. See
 * `@StryveForms/forms/brand`'s `NESTED_BRAND_KEYS`.
 */
function useNestedBrandValue(key: BrandKey): unknown {
	const { state } = useEditor();
	const brand = useWorkspaceBrandValue();
	const { settings } = state;
	const link: FormBrandLink = {
		brandOverrides: settings.brandOverrides,
		useWorkspaceBrand: settings.useWorkspaceBrand,
	};
	if (brand && isBrandInherited(key, link, brand)) {
		return brand[key];
	}
	return (settings.settings as Record<string, unknown>)[key];
}

function useNestedBrandPatch() {
	const patchMany = useNestedBrandPatchMany();
	return (key: BrandKey, value: unknown) => patchMany({ [key]: value });
}

/**
 * Same as `useNestedBrandPatch`, but for setting several nested brand-extra
 * keys at once (e.g. an image URL alongside its Unsplash credit) in a single
 * dispatch. Calling the single-key `patch(key, value)` twice in a row from
 * the same event handler is NOT equivalent: both calls close over the same
 * pre-interaction `state`, so the second call's merge silently drops the
 * first call's change — this computes one merged `settings` object instead.
 */
function useNestedBrandPatchMany() {
	const { patch, state } = useEditor();
	return (values: Partial<Record<BrandKey, unknown>>) => {
		const { settings } = state;
		const keys = Object.keys(values) as BrandKey[];
		const brandOverrides = settings.useWorkspaceBrand
			? Array.from(new Set([...settings.brandOverrides, ...keys]))
			: settings.brandOverrides;
		patch({
			brandOverrides,
			settings: { ...settings.settings, ...values },
		} as Partial<FormSettings>);
	};
}

/** "Brand" badge, or "Overridden" badge + reset button, next to a brand-controlled control. */
function BrandTag({ brandKey }: { brandKey: BrandKey }) {
	const { patch, state } = useEditor();
	const brand = useWorkspaceBrandValue();
	const { settings } = state;
	if (!(settings.useWorkspaceBrand && brand && brand[brandKey] !== undefined)) {
		return null;
	}
	if (!settings.brandOverrides.includes(brandKey)) {
		return (
			<Badge className="h-4.5 px-1.5 text-[10px]" variant="secondary">
				Brand
			</Badge>
		);
	}
	return (
		<span className="inline-flex items-center gap-1">
			<Badge className="h-4.5 px-1.5 text-[10px]" variant="outline">
				Overridden
			</Badge>
			<button
				aria-label="Reset to the workspace brand value"
				className="text-muted-foreground hover:text-foreground"
				onClick={() => {
					const brandOverrides = settings.brandOverrides.filter(
						(key) => key !== brandKey
					);
					// Brand extras live in `settings.settings`, the rest at the top level.
					const value = (NESTED_BRAND_KEYS as readonly string[]).includes(
						brandKey
					)
						? {
								settings: {
									...settings.settings,
									[brandKey]: brand[brandKey],
								},
							}
						: { [brandKey]: brand[brandKey] };
					patch({ ...value, brandOverrides } as Partial<FormSettings>);
				}}
				type="button"
			>
				<RotateCcwIcon className="size-3" />
			</button>
		</span>
	);
}

/** Field label with an inline brand badge, for brand-controlled settings. */
function BrandFieldLabel({
	brandKey,
	htmlFor,
	label,
}: {
	brandKey: BrandKey;
	htmlFor: string;
	label: string;
}) {
	return (
		<div className="flex items-center gap-1.5">
			<FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
			<BrandTag brandKey={brandKey} />
		</div>
	);
}

function ToggleField({
	brandKey,
	description,
	id,
	label,
}: {
	brandKey?: BrandKey;
	description?: string;
	id: BooleanSettingKey;
	label: string;
}) {
	const { patch, state } = useEditor();
	const brandPatch = useBrandPatch();
	const brand = useWorkspaceBrandValue();
	const { settings } = state;
	const link: FormBrandLink = {
		brandOverrides: settings.brandOverrides,
		useWorkspaceBrand: settings.useWorkspaceBrand,
	};
	const isChecked =
		brandKey && brand && isBrandInherited(brandKey, link, brand)
			? Boolean(brand[brandKey])
			: Boolean(settings[id]);
	return (
		<Field orientation="horizontal">
			<Checkbox
				checked={isChecked}
				id={id}
				onCheckedChange={(checked) => {
					const value = checked === true;
					if (brandKey) {
						brandPatch(brandKey, value);
					} else {
						patch({ [id]: value } as Partial<FormSettings>);
					}
				}}
			/>
			<div className="flex flex-col">
				{brandKey ? (
					<BrandFieldLabel brandKey={brandKey} htmlFor={id} label={label} />
				) : (
					<FieldLabel htmlFor={id}>{label}</FieldLabel>
				)}
				{description ? (
					<FieldDescription>{description}</FieldDescription>
				) : null}
			</div>
		</Field>
	);
}

/** A boolean flag nested in `FormSettings.settings` (focused-mode extras). */
function NestedSettingToggle({
	id,
	label,
}: {
	id: "auto_next" | "navigation_arrows";
	label: string;
}) {
	const { patch, state } = useEditor();
	const nested = state.settings.settings;
	return (
		<Field orientation="horizontal">
			<Checkbox
				checked={Boolean(nested[id])}
				id={id}
				onCheckedChange={(checked) =>
					patch({ settings: { ...nested, [id]: checked === true } })
				}
			/>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
		</Field>
	);
}

/** A nullable colour picker for a nested brand-extra key (page/frame colours). */
function NestedColorField({
	brandKey,
	description,
	fallback,
	label,
}: {
	brandKey: BrandKey;
	description?: string;
	fallback: string;
	label: string;
}) {
	const value = useNestedBrandValue(brandKey) as string | null | undefined;
	const patch = useNestedBrandPatch();
	return (
		<Field>
			<BrandFieldLabel brandKey={brandKey} htmlFor={brandKey} label={label} />
			<div className="flex items-center gap-2">
				<input
					className="size-8 cursor-pointer rounded-lg border border-input"
					id={brandKey}
					onChange={(e) => patch(brandKey, e.target.value)}
					type="color"
					value={value || fallback}
				/>
				<Input
					onChange={(e) => patch(brandKey, e.target.value || null)}
					placeholder="Not set, uses the theme default"
					value={value ?? ""}
				/>
				{value ? (
					<Button
						onClick={() => patch(brandKey, null)}
						size="sm"
						type="button"
						variant="ghost"
					>
						Clear
					</Button>
				) : null}
			</div>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
		</Field>
	);
}

/** A 0-N numeric slider for a nested brand-extra key. */
function NestedSliderField({
	brandKey,
	defaultValue,
	description,
	label,
	max,
	min,
	unit,
}: {
	brandKey: BrandKey;
	defaultValue: number;
	description?: string;
	label: string;
	max: number;
	min: number;
	unit?: string;
}) {
	const raw = useNestedBrandValue(brandKey);
	const value = typeof raw === "number" ? raw : defaultValue;
	const patch = useNestedBrandPatch();
	return (
		<Field>
			<div className="flex items-center justify-between gap-2">
				<BrandFieldLabel brandKey={brandKey} htmlFor={brandKey} label={label} />
				<span className="text-muted-foreground text-xs">
					{value}
					{unit ?? ""}
				</span>
			</div>
			<Slider
				id={brandKey}
				max={max}
				min={min}
				onValueChange={(next) => {
					const v = Array.isArray(next) ? next[0] : next;
					patch(brandKey, v);
				}}
				value={[value]}
			/>
			{description ? <FieldDescription>{description}</FieldDescription> : null}
		</Field>
	);
}

/** Upload/remove control for a nested brand-extra image key (background/header image). */
function NestedImageField({
	brandKey,
	children,
	label,
}: {
	brandKey: BrandKey;
	children?: React.ReactNode;
	label: string;
}) {
	const value = useNestedBrandValue(brandKey) as string | null | undefined;
	const patch = useNestedBrandPatch();
	return (
		<FieldSet className="gap-2">
			<BrandFieldLabel brandKey={brandKey} htmlFor={brandKey} label={label} />
			<div className="flex items-center gap-2">
				<UploadButton
					accept="image/*"
					label={value ? "Replace image" : "Upload image"}
					onUploaded={(url) => patch(brandKey, url)}
				/>
				{value ? (
					<Button
						onClick={() => patch(brandKey, null)}
						size="sm"
						type="button"
						variant="ghost"
					>
						Remove
					</Button>
				) : null}
			</div>
			{value ? children : null}
		</FieldSet>
	);
}

/**
 * Resolves the effective Classic layout preset for the current form, same
 * migration-on-read rules as `toPublicFormDto`: a form saved before
 * `classicLayout` existed gets the preset matching its old
 * layout/background/header-image combination.
 */
function useResolvedClassicLayout(): ClassicLayout {
	const { state } = useEditor();
	return resolveClassicLayout({
		backgroundImage: useNestedBrandValue("backgroundImage") as
			| string
			| null
			| undefined,
		classicLayout: useNestedBrandValue("classicLayout") as
			| ClassicLayout
			| undefined,
		coverPicture: state.settings.coverPicture,
		headerImage: useNestedBrandValue("headerImage") as
			| string
			| null
			| undefined,
		layout: useNestedBrandValue("layout") as "framed" | "frameless" | undefined,
	});
}

/**
 * The "top image" (banner) upload control, unifying the legacy
 * `coverPicture` field with `headerImage` (migrate on read): the field shows
 * whichever is set, but every new upload/remove writes to `headerImage`
 * only, so the two eventually converge on the one concept.
 */
function TopImageField({ children }: { children?: React.ReactNode }) {
	const { meta, state } = useEditor();
	const headerImage = useNestedBrandValue("headerImage") as
		| string
		| null
		| undefined;
	const headerImageCredit = useNestedBrandValue("headerImageCredit") as
		| ImageCredit
		| null
		| undefined;
	const value = resolveTopImage({
		coverPicture: state.settings.coverPicture,
		headerImage: headerImage ?? null,
	});
	const patchMany = useNestedBrandPatchMany();
	return (
		<FieldSet className="gap-2">
			<BrandFieldLabel
				brandKey="headerImage"
				htmlFor="headerImage"
				label="Header image"
			/>
			<ImagePicker
				onChange={(picked) => {
					patchMany({
						headerImage: picked?.url ?? null,
						headerImageCredit: picked?.credit ?? null,
					});
				}}
				value={
					value ? { credit: headerImageCredit ?? undefined, url: value } : null
				}
				workspaceId={meta.workspaceId}
			/>
			{value ? children : null}
		</FieldSet>
	);
}

/**
 * The frame/background/header image controls relevant to the currently
 * selected Classic layout preset only — e.g. "Card on background image"
 * shows the background-image controls, "Header image" shows the banner
 * controls, and neither shows the other's.
 */
function ClassicLayoutImageFields({
	classicLayout,
	includeFrame = true,
}: {
	classicLayout: ClassicLayout;
	/** False while the form follows the brand: the frame look comes from the brand. */
	includeFrame?: boolean;
}) {
	const frameShadow =
		(useNestedBrandValue("frameShadow") as string | undefined) ?? "sm";
	const backgroundImageFit =
		(useNestedBrandValue("backgroundImageFit") as string | undefined) ??
		"cover";
	const isFramed = classicLayout !== "header-image";
	return (
		<>
			{isFramed && includeFrame ? (
				<FrameAppearanceFields frameShadow={frameShadow} />
			) : null}
			{classicLayout === "card-on-background" ? (
				<BackgroundImageFields backgroundImageFit={backgroundImageFit} />
			) : null}
			{classicLayout === "header-image" ||
			classicLayout === "card-with-header" ? (
				<TopImageField>
					<NestedSliderField
						brandKey="headerImageHeight"
						defaultValue={160}
						description="A banner shown above the form."
						label="Height"
						max={480}
						min={60}
						unit="px"
					/>
				</TopImageField>
			) : null}
		</>
	);
}

/** The four Classic layout presets, shown as visual picker cards, like Google Forms' own style picker. */
function ClassicLayoutField({ layout }: { layout: ClassicLayout }) {
	const patch = useNestedBrandPatch();
	const showBrandLogo = Boolean(useNestedBrandValue("showBrandLogo") ?? true);
	return (
		<Field>
			<BrandFieldLabel
				brandKey="classicLayout"
				htmlFor="classic-layout"
				label="Classic layout"
			/>
			<OptionCardGrid>
				{CLASSIC_LAYOUTS.map((option) => (
					<OptionCard
						illustration={<ClassicLayoutPreview variant={option} />}
						key={option}
						label={CLASSIC_LAYOUT_LABELS[option]}
						onSelect={() => patch("classicLayout", option)}
						selected={layout === option}
					/>
				))}
			</OptionCardGrid>
			<FieldDescription>{CLASSIC_LAYOUT_DESCRIPTIONS[layout]}</FieldDescription>
			<Field className="mt-1" orientation="horizontal">
				<Checkbox
					checked={showBrandLogo}
					id="show-brand-logo"
					onCheckedChange={(checked) =>
						patch("showBrandLogo", checked === true)
					}
				/>
				<div className="flex flex-col">
					<FieldLabel htmlFor="show-brand-logo">Show brand logo</FieldLabel>
					<FieldDescription>
						Shows your uploaded logo above the title for this layout.
					</FieldDescription>
				</div>
			</Field>
		</Field>
	);
}

/** Card background/border/shadow, only meaningful when `layout` is "framed". */
function FrameAppearanceFields({ frameShadow }: { frameShadow: string }) {
	const patch = useNestedBrandPatch();
	return (
		<FieldSet className="gap-3 rounded-md border border-border p-3">
			<FieldLabel>Frame appearance</FieldLabel>
			<NestedColorField
				brandKey="frameBackgroundColor"
				fallback="#ffffff"
				label="Frame background colour"
			/>
			<NestedColorField
				brandKey="frameBorderColor"
				fallback="#e5e5e5"
				label="Frame border colour"
			/>
			<NestedSliderField
				brandKey="frameBorderWidth"
				defaultValue={0}
				label="Frame border width"
				max={12}
				min={0}
				unit="px"
			/>
			<Field>
				<BrandFieldLabel
					brandKey="frameShadow"
					htmlFor="frame-shadow"
					label="Frame shadow"
				/>
				<NativeSelect
					id="frame-shadow"
					onChange={(e) => patch("frameShadow", e.target.value)}
					value={frameShadow}
				>
					{FRAME_SHADOWS.map((shadow) => (
						<NativeSelectOption key={shadow} value={shadow}>
							{shadow}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
		</FieldSet>
	);
}

/** Full-bleed page background image, with fit/position/overlay controls. */
function BackgroundImageFields({
	backgroundImageFit,
}: {
	backgroundImageFit: string;
}) {
	const { meta } = useEditor();
	const patch = useNestedBrandPatch();
	const patchMany = useNestedBrandPatchMany();
	const backgroundImage = useNestedBrandValue("backgroundImage") as
		| string
		| null
		| undefined;
	const backgroundImageCredit = useNestedBrandValue("backgroundImageCredit") as
		| ImageCredit
		| null
		| undefined;
	return (
		<FieldSet className="gap-2">
			<BrandFieldLabel
				brandKey="backgroundImage"
				htmlFor="backgroundImage"
				label="Background image"
			/>
			<ImagePicker
				onChange={(picked) => {
					patchMany({
						backgroundImage: picked?.url ?? null,
						backgroundImageCredit: picked?.credit ?? null,
					});
				}}
				value={
					backgroundImage
						? {
								credit: backgroundImageCredit ?? undefined,
								url: backgroundImage,
							}
						: null
				}
				workspaceId={meta.workspaceId}
			/>
			{backgroundImage ? (
				<>
					<Field>
						<FieldLabel htmlFor="bg-fit">Fit</FieldLabel>
						<NativeSelect
							id="bg-fit"
							onChange={(e) => patch("backgroundImageFit", e.target.value)}
							value={backgroundImageFit}
						>
							{BACKGROUND_IMAGE_FITS.map((fit) => (
								<NativeSelectOption key={fit} value={fit}>
									{fit}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<NestedSliderField
						brandKey="backgroundImagePositionX"
						defaultValue={50}
						label="Horizontal position"
						max={100}
						min={0}
						unit="%"
					/>
					<NestedSliderField
						brandKey="backgroundImagePositionY"
						defaultValue={50}
						label="Vertical position"
						max={100}
						min={0}
						unit="%"
					/>
					<NestedSliderField
						brandKey="backgroundOverlayOpacity"
						defaultValue={0}
						description="A dark overlay over the image, for text legibility."
						label="Overlay dim"
						max={100}
						min={0}
						unit="%"
					/>
					<NestedSliderField
						brandKey="backgroundOverlayBlur"
						defaultValue={0}
						label="Overlay blur"
						max={40}
						min={0}
						unit="px"
					/>
				</>
			) : null}
		</FieldSet>
	);
}

/**
 * Page/frame layout controls. The Classic layout (and its header or
 * background image) only applies to Classic forms; Focused forms get just
 * the card's frame look. While the form follows the brand, the layout stays
 * editable here when the brand leaves it to each form, and the brand's
 * colours and frame look stay hidden.
 */
function LayoutFields({
	classicLayout,
	customizing,
}: {
	classicLayout: ClassicLayout;
	customizing: boolean;
}) {
	const { state } = useEditor();
	const brand = useWorkspaceBrandValue();
	const { settings } = state;
	const isFocused = settings.presentationStyle === "focused";
	const brandControlsLayout =
		settings.useWorkspaceBrand &&
		brand?.classicLayout !== undefined &&
		!settings.brandOverrides.includes("classicLayout");
	const showLayoutPicker = !(isFocused || brandControlsLayout);
	const frameShadow =
		(useNestedBrandValue("frameShadow") as string | undefined) ?? "sm";

	if (!customizing) {
		return showLayoutPicker ? (
			<>
				<ClassicLayoutField layout={classicLayout} />
				<ClassicLayoutImageFields
					classicLayout={classicLayout}
					includeFrame={false}
				/>
			</>
		) : null;
	}
	return (
		<>
			{showLayoutPicker ? <ClassicLayoutField layout={classicLayout} /> : null}
			<NestedColorField
				brandKey="pageBackgroundColor"
				description="The colour behind the form, outside the card."
				fallback="#f4f4f5"
				label="Page background colour"
			/>
			{isFocused ? (
				<FrameAppearanceFields frameShadow={frameShadow} />
			) : (
				<ClassicLayoutImageFields classicLayout={classicLayout} />
			)}
		</>
	);
}

/**
 * The workspace brand's own Classic layout choice, in plain words — shown
 * read-only while a form follows the brand, since the layout picker itself
 * is hidden in that state (see `customizing` in `DesignTab`).
 */
function brandLayoutSummary(brand: WorkspaceBrand): string | null {
	if (brand.classicLayout === undefined) {
		// The brand leaves the layout to each form: the picker stays visible.
		return null;
	}
	const layout = resolveClassicLayout({
		backgroundImage: brand.backgroundImage ?? null,
		classicLayout: brand.classicLayout,
		coverPicture: null,
		headerImage: brand.headerImage ?? null,
		layout: brand.layout ?? null,
	});
	return `Using the brand's "${CLASSIC_LAYOUT_LABELS[layout]}" layout.`;
}

/**
 * "Follow workspace brand" switch, with a green/red status dot (green =
 * following, red = customized for this form — item 3) and the "Edit
 * workspace brand" link. The brand colour, if any, is a separate small
 * swatch so it's never mistaken for the status dot itself.
 */
function brandDescription(hasBrand: boolean, following: boolean): string {
	if (!hasBrand) {
		return "Your workspace hasn't set a brand guideline yet.";
	}
	return following
		? "This form uses your workspace's brand for the settings below."
		: "This form uses its own design. Turn this on to use your workspace's brand.";
}

function WorkspaceBrandCard() {
	const { patch, state } = useEditor();
	const brand = useWorkspaceBrandValue();
	const hasBrand = brand
		? Object.values(brand).some((value) => value !== undefined)
		: false;
	const following = state.settings.useWorkspaceBrand;
	const layoutSummary =
		following &&
		brand &&
		state.settings.presentationStyle === "classic" &&
		!state.settings.brandOverrides.includes("classicLayout")
			? brandLayoutSummary(brand)
			: null;

	return (
		<div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
			<div className="flex min-w-0 flex-col gap-1.5">
				<div className="flex flex-col gap-0.5">
					<span className="font-medium text-sm" id="workspace-brand-title">
						Workspace brand
					</span>
					<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<span
							aria-hidden="true"
							className={`size-2 rounded-full ${following ? "bg-emerald-500" : "bg-amber-500"}`}
						/>
						{following
							? "Following workspace brand"
							: "Customized for this form"}
					</span>
				</div>
				<span className="text-muted-foreground text-xs">
					{brandDescription(hasBrand, following)}
				</span>
				{hasBrand && brand ? (
					<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
						{brand.color ? (
							<span
								aria-hidden="true"
								className="size-3 rounded-full border border-border"
								style={{ backgroundColor: brand.color }}
								title="Brand colour"
							/>
						) : null}
						{brand.theme ?? "default"} theme
						{brand.fontFamily ? ` · ${brand.fontFamily}` : ""}
						{layoutSummary ? ` · ${layoutSummary}` : ""}
					</span>
				) : null}
				<Link
					className="text-primary text-xs underline underline-offset-2"
					search={{ tab: "brand" }}
					to="/dashboard/settings"
				>
					Edit workspace brand
				</Link>
			</div>
			<Switch
				aria-labelledby="workspace-brand-title"
				checked={following}
				onCheckedChange={(checked) => patch({ useWorkspaceBrand: checked })}
			/>
		</div>
	);
}

/** Form-level default image layout applied to newly-added focused questions. */
function FocusedImageDefaultField() {
	const { patch, state, updateField } = useEditor();
	const nested = state.settings.settings;
	const value =
		(nested.focusedImageLayoutDefault as string | undefined) ?? "none";
	const fieldsWithImages = (state.settings.properties as FormField[]).filter(
		(f) => f.image?.url
	);

	return (
		<Field>
			<FieldLabel htmlFor="focused-image-default">
				Default question image layout
			</FieldLabel>
			<div className="flex items-center gap-2">
				<NativeSelect
					id="focused-image-default"
					onChange={(e) =>
						patch({
							settings: {
								...nested,
								focusedImageLayoutDefault: e.target
									.value as FormSettings["settings"]["focusedImageLayoutDefault"],
							},
						})
					}
					value={value}
				>
					{["none", ...FOCUSED_IMAGE_LAYOUTS].map((option) => (
						<NativeSelectOption key={option} value={option}>
							{FOCUSED_IMAGE_LAYOUT_LABELS[option] ?? option}
						</NativeSelectOption>
					))}
				</NativeSelect>
				{fieldsWithImages.length > 0 && value !== "none" ? (
					<Button
						onClick={() => {
							for (const field of fieldsWithImages) {
								updateField(field.id, {
									image: {
										...(field.image ?? {}),
										layout: value as NonNullable<FormField["image"]>["layout"],
									},
								});
							}
						}}
						size="sm"
						type="button"
						variant="outline"
					>
						Apply to all questions
					</Button>
				) : null}
			</div>
			<FieldDescription>
				Used for new questions that get an image. "Apply to all questions" sets
				it on every question that already has one.
			</FieldDescription>
		</Field>
	);
}

export function DesignTab() {
	const { patch, state } = useEditor();
	const { settings } = state;
	const brandPatch = useBrandPatch();
	const theme = useBrandValue("theme");
	const darkMode = useBrandValue("darkMode");
	const color = useBrandValue("color");
	const fontFamily = useBrandValue("fontFamily");
	const size = useBrandValue("size");
	const borderRadius = useBrandValue("borderRadius");
	const width = useBrandValue("width");
	const logoPicture = useBrandValue("logoPicture");
	const classicLayout = useResolvedClassicLayout();
	const isTransparentTheme = theme === "transparent";
	const isFocused = settings.presentationStyle === "focused";
	// Following the workspace brand hides every brand-controlled "look"
	// setting and shows only form style, cover image and the behaviour
	// checkboxes below. Turning off the switch in WorkspaceBrandCard shows the
	// full set again.
	const customizing = !settings.useWorkspaceBrand;

	return (
		<div className="flex flex-col gap-5 p-3 pb-24">
			<WorkspaceBrandCard />
			<PresentationStyleSwitch />
			{isFocused ? <FocusedImageDefaultField /> : null}

			{customizing ? (
				<>
					<Field>
						<BrandFieldLabel brandKey="theme" htmlFor="theme" label="Theme" />
						<OptionCardGrid>
							{THEMES.map((themeOption) => (
								<OptionCard
									illustration={<ThemePreview variant={themeOption} />}
									key={themeOption}
									label={themeOption}
									onSelect={() => brandPatch("theme", themeOption)}
									selected={theme === themeOption}
								/>
							))}
						</OptionCardGrid>
						<FieldDescription>
							The overall look of inputs and cards. "Transparent" blends into
							the page it's embedded in.
						</FieldDescription>
					</Field>
					<Field>
						<BrandFieldLabel
							brandKey="darkMode"
							htmlFor="dark-mode"
							label="Dark mode"
						/>
						<OptionCardGrid>
							{DARK_MODES.map((mode) => (
								<OptionCard
									illustration={<DarkModePreview variant={mode} />}
									key={mode}
									label={mode}
									onSelect={() => brandPatch("darkMode", mode)}
									selected={darkMode === mode}
								/>
							))}
						</OptionCardGrid>
						<FieldDescription>
							"Auto" follows each respondent's device setting; "Light" and
							"Dark" force one appearance for everyone.
						</FieldDescription>
					</Field>
					<Field>
						<BrandFieldLabel
							brandKey="color"
							htmlFor="accent-color"
							label="Accent color"
						/>
						<div className="flex items-center gap-2">
							<input
								className="size-8 cursor-pointer rounded-lg border border-input"
								id="accent-color"
								onChange={(e) => brandPatch("color", e.target.value)}
								type="color"
								value={color}
							/>
							<Input
								onChange={(e) => brandPatch("color", e.target.value)}
								value={color}
							/>
						</div>
						<FieldDescription>
							Used for buttons, selected states, and progress bars across the
							form.
						</FieldDescription>
					</Field>
					<FieldSet className="grid grid-cols-2 gap-2">
						<Field>
							<BrandFieldLabel
								brandKey="fontFamily"
								htmlFor="font"
								label="Font"
							/>
							<NativeSelect
								id="font"
								onChange={(e) =>
									brandPatch("fontFamily", e.target.value || null)
								}
								value={fontFamily ?? ""}
							>
								<NativeSelectOption value="">Default</NativeSelectOption>
								{FONTS.map((font) => (
									<NativeSelectOption key={font} value={font}>
										{font}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field>
							<FieldLabel htmlFor="language">Language</FieldLabel>
							<NativeSelect
								id="language"
								onChange={(e) =>
									patch({
										language: e.target.value as (typeof LANGUAGES)[number],
									})
								}
								value={settings.language}
							>
								{LANGUAGES.map((lang) => (
									<NativeSelectOption key={lang} value={lang}>
										{lang}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</FieldSet>
					<ToggleField id="layoutRtl" label="Right-to-left layout" />
					<ToggleField
						brandKey="uppercaseLabels"
						id="uppercaseLabels"
						label="Uppercase labels"
					/>
					<Field>
						<BrandFieldLabel brandKey="size" htmlFor="size" label="Size" />
						<OptionCardGrid>
							{SIZES.map((sizeOption) => (
								<OptionCard
									illustration={<SizePreview variant={sizeOption} />}
									key={sizeOption}
									label={sizeOption}
									onSelect={() => brandPatch("size", sizeOption)}
									selected={size === sizeOption}
								/>
							))}
						</OptionCardGrid>
						<FieldDescription>
							Overall text and control size: "sm" fits more on screen, "lg" is
							easier to tap on mobile.
						</FieldDescription>
					</Field>
					{isTransparentTheme ? null : (
						<Field>
							<BrandFieldLabel
								brandKey="borderRadius"
								htmlFor="border-radius"
								label="Border radius"
							/>
							<OptionCardGrid>
								{BORDER_RADII.map((radius) => (
									<OptionCard
										illustration={<RadiusPreview variant={radius} />}
										key={radius}
										label={radius}
										onSelect={() => brandPatch("borderRadius", radius)}
										selected={borderRadius === radius}
									/>
								))}
							</OptionCardGrid>
							<FieldDescription>
								How rounded inputs, cards, and buttons are, from sharp corners
								to fully pill-shaped.
							</FieldDescription>
						</Field>
					)}
					{isFocused ? null : (
						<Field>
							<BrandFieldLabel brandKey="width" htmlFor="width" label="Width" />
							<OptionCardGrid>
								{WIDTHS.map((widthOption) => (
									<OptionCard
										illustration={<WidthPreview variant={widthOption} />}
										key={widthOption}
										label={widthOption}
										onSelect={() => brandPatch("width", widthOption)}
										selected={width === widthOption}
									/>
								))}
							</OptionCardGrid>
							<FieldDescription>
								"Centered" keeps the form narrow and readable; "Full" stretches
								it to the page's width.
							</FieldDescription>
						</Field>
					)}
					<FieldSet className="gap-2">
						<BrandFieldLabel
							brandKey="logoPicture"
							htmlFor="logo"
							label="Logo (light theme)"
						/>
						<div className="flex items-center gap-2">
							<UploadButton
								accept="image/*"
								label={logoPicture ? "Replace logo" : "Upload logo"}
								onUploaded={(url) => brandPatch("logoPicture", url)}
							/>
							{logoPicture ? (
								<Button
									onClick={() => brandPatch("logoPicture", null)}
									size="sm"
									type="button"
									variant="ghost"
								>
									Remove
								</Button>
							) : null}
						</div>
						<FieldDescription>
							Shown when the resolved colour scheme is light.
						</FieldDescription>
					</FieldSet>
					<NestedImageField
						brandKey="logoPictureDark"
						label="Logo (dark theme)"
					>
						<FieldDescription>
							Shown when the resolved colour scheme is dark. Falls back to the
							light logo if empty, and vice versa.
						</FieldDescription>
					</NestedImageField>
					<LayoutFields classicLayout={classicLayout} customizing />
				</>
			) : (
				<LayoutFields classicLayout={classicLayout} customizing={false} />
			)}
			<ToggleField
				brandKey="noBranding"
				id="noBranding"
				label="Hide StryveForms branding"
			/>
			<ToggleField id="showProgressBar" label="Show progress bar" />
			<ToggleField id="transparentBackground" label="Transparent background" />
			<ToggleField id="confettiOnSubmission" label="Confetti on submit" />
			<ToggleField id="autoFocus" label="Auto-focus the first field" />
			{isFocused && (
				<>
					<NestedSettingToggle
						id="navigation_arrows"
						label="Show navigation arrows"
					/>
					<NestedSettingToggle
						id="auto_next"
						label="Auto-advance after answering"
					/>
				</>
			)}
		</div>
	);
}
