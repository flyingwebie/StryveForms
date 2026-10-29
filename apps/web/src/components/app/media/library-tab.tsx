import {
	Empty,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { useTRPC } from "@/utils/trpc";

import type { PickedImage } from "./types";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** The workspace's own previously uploaded images, newest first. */
export function LibraryTab({
	onPick,
	workspaceId,
}: {
	onPick: (image: PickedImage) => void;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const library = useQuery(
		trpc.media.library.list.queryOptions({ workspaceId })
	);

	if (!library.data) {
		return (
			<div className="grid grid-cols-4 gap-2">
				{SKELETON_KEYS.map((key) => (
					<Skeleton className="aspect-square rounded-lg" key={key} />
				))}
			</div>
		);
	}

	if (library.data.length === 0) {
		return (
			<Empty>
				<EmptyMedia variant="icon">
					<ImageIcon />
				</EmptyMedia>
				<EmptyTitle>No uploads yet</EmptyTitle>
				<EmptyDescription>
					Images you upload anywhere in this workspace show up here for reuse.
				</EmptyDescription>
			</Empty>
		);
	}

	return (
		<div className="grid grid-cols-4 gap-2">
			{library.data.map((image) => (
				<button
					className="group relative aspect-square overflow-hidden rounded-lg border border-border focus-visible:ring-2 focus-visible:ring-ring"
					key={image.id}
					onClick={() => onPick({ url: image.url })}
					title={image.name}
					type="button"
				>
					<img
						alt={image.name}
						className="size-full object-cover transition-opacity group-hover:opacity-80"
						height={160}
						loading="lazy"
						src={image.url}
						width={160}
					/>
				</button>
			))}
		</div>
	);
}
