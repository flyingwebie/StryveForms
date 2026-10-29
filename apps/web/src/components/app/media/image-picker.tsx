import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@StryveForms/ui/components/dialog";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { type ReactElement, useState } from "react";

import { LibraryTab } from "./library-tab";
import type { ImagePickerTab, PickedImage } from "./types";
import { UnsplashTab } from "./unsplash-tab";
import { UploadTab } from "./upload-tab";

export type { ImagePickerTab, PickedImage } from "./types";

/**
 * Shared "pick an image" control: a thumbnail of the current image with
 * Replace/Remove, opening a dialog with Upload/Library/Unsplash tabs. See
 * README.md (same folder) for the full props contract and the `PickedImage`
 * shape, documented here so integrators can build against it.
 */
function ImagePicker({
	accept = "image/*",
	onChange,
	trigger,
	value,
	workspaceId,
}: {
	accept?: string;
	/** Optional width/height hint for the Upload/Library thumbnail grid. Purely visual — no crop is performed. */
	aspect?: number;
	onChange: (value: PickedImage | null) => void;
	trigger?: ReactElement;
	value: PickedImage | null;
	workspaceId: string;
}) {
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState<ImagePickerTab>("upload");

	function pick(image: PickedImage) {
		onChange(image);
		setOpen(false);
	}

	return (
		<div className="flex items-center gap-2">
			{value ? (
				<img
					alt={value.alt ?? ""}
					className="size-14 shrink-0 rounded-lg border border-border object-cover"
					height={56}
					src={value.url}
					width={56}
				/>
			) : null}
			<div className="flex flex-wrap gap-2">
				<Dialog onOpenChange={setOpen} open={open}>
					<DialogTrigger
						render={
							trigger ?? (
								<Button size="sm" type="button" variant="outline">
									{value ? "Replace image" : "Choose image"}
								</Button>
							)
						}
					/>
					<DialogContent className="sm:max-w-3xl">
						<DialogHeader>
							<DialogTitle>Choose an image</DialogTitle>
						</DialogHeader>
						<Tabs
							onValueChange={(value_) => setTab(value_ as ImagePickerTab)}
							value={tab}
						>
							<TabsList
								className="w-full justify-start border-b"
								variant="line"
							>
								<TabsTrigger value="upload">Upload</TabsTrigger>
								<TabsTrigger value="library">Library</TabsTrigger>
								<TabsTrigger value="unsplash">Unsplash</TabsTrigger>
							</TabsList>
							<TabsContent className="pt-1" value="upload">
								<UploadTab
									accept={accept}
									onUploaded={pick}
									workspaceId={workspaceId}
								/>
							</TabsContent>
							<TabsContent className="pt-1" value="library">
								<LibraryTab onPick={pick} workspaceId={workspaceId} />
							</TabsContent>
							<TabsContent className="pt-1" value="unsplash">
								<UnsplashTab onPick={pick} workspaceId={workspaceId} />
							</TabsContent>
						</Tabs>
					</DialogContent>
				</Dialog>
				{value ? (
					<Button
						onClick={() => onChange(null)}
						size="sm"
						type="button"
						variant="ghost"
					>
						Remove
					</Button>
				) : null}
			</div>
		</div>
	);
}

export default ImagePicker;
