import { Button } from "@StryveForms/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { Input } from "@StryveForms/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { RouterOutputs } from "@/utils/trpc";
import { useTRPC } from "@/utils/trpc";

import type { PickedImage } from "./types";

type UnsplashPhoto =
	RouterOutputs["media"]["unsplash"]["search"]["photos"][number];
type FreeFilter = "free" | "premium" | "all";
type Orientation = "any" | "landscape" | "portrait" | "squarish";

const SEARCH_DEBOUNCE_MS = 500;
const ORIENTATIONS: { label: string; value: Orientation }[] = [
	{ label: "Any orientation", value: "any" },
	{ label: "Landscape", value: "landscape" },
	{ label: "Portrait", value: "portrait" },
	{ label: "Square", value: "squarish" },
];
const UNSPLASH_UTM = "?utm_source=stryveforms&utm_medium=referral";
const FREE_FILTER_LABELS: Record<FreeFilter, string> = {
	all: "All",
	free: "Free",
	premium: "Premium",
};

/** Debounces a value — used so search doesn't fire on every keystroke (and to respect Unsplash's rate limit). */
function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timeout = setTimeout(() => setDebounced(value), delayMs);
		return () => clearTimeout(timeout);
	}, [value, delayMs]);
	return debounced;
}

/** The plain-language "no key yet" state, shown instead of a search box. */
function NotConfigured() {
	return (
		<Empty>
			<EmptyMedia variant="icon">
				<SparklesIcon />
			</EmptyMedia>
			<EmptyTitle>Unsplash isn't turned on yet</EmptyTitle>
			<EmptyDescription>
				Ask an administrator to add a free Unsplash Access Key in{" "}
				<span className="font-medium">Admin → Images & Unsplash</span>, then
				turn it on. Get a key at{" "}
				<a
					href="https://unsplash.com/developers"
					rel="noopener"
					target="_blank"
				>
					unsplash.com/developers
				</a>
				.
			</EmptyDescription>
		</Empty>
	);
}

/**
 * The "Premium" tab: Unsplash's own API has no documented way to fetch or
 * filter in actual Unsplash+ content (see README.md's research write-up) —
 * so rather than faking results, this explains that plainly and links out.
 */
function PremiumNotAvailable() {
	return (
		<Empty>
			<EmptyMedia variant="icon">
				<SparklesIcon />
			</EmptyMedia>
			<EmptyTitle>Premium isn't available through this picker</EmptyTitle>
			<EmptyDescription>
				Unsplash+ (Premium) photos aren't available through the public API this
				app uses — only Unsplash's free, standard-licensed library is searchable
				here. Browse and license Unsplash+ photos directly on Unsplash instead.
			</EmptyDescription>
			<Button
				render={
					<a
						href={`https://unsplash.com/plus${UNSPLASH_UTM}`}
						rel="noopener"
						target="_blank"
					>
						Browse Unsplash+
						<ExternalLinkIcon />
					</a>
				}
				size="sm"
				variant="outline"
			/>
		</Empty>
	);
}

function PhotoCredit({ photo }: { photo: UnsplashPhoto }) {
	return (
		<p className="truncate text-muted-foreground text-xs">
			Photo by{" "}
			<a
				className="underline underline-offset-2 hover:text-foreground"
				href={`${photo.user.profileLink}${UNSPLASH_UTM}`}
				onClick={(e) => e.stopPropagation()}
				rel="noopener"
				target="_blank"
			>
				{photo.user.name}
			</a>{" "}
			on{" "}
			<a
				className="underline underline-offset-2 hover:text-foreground"
				href={`https://unsplash.com/${UNSPLASH_UTM}`}
				onClick={(e) => e.stopPropagation()}
				rel="noopener"
				target="_blank"
			>
				Unsplash
			</a>
		</p>
	);
}

