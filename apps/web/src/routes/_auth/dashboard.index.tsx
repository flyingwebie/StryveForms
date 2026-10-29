import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@StryveForms/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	FileTextIcon,
	LayoutGridIcon,
	LayoutTemplateIcon,
	SearchIcon,
	TableIcon,
	TagIcon,
	UploadCloudIcon,
	XIcon,
} from "lucide-react";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { NO_FOLDER } from "@/components/app/folders/folder-constants";
import BulkActionBar from "@/components/app/forms/bulk-action-bar";
import FormCard, {
	type FormCardSummary,
} from "@/components/app/forms/form-card";
import FormMenu from "@/components/app/forms/form-menu";
import { formatRelativeTime } from "@/components/app/forms/format";
import { useBulkSelection } from "@/components/app/forms/use-bulk-selection";
import NewFormDialog from "@/components/app/new-form-dialog";
import PageHeader, { PageBody } from "@/components/app/page-header";
import StatusBadge from "@/components/app/status-badge";
import { useWorkspaces } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

const SKELETON_IDS = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6"];
const VIEW_STORAGE_KEY = "stryveforms.formsView";

type StatusFilter = "all" | "public" | "draft" | "closed";
type SortKey = "created" | "submissions" | "title" | "updated";
type ViewMode = "grid" | "table";

function statusKey(form: FormCardSummary): StatusFilter {
	if (form.isClosed) {
		return "closed";
	}
	return form.visibility === "draft" ? "draft" : "public";
}

function sortForms(forms: FormCardSummary[], sortBy: SortKey) {
	const sorted = [...forms];
	sorted.sort((a, b) => {
		if (sortBy === "title") {
			return a.title.localeCompare(b.title);
		}
		if (sortBy === "created") {
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		}
		if (sortBy === "submissions") {
			return b.submissionsCount - a.submissionsCount;
		}
		return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
	});
	return sorted;
}

function readStoredView(): ViewMode {
	if (typeof window === "undefined") {
		return "grid";
	}
	return window.localStorage.getItem(VIEW_STORAGE_KEY) === "table"
		? "table"
		: "grid";
}

export const Route = createFileRoute("/_auth/dashboard/")({
	component: RouteComponent,
	validateSearch: z.object({
		/** Filters the list to one sidebar folder; `"none"` = unfiled forms. */
		folder: z.string().optional(),
	}),
});

