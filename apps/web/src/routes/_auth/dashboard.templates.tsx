import type { FormField } from "@StryveForms/forms/types";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { Input } from "@StryveForms/ui/components/input";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutTemplateIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import ConfirmDialog from "@/components/app/confirm-dialog";
import { subtreeIds } from "@/components/app/folders/folder-tree-utils";
import PageHeader, { PageBody } from "@/components/app/page-header";
import NewTemplateDialog from "@/components/app/templates/new-template-dialog";
import TemplateCard, {
	type TemplateCardData,
} from "@/components/app/templates/template-card";
import TemplateDetailsDialog, {
	type TemplateDetailsTarget,
} from "@/components/app/templates/template-details-dialog";
import TemplatePreviewDialog from "@/components/app/templates/template-preview-dialog";
import { useInstance } from "@/lib/instance";
import { useWorkspaces } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

/** The instance's default primary colour (see `primaryColor` default in the forms DB schema) —
 * used to decide whether the hero may use the fixed brand gradient, or must follow `bg-primary`. */
const DEFAULT_BRAND_COLOR = "#7c3aed";

export const Route = createFileRoute("/_auth/dashboard/templates")({
	component: RouteComponent,
	validateSearch: z.object({
		/** Set by clicking a sidebar folder — only "My templates" has folders. */
		folder: z.string().optional(),
	}),
});

const SKELETON_IDS = ["t-1", "t-2", "t-3", "t-4", "t-5", "t-6"];

/** "Use template": creates a form from a built-in (slug) or custom (id) template, then opens it. */
function useTemplateCreation(workspaceId: string | null) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const create = useMutation(
		trpc.form.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => {
				navigate({ to: "/editor/$formId", params: { formId: data.id } });
			},
		})
	);
	const createFromId = (id: string) => {
		if (workspaceId) {
			create.mutate({ templateId: id, workspaceId });
		}
	};
	const createFromSlug = (slug: string) => {
		if (workspaceId) {
			create.mutate({ templateSlug: slug, workspaceId });
		}
	};
	return {
		create,
		createFromId,
		createFromSlug,
		/** Dispatches "Use template" for the preview dialog's (built-in or custom) target. */
		createFromPreview: (preview: { id?: string; slug?: string } | null) => {
			const slugOrId = preview?.slug ?? preview?.id;
			if (!slugOrId) {
				return;
			}
			if (preview?.slug) {
				createFromSlug(slugOrId);
			} else {
				createFromId(slugOrId);
			}
		},
	};
}

/** Narrows `mine` to one folder (and its subfolders) for the sidebar's folder view. */
function filterByFolder<T extends { folderId: string | null }>(
	items: T[],
	folder: string | undefined,
	subtree: Set<string> | null
): T[] {
	if (!folder) {
		return items;
	}
	if (folder === "none") {
		return items.filter((t) => !t.folderId);
	}
	return items.filter((t) => Boolean(t.folderId && subtree?.has(t.folderId)));
}

function filterTemplates<
	T extends {
		category?: string | null;
		description?: string | null;
		name: string;
	},
>(items: T[], search: string, category: string | null): T[] {
	return items.filter((item) => {
		const matchesCategory = !category || item.category === category;
		const haystack = `${item.name} ${item.description ?? ""}`.toLowerCase();
		const matchesSearch = !search || haystack.includes(search.toLowerCase());
		return matchesCategory && matchesSearch;
	});
}

function CategoryChips({
	categories,
	onSelect,
	selected,
}: {
	categories: string[];
	onSelect: (category: string | null) => void;
	selected: string | null;
}) {
	return (
		<div className="flex flex-wrap gap-1.5">
			<Badge
				className="cursor-pointer"
				onClick={() => onSelect(null)}
				variant={selected === null ? "soft" : "outline"}
			>
				All
			</Badge>
			{categories.map((category) => (
				<Badge
					className="cursor-pointer"
					key={category}
					onClick={() => onSelect(category)}
					variant={selected === category ? "soft" : "outline"}
				>
					{category}
				</Badge>
			))}
		</div>
	);
}

/**
 * The editorial hero banner: Instrument Serif headline + search. Uses the
 * fixed brand gradient only on a default-branded instance — a white-labelled
 * one (custom `primaryColor`) gets a flat `bg-primary` instead.
 */
function TemplatesHero({
	onSearchChange,
	search,
	templateCount,
}: {
	onSearchChange: (value: string) => void;
	search: string;
	templateCount: number;
}) {
	const instance = useInstance();
	const isDefaultBrand =
		!instance?.primaryColor ||
		instance.primaryColor.toLowerCase() === DEFAULT_BRAND_COLOR;

	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-2xl px-6 py-8 text-white sm:px-10 sm:py-10",
				isDefaultBrand
					? "bg-gradient-to-br from-[#8B5CF6] to-[#4338CA]"
					: "bg-primary"
			)}
		>
			<div className="flex flex-wrap items-center justify-between gap-6">
				<div className="max-w-xl">
					<h2 className="font-display text-3xl leading-tight sm:text-4xl">
						Start with a form that already works
					</h2>
					<p className="mt-2 text-sm text-white/80">
						Browse {templateCount} templates built by the StryveForms team, or
						start from one of your own.
					</p>
				</div>
				<div className="relative w-full max-w-xs">
					<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
					<Input
						aria-label="Search templates"
						className="border-0 bg-white pl-8 text-foreground shadow-sm placeholder:text-muted-foreground"
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Search…"
						value={search}
					/>
				</div>
			</div>
		</div>
	);
}