/** Search Unsplash's free photo library, with an orientation filter and the Free/Premium/All control. */
export function UnsplashTab({
	onPick,
	workspaceId,
}: {
	onPick: (image: PickedImage) => void;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const status = useQuery(trpc.media.unsplash.status.queryOptions());
	const [query, setQuery] = useState("");
	const [orientation, setOrientation] = useState<Orientation>("any");
	const [freeFilter, setFreeFilter] = useState<FreeFilter>("free");
	const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

	const search = useQuery({
		...trpc.media.unsplash.search.queryOptions({
			orientation: orientation === "any" ? undefined : orientation,
			query: debouncedQuery,
			workspaceId,
		}),
		enabled: Boolean(status.data?.enabled && debouncedQuery.trim()),
	});

	const trackDownload = useMutation(
		trpc.media.unsplash.trackDownload.mutationOptions()
	);

	function pick(photo: UnsplashPhoto) {
		// Required by the Unsplash API guideline: ping download_location the
		// moment a photo is actually used, not on hover/preview. Best-effort —
		// the picker doesn't wait on it or surface a failure.
		trackDownload.mutate({
			downloadLocation: photo.downloadLocation,
			workspaceId,
		});
		onPick({
			alt: photo.altDescription ?? photo.description ?? undefined,
			credit: {
				name: photo.user.name,
				source: "unsplash",
				url: `${photo.user.profileLink}${UNSPLASH_UTM}`,
			},
			url: photo.urls.regular,
		});
	}

	if (status.data && !status.data.enabled) {
		return <NotConfigured />;
	}

	return (
		<div className="space-y-3">
			<div className="flex gap-2">
				<div className="relative flex-1">
					<SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="pl-8"
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search free photos…"
						value={query}
					/>
				</div>
				<Select
					items={ORIENTATIONS}
					onValueChange={(value) => setOrientation(value as Orientation)}
					value={orientation}
				>
					<SelectTrigger className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{ORIENTATIONS.map((o) => (
							<SelectItem key={o.value} value={o.value}>
								{o.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex gap-1.5">
				{(["free", "premium", "all"] as const).map((filter) => (
					<Button
						className="rounded-full"
						key={filter}
						onClick={() => setFreeFilter(filter)}
						size="sm"
						variant={freeFilter === filter ? "default" : "outline"}
					>
						{FREE_FILTER_LABELS[filter]}
					</Button>
				))}
			</div>
			<p className="text-muted-foreground text-xs">
				{freeFilter === "premium"
					? "Unsplash+ licensing isn't available through this picker — see below."
					: "Searches Unsplash's free, standard-licensed library. Attribution is added automatically."}
			</p>

			{freeFilter === "premium" ? (
				<PremiumNotAvailable />
			) : (
				<UnsplashResults onPick={pick} query={debouncedQuery} search={search} />
			)}
		</div>
	);
}

function UnsplashResults({
	onPick,
	query,
	search,
}: {
	onPick: (photo: UnsplashPhoto) => void;
	query: string;
	search: {
		data?: { photos: UnsplashPhoto[] };
		error: { message: string } | null;
		isFetching: boolean;
	};
}) {
	if (!query.trim()) {
		return (
			<Empty>
				<EmptyMedia variant="icon">
					<SearchIcon />
				</EmptyMedia>
				<EmptyTitle>Search for a photo</EmptyTitle>
				<EmptyDescription>
					Try "office", "nature", or "abstract background".
				</EmptyDescription>
			</Empty>
		);
	}
	if (search.isFetching && !search.data) {
		return (
			<div className="grid grid-cols-3 gap-2">
				{["a", "b", "c", "d", "e", "f"].map((key) => (
					<Skeleton className="aspect-[4/3] rounded-lg" key={key} />
				))}
			</div>
		);
	}
	if (search.error) {
		return <p className="text-destructive text-sm">{search.error.message}</p>;
	}
	if (!search.data?.photos.length) {
		return (
			<Empty>
				<EmptyMedia variant="icon">
					<SearchIcon />
				</EmptyMedia>
				<EmptyTitle>No photos found</EmptyTitle>
				<EmptyDescription>Try a different search term.</EmptyDescription>
			</Empty>
		);
	}
	return (
		<div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
			{search.data.photos.map((photo) => (
				<button
					className={cn(
						"group flex flex-col gap-1 rounded-lg p-1 text-left focus-visible:ring-2 focus-visible:ring-ring"
					)}
					key={photo.id}
					onClick={() => onPick(photo)}
					type="button"
				>
					<span className="relative block aspect-[4/3] overflow-hidden rounded-lg border border-border">
						<img
							alt={photo.altDescription ?? ""}
							className="size-full object-cover transition-opacity group-hover:opacity-80"
							height={160}
							loading="lazy"
							src={photo.urls.small}
							width={213}
						/>
					</span>
					<PhotoCredit photo={photo} />
				</button>
			))}
		</div>
	);
}
