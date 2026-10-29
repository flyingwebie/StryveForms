import {
	Empty,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { Input } from "@StryveForms/ui/components/input";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useTRPC } from "@/utils/trpc";

import type { PickedImage } from "./types";

const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** The workspace's own previously uploaded images, newest first, with a client-side name search (the list is already fully loaded — no server-side search endpoint exists). */
export function LibraryTab({
	onPick,
	workspaceId,
}: {
	onPick: (image: PickedImage) => void;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const [query, setQuery] = useState("");
	const library = useQuery(
		trpc.media.library.list.queryOptions({ workspaceId })
	);
	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) {
			return library.data;
		}
		return library.data?.filter((image) =>
			image.name.toLowerCase().includes(q)
		);
	}, [library.data, query]);

	if (!library.data) {
		return (
			<div className="grid grid-cols-4 gap-3">
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
		<div className="flex flex-col gap-3">
			<div className="relative">
				<SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					className="pl-8"
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search your library"
					value={query}
				/>
			</div>
			{filtered && filtered.length > 0 ? (
				<div className="grid grid-cols-4 gap-3">
					{filtered.map((image) => (
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
								height={200}
								loading="lazy"
								src={image.url}
								width={200}
							/>
						</button>
					))}
				</div>
			) : (
				<p className="py-6 text-center text-muted-foreground text-sm">
					No images match "{query}".
				</p>
			)}
		</div>
	);
}