function BuiltInTemplatesTab({
	isLoading,
	onPreview,
	onUse,
	templates,
}: {
	isLoading: boolean;
	onPreview: (template: TemplateCardData) => void;
	onUse: (slug: string) => void;
	templates: TemplateCardData[];
}) {
	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{SKELETON_IDS.map((id) => (
					<Skeleton className="h-64 w-full rounded-xl" key={id} />
				))}
			</div>
		);
	}
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{templates.map((template) => (
				<TemplateCard
					isCustom={false}
					key={template.slug}
					onPreview={() => onPreview(template)}
					onUse={() => template.slug && onUse(template.slug)}
					template={template}
				/>
			))}
		</div>
	);
}

function MyTemplatesTab({
	folders,
	foldersById,
	isLoading,
	onDelete,
	onEdit,
	onMoveToFolder,
	onPreview,
	onUse,
	templates,
}: {
	folders: {
		color: string | null;
		icon: string | null;
		id: string;
		name: string;
	}[];
	foldersById: Map<
		string,
		{ color: string | null; icon: string | null; id: string; name: string }
	>;
	isLoading: boolean;
	onDelete: (template: TemplateCardData & { id: string }) => void;
	onEdit: (template: TemplateDetailsTarget) => void;
	onMoveToFolder: (id: string, folderId: string | null) => void;
	onPreview: (template: TemplateCardData) => void;
	onUse: (id: string) => void;
	templates: (TemplateCardData & {
		category: string | null;
		color: string | null;
		description: string | null;
		folderId: string | null;
		icon: string | null;
		id: string;
	})[];
}) {
	if (isLoading) {
		return (
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{SKELETON_IDS.map((id) => (
					<Skeleton className="h-64 w-full rounded-xl" key={id} />
				))}
			</div>
		);
	}
	if (templates.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<LayoutTemplateIcon />
					</EmptyMedia>
					<EmptyTitle>No templates yet</EmptyTitle>
					<EmptyDescription>
						Save a form as a template, or create a new one from scratch.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{templates.map((template) => (
				<TemplateCard
					folder={template.folderId ? foldersById.get(template.folderId) : null}
					folders={folders}
					isCustom
					key={template.id}
					onDelete={() => onDelete(template)}
					onEdit={() =>
						onEdit({
							id: template.id,
							name: template.name,
							description: template.description,
							category: template.category,
							color: template.color,
							icon: template.icon,
						})
					}
					onMoveToFolder={(folderId) => onMoveToFolder(template.id, folderId)}
					onPreview={() => onPreview(template)}
					onUse={() => onUse(template.id)}
					template={template}
				/>
			))}
		</div>
	);
}