function FormsTable({
	allSelected,
	folders,
	forms,
	onToggleAll,
	onToggleSelect,
	selectedIds,
	workspaceId,
	workspaces,
}: {
	allSelected: boolean;
	folders: {
		color: string | null;
		icon: string | null;
		id: string;
		name: string;
	}[];
	forms: FormCardSummary[];
	onToggleAll: () => void;
	onToggleSelect: (
		form: FormCardSummary,
		index: number,
		event: MouseEvent
	) => void;
	selectedIds: Set<string>;
	workspaceId: string;
	workspaces: { id: string; name: string }[];
}) {
	const foldersById = new Map(folders.map((f) => [f.id, f]));
	return (
		<div className="overflow-x-auto rounded-xl border border-border">
			<Table>
				<TableHeader className="sticky top-0 z-10 bg-background">
					<TableRow>
						<TableHead className="w-10">
							<Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
						</TableHead>
						<TableHead>Title</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Folder</TableHead>
						<TableHead className="text-right">Submissions</TableHead>
						<TableHead className="text-right">Views</TableHead>
						<TableHead>Updated</TableHead>
						<TableHead className="w-10" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{forms.map((form, index) => {
						const folder = form.folderId
							? foldersById.get(form.folderId)
							: undefined;
						return (
							<TableRow data-selected={selectedIds.has(form.id)} key={form.id}>
								<TableCell>
									<Checkbox
										checked={selectedIds.has(form.id)}
										onClick={(event) =>
											onToggleSelect(
												form,
												index,
												event as unknown as MouseEvent
											)
										}
									/>
								</TableCell>
								<TableCell className="max-w-64">
									<Link
										className="truncate font-medium hover:underline"
										params={{ formId: form.id }}
										to="/dashboard/forms/$formId"
									>
										{form.title}
									</Link>
								</TableCell>
								<TableCell>
									<StatusBadge
										isClosed={form.isClosed}
										visibility={form.visibility}
									/>
								</TableCell>
								<TableCell className="text-muted-foreground">
									{folder?.name ?? "No folder"}
								</TableCell>
								<TableCell className="text-right">
									{form.submissionsCount}
								</TableCell>
								<TableCell className="text-right">{form.viewsCount}</TableCell>
								<TableCell className="text-subtle-foreground">
									{formatRelativeTime(form.updatedAt)}
								</TableCell>
								<TableCell>
									<FormMenu
										form={form}
										workspaceId={workspaceId}
										workspaces={workspaces}
									/>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

function FormsToolbar({
	allSelected,
	hasForms,
	onSearchChange,
	onSortChange,
	onStatusChange,
	onTagChange,
	onToggleAll,
	onViewChange,
	search,
	sortBy,
	status,
	tag,
	tags,
	view,
}: {
	allSelected: boolean;
	hasForms: boolean;
	onSearchChange: (value: string) => void;
	onSortChange: (value: SortKey) => void;
	onStatusChange: (value: StatusFilter) => void;
	onTagChange: (value: string) => void;
	onToggleAll: () => void;
	onViewChange: (value: ViewMode) => void;
	search: string;
	sortBy: SortKey;
	status: StatusFilter;
	tag: string;
	tags: string[];
	view: ViewMode;
}) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="relative w-full sm:w-auto sm:max-w-sm sm:flex-1">
				<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
				<Input
					className="pl-8"
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder="Search forms…"
					value={search}
				/>
			</div>
			<Tabs
				onValueChange={(value) => onStatusChange(value as StatusFilter)}
				value={status}
			>
				<TabsList>
					<TabsTrigger value="all">All</TabsTrigger>
					<TabsTrigger value="public">Live</TabsTrigger>
					<TabsTrigger value="draft">Draft</TabsTrigger>
					<TabsTrigger value="closed">Closed</TabsTrigger>
				</TabsList>
			</Tabs>
			<Select
				items={[
					{ label: "Tags", value: "all" },
					...tags.map((t) => ({ label: t, value: t })),
				]}
				onValueChange={(value) => onTagChange(value ?? "all")}
				value={tag}
			>
				<SelectTrigger>
					<TagIcon className="size-4 text-muted-foreground" />
					<SelectValue placeholder="Tags" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">Tags</SelectItem>
					{tags.map((t) => (
						<SelectItem key={t} value={t}>
							{t}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select
				items={[
					{ label: "Last updated", value: "updated" },
					{ label: "Date created", value: "created" },
					{ label: "Title", value: "title" },
					{ label: "Submissions", value: "submissions" },
				]}
				onValueChange={(value) => onSortChange(value as SortKey)}
				value={sortBy}
			>
				<SelectTrigger className="w-40">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="updated">Last updated</SelectItem>
					<SelectItem value="created">Date created</SelectItem>
					<SelectItem value="title">Title</SelectItem>
					<SelectItem value="submissions">Submissions</SelectItem>
				</SelectContent>
			</Select>

			{hasForms ? (
				<Button
					className="text-muted-foreground"
					onClick={onToggleAll}
					size="sm"
					variant="ghost"
				>
					{allSelected ? "Deselect all" : "Select all"}
				</Button>
			) : null}

			<div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5">
				<Button
					aria-label="Grid view"
					onClick={() => onViewChange("grid")}
					size="icon-sm"
					variant={view === "grid" ? "secondary" : "ghost"}
				>
					<LayoutGridIcon />
				</Button>
				<Button
					aria-label="Table view"
					onClick={() => onViewChange("table")}
					size="icon-sm"
					variant={view === "table" ? "secondary" : "ghost"}
				>
					<TableIcon />
				</Button>
			</div>
		</div>
	);
}

function FormsListContent({
	allSelected,
	forms,
	allFormsCount,
	folders,
	isLoading,
	onCreateForm,
	onToggleAll,
	onToggleSelect,
	selectedIds,
	view,
	workspaceId,
	workspaces,
}: {
	allSelected: boolean;
	allFormsCount: number;
	folders: {
		color: string | null;
		icon: string | null;
		id: string;
		name: string;
	}[];
	forms: FormCardSummary[];
	isLoading: boolean;
	onCreateForm: () => void;
	onToggleAll: () => void;
	onToggleSelect: (
		form: FormCardSummary,
		index: number,
		event: MouseEvent
	) => void;
	selectedIds: Set<string>;
	view: ViewMode;
	workspaceId: string;
	workspaces: { id: string; name: string }[];
}) {
	if (isLoading) {
		return (
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{SKELETON_IDS.map((id) => (
					<Skeleton className="h-44 w-full rounded-xl" key={id} />
				))}
			</div>
		);
	}
	if (allFormsCount === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileTextIcon />
					</EmptyMedia>
					<EmptyTitle className="font-display font-normal text-3xl tracking-normal">
						No forms yet
					</EmptyTitle>
					<EmptyDescription>
						Create your first form from scratch, start with a template, or bring
						your forms over from OpnForm.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent className="flex-row flex-wrap justify-center">
					<Button onClick={onCreateForm}>
						<FileTextIcon /> Create form
					</Button>
					<Button render={<Link to="/dashboard/templates" />} variant="outline">
						<LayoutTemplateIcon /> Start from a template
					</Button>
					<Button
						render={
							<Link search={{ tab: "import" }} to="/dashboard/settings" />
						}
						variant="outline"
					>
						<UploadCloudIcon /> Import forms
					</Button>
				</EmptyContent>
			</Empty>
		);
	}
	if (forms.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchIcon />
					</EmptyMedia>
					<EmptyTitle>No matching forms</EmptyTitle>
					<EmptyDescription>
						Try a different search term or clear the filters.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}
	if (view === "table") {
		return (
			<FormsTable
				allSelected={allSelected}
				folders={folders}
				forms={forms}
				onToggleAll={onToggleAll}
				onToggleSelect={onToggleSelect}
				selectedIds={selectedIds}
				workspaceId={workspaceId}
				workspaces={workspaces}
			/>
		);
	}
	const foldersById = new Map(folders.map((f) => [f.id, f]));
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{forms.map((form, index) => (
				<FormCard
					dragIds={[...selectedIds]}
					folder={form.folderId ? foldersById.get(form.folderId) : null}
					form={form}
					key={form.id}
					onToggleSelect={(event) => onToggleSelect(form, index, event)}
					selected={selectedIds.has(form.id)}
					workspaceId={workspaceId}
					workspaces={workspaces}
				/>
			))}
		</div>
	);
}

function RouteComponent() {
	const trpc = useTRPC();
	const { activeWorkspaceId, workspaces } = useWorkspaces();
	const { folder } = Route.useSearch();
	const navigate = Route.useNavigate();
	const [search, setSearch] = useState("");
	const [tag, setTag] = useState<string>("all");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [sortBy, setSortBy] = useState<SortKey>("updated");
	const [view, setView] = useState<ViewMode>("grid");
	const [newFormOpen, setNewFormOpen] = useState(false);

	useEffect(() => {
		setView(readStoredView());
	}, []);

	const setViewPersisted = (next: ViewMode) => {
		setView(next);
		window.localStorage.setItem(VIEW_STORAGE_KEY, next);
	};

	const tagsQuery = useQuery({
		...trpc.form.tags.queryOptions({ workspaceId: activeWorkspaceId ?? "" }),
		enabled: Boolean(activeWorkspaceId),
	});
	const formsQuery = useQuery({
		...trpc.form.list.queryOptions({
			search: search || undefined,
			tags: tag === "all" ? undefined : [tag],
			folderId: folder,
			workspaceId: activeWorkspaceId ?? "",
		}),
		enabled: Boolean(activeWorkspaceId),
	});
	const foldersQuery = useQuery({
		...trpc.folder.list.queryOptions({
			workspaceId: activeWorkspaceId ?? "",
			kind: "form",
		}),
		enabled: Boolean(activeWorkspaceId),
	});

	const allForms = (formsQuery.data ?? []) as FormCardSummary[];
	const folders = foldersQuery.data ?? [];
	const forms = sortForms(
		allForms.filter((form) => status === "all" || statusKey(form) === status),
		sortBy
	);
	const { allSelected, clear, selectedIds, toggle, toggleAll } =
		useBulkSelection(forms);

	if (!activeWorkspaceId) {
		return (
			<PageBody className="gap-3">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-64 w-full" />
			</PageBody>
		);
	}

	const activeFolder = folders.find((f) => f.id === folder);
	const activeFolderHasChildren =
		activeFolder && folders.some((f) => f.parentId === activeFolder.id);
	const title =
		folder === NO_FOLDER ? "No folder" : (activeFolder?.name ?? "Forms");

	return (
		<PageBody>
			<PageHeader
				actions={
					<>
						{folder ? (
							<Button onClick={() => navigate({ search: {} })} variant="ghost">
								<XIcon /> Clear folder filter
							</Button>
						) : (
							<Button
								render={
									<Link search={{ tab: "import" }} to="/dashboard/settings" />
								}
								variant="outline"
							>
								<UploadCloudIcon /> Import
							</Button>
						)}
						<Button onClick={() => setNewFormOpen(true)}>
							<FileTextIcon /> New form
						</Button>
					</>
				}
				description={
					activeFolderHasChildren
						? `Showing forms in ${activeFolder.name} and its subfolders.`
						: undefined
				}
				eyebrow={`${allForms.length} form${allForms.length === 1 ? "" : "s"}`}
				title={title}
			/>

			<FormsToolbar
				allSelected={allSelected}
				hasForms={forms.length > 0}
				onSearchChange={setSearch}
				onSortChange={setSortBy}
				onStatusChange={setStatus}
				onTagChange={setTag}
				onToggleAll={toggleAll}
				onViewChange={setViewPersisted}
				search={search}
				sortBy={sortBy}
				status={status}
				tag={tag}
				tags={tagsQuery.data ?? []}
				view={view}
			/>

			<FormsListContent
				allFormsCount={allForms.length}
				allSelected={allSelected}
				folders={folders}
				forms={forms}
				isLoading={formsQuery.isLoading}
				onCreateForm={() => setNewFormOpen(true)}
				onToggleAll={toggleAll}
				onToggleSelect={toggle}
				selectedIds={selectedIds}
				view={view}
				workspaceId={activeWorkspaceId}
				workspaces={workspaces}
			/>

			{activeWorkspaceId ? (
				<NewFormDialog
					folderId={folder === NO_FOLDER ? undefined : folder}
					onOpenChange={setNewFormOpen}
					open={newFormOpen}
					workspaceId={activeWorkspaceId}
				/>
			) : null}

			{selectedIds.size > 0 ? (
				<BulkActionBar
					onClear={clear}
					selectedIds={[...selectedIds]}
					workspaceId={activeWorkspaceId}
					workspaces={workspaces}
				/>
			) : null}
		</PageBody>
	);
}
