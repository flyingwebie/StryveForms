import type { BlockImage } from "@StryveForms/forms/types";
import { Field, FieldLabel } from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import { Slider } from "@StryveForms/ui/components/slider";
import ImagePicker from "@/components/app/media/image-picker";
import type { PickedImage } from "@/components/app/media/types";
import {
	FOCUSED_IMAGE_LAYOUTS,
	normalizeImageLayout,
} from "../../form-renderer/image-layout";
import { ImageLayoutPreview } from "../design/illustrations";
import { OptionCard, OptionCardGrid } from "../design/option-card";

const LAYOUT_LABELS: Record<string, string> = {
	"split-left": "Split left",
	"split-right": "Split right",
	stack: "Stack",
	wallpaper: "Wallpaper",
};

const LAYOUT_DESCRIPTIONS: Record<string, string> = {
	"split-left": "Image fills the left half of the screen, full height.",
	"split-right": "Image fills the right half of the screen, full height.",
	stack: "Image sits above the question.",
	wallpaper:
		"Image fills the background, dimmed so the question stays readable.",
};

/**
 * Upload + layout + alt text + focal point + brightness controls for one
 * `BlockImage` — shared by `focused-image-panel.tsx` (a single question's
 * image) and the Pages tab's page-image panel (a whole page's image), so
 * both stay visually and behaviorally identical.
 */
export function ImageLayoutEditor({
	idPrefix,
	image,
	onChange,
	workspaceId,
}: {
	idPrefix: string;
	image: BlockImage;
	onChange: (patch: Partial<BlockImage>) => void;
	/** Scopes the picker's Upload/Library tabs to this workspace. */
	workspaceId: string;
}) {
	const layout = normalizeImageLayout(image.layout);
	const pickedValue: PickedImage | null = image.url
		? { alt: image.alt, credit: image.credit, url: image.url }
		: null;

	function handlePicked(picked: PickedImage | null) {
		if (!picked) {
			onChange({ credit: undefined, url: undefined });
			return;
		}
		onChange({
			alt: picked.alt ?? image.alt,
			credit: picked.credit,
			url: picked.url,
		});
	}

	return (
		<>
			<ImagePicker
				onChange={handlePicked}
				value={pickedValue}
				workspaceId={workspaceId}
			/>
			{image.credit ? (
				<p className="text-muted-foreground text-xs">
					Picked from Unsplash — "Photo by {image.credit.name} on Unsplash"
					shows automatically wherever this image appears.
				</p>
			) : null}
			{image.url ? (
				<>
					<Field>
						<FieldLabel>Layout</FieldLabel>
						<OptionCardGrid>
							{FOCUSED_IMAGE_LAYOUTS.map((option) => (
								<OptionCard
									illustration={<ImageLayoutPreview variant={option} />}
									key={option}
									label={LAYOUT_LABELS[option] ?? option}
									onSelect={() => onChange({ layout: option })}
									selected={layout === option}
								/>
							))}
						</OptionCardGrid>
						<p className="text-muted-foreground text-xs">
							{LAYOUT_DESCRIPTIONS[layout]}
						</p>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${idPrefix}-image-alt`}>Alt text</FieldLabel>
						<Input
							id={`${idPrefix}-image-alt`}
							onChange={(e) => onChange({ alt: e.target.value })}
							placeholder="Describe the image for screen readers"
							value={image.alt ?? ""}
						/>
						<p className="text-muted-foreground text-xs">
							Read aloud by screen readers instead of the picture.
						</p>
					</Field>
					<Field>
						<FieldLabel>Focal point — horizontal</FieldLabel>
						<Slider
							max={100}
							min={0}
							onValueChange={(next) => {
								const x = Array.isArray(next) ? next[0] : next;
								onChange({
									focal_point: { x, y: image.focal_point?.y ?? 50 },
								});
							}}
							value={[image.focal_point?.x ?? 50]}
						/>
					</Field>
					<Field>
						<FieldLabel>Focal point — vertical</FieldLabel>
						<Slider
							max={100}
							min={0}
							onValueChange={(next) => {
								const y = Array.isArray(next) ? next[0] : next;
								onChange({
									focal_point: { x: image.focal_point?.x ?? 50, y },
								});
							}}
							value={[image.focal_point?.y ?? 50]}
						/>
						<p className="text-muted-foreground text-xs">
							Keeps the important part of the image visible when it's cropped
							(split/wallpaper layouts).
						</p>
					</Field>
					<Field>
						<FieldLabel>Brightness</FieldLabel>
						<Slider
							max={100}
							min={-100}
							onValueChange={(next) => {
								const value = Array.isArray(next) ? next[0] : next;
								onChange({ brightness: value });
							}}
							value={[image.brightness ?? 0]}
						/>
					</Field>
				</>
			) : null}
		</>
	);
}