function RouteComponent() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { activeWorkspaceId } = useWorkspaces();
	const { folder } = Route.useSearch();
	const [tab, setTab] = useState<"builtin" | "mine">("builtin");
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState<string | null>(null);
	const [preview, setPreview] = useState<TemplateCardData | null>(null);
	const [newOpen, setNewOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<TemplateDetailsTarget | null>(
		null
	);
	const [deleteTarget, setDeleteTarget] = useState<TemplateCardData | null>(
		null
	);

	useEffect(() => {
		if (folder) {
			setTab("mine");
		}
	}, [folder]);

	const builtInQuery = useQuery(trpc.template.list.queryOptions());
	const builtInCategoriesQuery = useQuery(
		trpc.template.categories.queryOptions()
	);
	const mineQuery = useQuery({
		...trpc.template.listMine.queryOptions({
			workspaceId: activeWorkspaceId ?? "",
		}),
		enabled: Boolean(activeWorkspaceId),
	});
	const foldersQuery = useQuery({
		...trpc.folder.list.queryOptions({
			workspaceId: activeWorkspaceId ?? "",
			kind: "template",
		}),
		enabled: Boolean(activeWorkspaceId),
	});

	const { createFromId, createFromPreview, createFromSlug } =
		useTemplateCreation(activeWorkspaceId);
	const deleteTemplate = useMutation(
		trpc.template.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.template.listMine.queryKey({
						workspaceId: activeWorkspaceId ?? "",
					}),
				});
				toast.success("Template deleted");
				setDeleteTarget(null);
			},
		})
	);
	const moveToFolder = useMutation(
		trpc.template.moveToFolder.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.template.listMine.queryKey({
						workspaceId: activeWorkspaceId ?? "",
					}),
				});
				await queryClient.invalidateQueries({
					queryKey: trpc.folder.list.queryKey({
						workspaceId: activeWorkspaceId ?? "",
						kind: "template",
					}),
				});
				toast.success("Moved to folder");
			},
		})
	);

	const builtIn = builtInQuery.data ?? [];
	const mine = (mineQuery.data ?? []).map((t) => ({
		...t,
		properties: t.properties as FormField[],
	}));
	const folders = foldersQuery.data ?? [];
	const foldersById = new Map(folders.map((f) => [f.id, f]));

	const mineCategories = Array.from(
		new Set(mine.map((t) => t.category).filter((c): c is string => Boolean(c)))
	).sort();
	const categories =
		tab === "builtin" ? (builtInCategoriesQuery.data ?? []) : mineCategories;

	const activeFolder = folders.find((f) => f.id === folder);
	const activeFolderHasChildren =
		activeFolder && folders.some((f) => f.parentId === activeFolder.id);
	// A parent folder's view includes its subfolders' templates too.
	const activeFolderSubtree = activeFolder
		? new Set(subtreeIds(folders, activeFolder.id))
		: null;
	const mineFiltered = filterTemplates(
		filterByFolder(mine, folder, activeFolderSubtree),
		search,
		category
	);
	const builtInFiltered = filterTemplates(builtIn, search, category);

	function handleUsePreview() {
		createFromPreview(preview);
		setPreview(null);
	}

	const activeCount = tab === "builtin" ? builtIn.length : mine.length;

	return (
		<PageBody>
			<PageHeader
				actions={
					<Button onClick={() => setNewOpen(true)}>
						<PlusIcon /> New template
					</Button>
				}
				description="Start from a template built by the StryveForms team, or save one of your own."
				eyebrow={`${activeCount} template${activeCount === 1 ? "" : "s"}`}
				title="Templates"
			/>

			{activeFolderHasChildren ? (
				<p className="-mt-4 text-muted-foreground text-xs">
					Showing templates in {activeFolder?.name} and its subfolders.
				</p>
			) : null}

			<TemplatesHero
				onSearchChange={setSearch}
				search={search}
				templateCount={builtIn.length}
			/>

			<Tabs
				onValueChange={(value) => {
					setTab(value as "builtin" | "mine");
					setCategory(null);
				}}
				value={tab}
			>
				<TabsList variant="line">
					<TabsTrigger value="builtin">Built-in</TabsTrigger>
					<TabsTrigger value="mine">My templates</TabsTrigger>
				</TabsList>

				{categories.length > 0 ? (
					<div className="pt-4">
						<CategoryChips
							categories={categories}
							onSelect={setCategory}
							selected={category}
						/>
					</div>
				) : null}

				<TabsContent className="pt-4" value="builtin">
					<BuiltInTemplatesTab
						isLoading={builtInQuery.isLoading}
						onPreview={setPreview}
						onUse={createFromSlug}
						templates={builtInFiltered}
					/>
				</TabsContent>

				<TabsContent className="pt-4" value="mine">
					<MyTemplatesTab
						folders={folders}
						foldersById={foldersById}
						isLoading={mineQuery.isLoading}
						onDelete={(template) => setDeleteTarget(template)}
						onEdit={(target) => setEditTarget(target)}
						onMoveToFolder={(id, folderId) =>
							moveToFolder.mutate({ id, folderId })
						}
						onPreview={(template) => setPreview(template)}
						onUse={createFromId}
						templates={mineFiltered}
					/>
				</TabsContent>
			</Tabs>

			{preview ? (
				<TemplatePreviewDialog
					category={preview.category}
					name={preview.name}
					onOpenChange={(open) => {
						if (!open) {
							setPreview(null);
						}
					}}
					onUse={activeWorkspaceId ? handleUsePreview : undefined}
					open={preview !== null}
					structure={
						"structure" in preview
							? (preview as unknown as { structure: Record<string, unknown> })
									.structure
							: { title: preview.name, properties: preview.properties }
					}
				/>
			) : null}

			{activeWorkspaceId ? (
				<NewTemplateDialog
					onOpenChange={setNewOpen}
					open={newOpen}
					workspaceId={activeWorkspaceId}
				/>
			) : null}
			{activeWorkspaceId ? (
				<TemplateDetailsDialog
					onOpenChange={(open) => {
						if (!open) {
							setEditTarget(null);
						}
					}}
					open={editTarget !== null}
					template={editTarget}
					workspaceId={activeWorkspaceId}
				/>
			) : null}
			<ConfirmDialog
				description={`"${deleteTarget?.name}" will no longer be available in My templates. This can't be undone.`}
				loading={deleteTemplate.isPending}
				onConfirm={() =>
					deleteTarget?.id && deleteTemplate.mutate({ id: deleteTarget.id })
				}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
				open={deleteTarget !== null}
				title="Delete this template?"
			/>
		</PageBody>
	);
}
