import type { BlockImage } from "@StryveForms/forms/types";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@StryveForms/ui/components/popover";
import { ImageIcon } from "lucide-react";
import { ImageLayoutEditor } from "../shared/image-layout-editor";
import { useEditor } from "../state/editor-context";

/**
 * A page's thumbnail + "change image" trigger: opens the same upload/layout/
 * alt/focal/brightness controls as a single question's image
 * (`focused-image-panel.tsx`), via the shared `ImageLayoutEditor`, but
 * patches the page's entry in `settings.settings.pageImages` instead of a
 * field.
 */
export function PageImagePanel({
	image,
	label,
	onChange,
	pageKey,
}: {
	image: BlockImage | undefined;
	label: string;
	onChange: (patch: Partial<BlockImage>) => void;
	pageKey: string;
}) {
	const { meta } = useEditor();
	return (
		<Popover>
			<PopoverTrigger
				render={
					<button
						aria-label={`${label} image`}
						className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 text-muted-foreground transition-colors hover:border-primary"
						type="button"
					/>
				}
			>
				{image?.url ? (
					<img
						alt={image.alt ?? ""}
						className="size-full object-cover"
						height={64}
						src={image.url}
						width={64}
					/>
				) : (
					<ImageIcon className="size-5" />
				)}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80" key={pageKey}>
				<div className="flex flex-col gap-3">
					<p className="font-medium text-sm">{label} image</p>
					<p className="text-muted-foreground text-xs">
						Shown only in focused mode, behind or alongside every field on this
						page.
					</p>
					<ImageLayoutEditor
						idPrefix={pageKey}
						image={image ?? {}}
						onChange={onChange}
						workspaceId={meta.workspaceId}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
