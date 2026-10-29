import type { SubmissionDto } from "@StryveForms/api/routers/submission";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import { Button } from "@StryveForms/ui/components/button";
import { Calendar } from "@StryveForms/ui/components/calendar";
import { Input } from "@StryveForms/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@StryveForms/ui/components/popover";
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
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	flexRender,
	getCoreRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import {
	CalendarIcon,
	DownloadIcon,
	SearchIcon,
	SlidersHorizontalIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/app/confirm-dialog";
import BulkDownloadMenu from "@/components/app/pdf/bulk-download-menu";
import {
	defaultColumnOrder,
	reconcileColumnOrder,
} from "@/components/app/submissions/column-order";
import {
	type ColumnOrderItem,
	ColumnOrderMenu,
} from "@/components/app/submissions/column-order-menu";
import {
	SELECT_COLUMN_ID,
	useSubmissionColumns,
} from "@/components/app/submissions/columns";
import { SortableTableHead } from "@/components/app/submissions/sortable-table-head";
import SubmissionModal from "@/components/app/submissions/submission-modal";
import { apiBase } from "@/lib/api-url";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/dashboard/forms/$formId/")({
	component: RouteComponent,
});

type StatusFilter = "all" | "completed" | "partial";
interface SubmissionDateRange {
	from: Date | undefined;
	to?: Date | undefined;
}
const PAGE_SIZES = [10, 25, 50, 100] as const;

function columnStorageKey(formId: string) {
	return `stryveforms.submissionColumns.${formId}`;
}

/** Per-form column order, kept separate from visibility (task: reorder columns). */
function columnOrderStorageKey(formId: string) {
	return `stryveforms.submissionColumnOrder.${formId}`;
}

function formatDate(date: Date) {
	return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function SortableHeader({
	children,
	column,
}: {
	children: ReactNode;
	column: {
		getCanSort: () => boolean;
		getIsSorted: () => false | "asc" | "desc";
		getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
	};
}) {
	if (!column.getCanSort()) {
		return <>{children}</>;
	}
	const sorted = column.getIsSorted();
	return (
		<button
			className="flex items-center gap-1 hover:text-foreground"
			onClick={column.getToggleSortingHandler()}
			type="button"
		>
			{children}
			{sorted === "asc" ? " ↑" : null}
			{sorted === "desc" ? " ↓" : null}
		</button>
	);
}

/**
 * Prev/Next through the submissions table's overall order — across pages,
 * respecting the current filters/search/sort — not just the rows currently
 * loaded on screen. At a page boundary it loads the adjacent page and lands
 * on its first (going forward) or last (going back) row once it arrives.
 */
function useSubmissionNavigation({
	activeSubmissionId,
	items,
	page,
	pageCount,
	perPage,
	setActiveSubmissionId,
	setPage,
	total,
}: {
	activeSubmissionId: string | null;
	items: SubmissionDto[];
	page: number;
	pageCount: number;
	perPage: number;
	setActiveSubmissionId: (id: string | null) => void;
	setPage: (updater: (previous: number) => number) => void;
	total: number;
}) {
	// Set right before changing `page` at a page boundary, so the effect
	// below knows which end of the newly-loaded page to land on.
	const [pendingNav, setPendingNav] = useState<"first" | "last" | null>(null);

	useEffect(() => {
		if (!pendingNav || items.length === 0) {
			return;
		}
		const target = pendingNav === "first" ? items[0] : items.at(-1);
		if (target) {
			setActiveSubmissionId(target.id);
		}
		setPendingNav(null);
	}, [pendingNav, items, setActiveSubmissionId]);

	const indexInPage = items.findIndex((item) => item.id === activeSubmissionId);
	const globalIndex =
		indexInPage === -1 ? null : (page - 1) * perPage + indexInPage;
	const hasPrev = globalIndex !== null && globalIndex > 0;
	const hasNext = globalIndex !== null && globalIndex < total - 1;
	const positionLabel =
		globalIndex === null ? null : `${globalIndex + 1} of ${total}`;

	const goPrev = () => {
		if (indexInPage > 0) {
			setActiveSubmissionId(items[indexInPage - 1].id);
		} else if (page > 1) {
			setPendingNav("last");
			setPage((p) => p - 1);
		}
	};
	const goNext = () => {
		if (indexInPage !== -1 && indexInPage < items.length - 1) {
			setActiveSubmissionId(items[indexInPage + 1].id);
		} else if (page < pageCount) {
			setPendingNav("first");
			setPage((p) => p + 1);
		}
	};

	return { goNext, goPrev, hasNext, hasPrev, positionLabel };
}

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [dateRange, setDateRange] = useState<SubmissionDateRange | undefined>();
	const [page, setPage] = useState(1);
	const [perPage, setPerPage] = useState<number>(25);
	// Single-column server-side sort; defaults to newest first, same as before.
	const [sorting, setSorting] = useState<SortingState>([
		{ desc: true, id: "createdAt" },
	]);
	const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
	const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(
		null
	);
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [columnOrder, setColumnOrderState] = useState<string[]>([]);

	useEffect(() => {
		try {
			const saved = window.localStorage.getItem(columnStorageKey(formId));
			setColumnVisibility(saved ? JSON.parse(saved) : {});
		} catch {
			setColumnVisibility({});
		}
	}, [formId]);

	const activeSort = sorting[0] ?? { desc: true, id: "createdAt" };
	const fromIso = dateRange?.from ? dateRange.from.toISOString() : undefined;
	const toIso = dateRange?.to
		? new Date(
				dateRange.to.getFullYear(),
				dateRange.to.getMonth(),
				dateRange.to.getDate(),
				23,
				59,
				59
			).toISOString()
		: undefined;

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset paging whenever a filter changes
	useEffect(() => {
		setPage(1);
		setRowSelection({});
	}, [
		search,
		status,
		activeSort.id,
		activeSort.desc,
		dateRange,
		perPage,
		formId,
	]);

	const formQuery = useQuery(trpc.form.get.queryOptions({ id: formId }));
	const pdfTemplatesQuery = useQuery(trpc.pdf.list.queryOptions({ formId }));
	const enabledPdfTemplates = (pdfTemplatesQuery.data ?? []).filter(
		(t) => t.enabled
	);
	const submissionsQuery = useQuery(
		trpc.submission.list.queryOptions({
			formId,
			from: fromIso,
			page,
			perPage,
			search: search || undefined,
			sortBy: activeSort.id,
			sortDir: activeSort.desc ? "desc" : "asc",
			status,
			to: toIso,
		})
	);

	const fields: FormField[] = useMemo(() => {
		if (!formQuery.data) {
			return [];
		}
		return answerFields(
			formQuery.data.properties as FormField[],
			formQuery.data.removedProperties as FormField[]
		);
	}, [formQuery.data]);

	const columns = useSubmissionColumns(fields);
	const items = submissionsQuery.data?.items ?? [];

	// Load the saved column order once fields are known, reconciling it
	// against the form's current fields (new ones appended, removed ones dropped).
	useEffect(() => {
		try {
			const saved = window.localStorage.getItem(columnOrderStorageKey(formId));
			const parsed: string[] = saved ? JSON.parse(saved) : [];
			setColumnOrderState(reconcileColumnOrder(parsed, fields));
		} catch {
			setColumnOrderState(defaultColumnOrder(fields));
		}
	}, [formId, fields]);

	const persistColumnOrder = (next: string[]) => {
		setColumnOrderState(next);
		window.localStorage.setItem(
			columnOrderStorageKey(formId),
			JSON.stringify(next)
		);
	};
	const resetColumnOrder = () => {
		window.localStorage.removeItem(columnOrderStorageKey(formId));
		setColumnOrderState(defaultColumnOrder(fields));
	};

	// Dragging a table header reorders columns directly, as an alternative to
	// the Columns popover.
	const headerDragSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	);
	const handleHeaderDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) {
			return;
		}
		const full = [SELECT_COLUMN_ID, ...columnOrder];
		const from = full.indexOf(String(active.id));
		const to = full.indexOf(String(over.id));
		if (from === -1 || to === -1) {
			return;
		}
		persistColumnOrder(
			arrayMove(full, from, to).filter((id) => id !== SELECT_COLUMN_ID)
		);
	};

	const table = useReactTable({
		columns,
		data: items,
		// Sorting is done server-side (submission.list's sortBy/sortDir) across
		// every page, not just the rows currently loaded — so the table must
		// not re-sort them itself.
		enableMultiSort: false,
		enableSortingRemoval: false,
		getCoreRowModel: getCoreRowModel(),
		getRowId: (row) => row.id,
		manualSorting: true,
		onColumnOrderChange: (updater) => {
			const previous = [SELECT_COLUMN_ID, ...columnOrder];
			const next = typeof updater === "function" ? updater(previous) : updater;
			persistColumnOrder(next.filter((id) => id !== SELECT_COLUMN_ID));
		},
		onColumnVisibilityChange: (updater) => {
			setColumnVisibility((previous) => {
				const next =
					typeof updater === "function" ? updater(previous) : updater;
				window.localStorage.setItem(
					columnStorageKey(formId),
					JSON.stringify(next)
				);
				return next;
			});
		},
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		// The checkbox column always stays first — it's not shown in the reorder UI.
		state: {
			columnOrder: [SELECT_COLUMN_ID, ...columnOrder],
			columnVisibility,
			rowSelection,
			sorting,
		},
	});

	/** Hideable, orderable columns for the Columns popover, in the saved order. */
	const columnOrderItems: ColumnOrderItem[] = columnOrder
		.map((id) => table.getColumn(id))
		.filter((column): column is NonNullable<typeof column> => Boolean(column))
		.filter((column) => column.getCanHide())
		.map((column) => ({
			id: column.id,
			label:
				typeof column.columnDef.header === "string"
					? column.columnDef.header
					: column.id,
			visible: column.getIsVisible(),
		}));

	const invalidateSubmissions = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.submission.list.queryKey(),
		});

	const bulkDelete = useMutation(
		trpc.submission.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async (data) => {
				await invalidateSubmissions();
				toast.success(`Deleted ${data.deleted} submission(s)`);
				setRowSelection({});
				setBulkDeleteOpen(false);
			},
		})
	);

	const selectedIds = Object.keys(rowSelection).filter(
		(id) => rowSelection[id]
	);
	const activeSubmission =
		items.find((item) => item.id === activeSubmissionId) ?? null;
	const total = submissionsQuery.data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / perPage));

	// The submission modal's Prev/Next walk the table's overall order
	// (across pages), respecting the current filters/search/sort — not just
	// the rows currently loaded on screen.
	const {
		goNext: goToNextSubmission,
		goPrev: goToPrevSubmission,
		hasNext: hasNextSubmission,
		hasPrev: hasPrevSubmission,
		positionLabel,
	} = useSubmissionNavigation({
		activeSubmissionId,
		items,
		page,
		pageCount,
		perPage,
		setActiveSubmissionId,
		setPage,
		total,
	});

	// The export always matches what's currently on screen: same status,
	// search, date range and sort, and either the selected rows or every
	// matching row, limited to the currently visible columns.
	const exportUrl = (() => {
		const base = apiBase();
		const params = new URLSearchParams();
		if (status !== "all") {
			params.set("status", status);
		}
		if (search) {
			params.set("search", search);
		}
		if (fromIso) {
			params.set("from", fromIso);
		}
		if (toIso) {
			params.set("to", toIso);
		}
		params.set("sortBy", activeSort.id);
		params.set("sortDir", activeSort.desc ? "desc" : "asc");
		if (selectedIds.length > 0) {
			params.set("ids", selectedIds.join(","));
		}
		// getVisibleLeafColumns (not getAllColumns) respects the saved column
		// order, so the export's column order matches what's on screen.
		const visibleFieldColumns = table
			.getVisibleLeafColumns()
			.filter((column) => column.getCanHide())
			.map((column) => column.id);
		if (visibleFieldColumns.length > 0) {
			params.set("columns", visibleFieldColumns.join(","));
		}
		return `${base}/api/forms/${formId}/export.csv${params.size ? `?${params}` : ""}`;
	})();

	const dateRangeLabel = (() => {
		if (!dateRange?.from) {
			return "Date range";
		}
		if (!dateRange.to || dateRange.to.getTime() === dateRange.from.getTime()) {
			return formatDate(dateRange.from);
		}
		return `${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`;
	})();

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative max-w-sm flex-1">
					<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
					<Input
						className="pl-8"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search submissions…"
						value={search}
					/>
				</div>
				<Select
					items={[
						{ label: "All statuses", value: "all" },
						{ label: "Completed", value: "completed" },
						{ label: "Partial", value: "partial" },
					]}
					onValueChange={(value) => setStatus(value as StatusFilter)}
					value={status}
				>
					<SelectTrigger className="w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
						<SelectItem value="partial">Partial</SelectItem>
					</SelectContent>
				</Select>

				<Popover>
					<PopoverTrigger
						render={
							<Button size="sm" variant="outline">
								<CalendarIcon /> {dateRangeLabel}
							</Button>
						}
					/>
					<PopoverContent align="start" className="w-auto p-0">
						<Calendar
							defaultMonth={dateRange?.from}
							mode="range"
							numberOfMonths={2}
							onSelect={setDateRange}
							selected={dateRange}
						/>
						{dateRange?.from ? (
							<div className="flex justify-end border-t p-2">
								<Button
									onClick={() => setDateRange(undefined)}
									size="sm"
									variant="ghost"
								>
									<XIcon /> Clear
								</Button>
							</div>
						) : null}
					</PopoverContent>
				</Popover>

				<Popover>
					<PopoverTrigger render={<Button size="sm" variant="outline" />}>
						<SlidersHorizontalIcon /> Columns
					</PopoverTrigger>
					<PopoverContent align="end" className="w-auto">
						<ColumnOrderMenu
							items={columnOrderItems}
							onReorder={persistColumnOrder}
							onReset={resetColumnOrder}
							onToggleVisibility={(id, visible) =>
								table.getColumn(id)?.toggleVisibility(visible)
							}
						/>
					</PopoverContent>
				</Popover>

				<Button render={<a href={exportUrl} />} size="sm" variant="outline">
					<DownloadIcon /> Export
					{selectedIds.length > 0 ? ` ${selectedIds.length}` : " CSV"}
				</Button>

				<BulkDownloadMenu
					filters={{
						from: fromIso,
						search: search || undefined,
						status,
						to: toIso,
					}}
					selectedIds={selectedIds}
					templates={enabledPdfTemplates}
				/>

				{selectedIds.length > 0 ? (
					<Button
						onClick={() => setBulkDeleteOpen(true)}
						size="sm"
						variant="destructive"
					>
						<Trash2Icon /> Delete {selectedIds.length}
					</Button>
				) : null}
			</div>

			{/* biome-ignore lint/suspicious/noUnnecessaryConditions: isLoading is a runtime query-status flag */}
			{submissionsQuery.isLoading ? (
				<Skeleton className="h-96 w-full" />
			) : (
				<div className="max-h-[70vh] overflow-auto rounded-xl border border-border">
					{/* DndContext adds hidden live-region <div>s, so it must wrap the table, not sit inside it. */}
					<DndContext
						collisionDetection={closestCenter}
						onDragEnd={handleHeaderDragEnd}
						sensors={headerDragSensors}
					>
						<Table>
							<TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_var(--border)]">
								{table.getHeaderGroups().map((headerGroup) => (
									<SortableContext
										items={headerGroup.headers.map((h) => h.column.id)}
										key={headerGroup.id}
										strategy={horizontalListSortingStrategy}
									>
										<TableRow>
											{headerGroup.headers.map((header) => (
												<SortableTableHead
													draggable={header.column.id !== SELECT_COLUMN_ID}
													id={header.column.id}
													key={header.id}
												>
													{header.isPlaceholder ? null : (
														<SortableHeader column={header.column}>
															{flexRender(
																header.column.columnDef.header,
																header.getContext()
															)}
														</SortableHeader>
													)}
												</SortableTableHead>
											))}
										</TableRow>
									</SortableContext>
								))}
							</TableHeader>
							<TableBody>
								{table.getRowModel().rows.length === 0 ? (
									<TableRow>
										<TableCell
											className="py-10 text-center text-muted-foreground"
											colSpan={columns.length}
										>
											No submissions yet
										</TableCell>
									</TableRow>
								) : (
									table.getRowModel().rows.map((row) => (
										<TableRow
											className="cursor-pointer"
											key={row.id}
											onClick={() => setActiveSubmissionId(row.original.id)}
										>
											{row.getVisibleCells().map((cell) => (
												<TableCell
													key={cell.id}
													onClick={(event) => {
														if (cell.column.id === SELECT_COLUMN_ID) {
															event.stopPropagation();
														}
													}}
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext()
													)}
												</TableCell>
											))}
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</DndContext>
				</div>
			)}

			<div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-sm">
				<span>
					{total} {total === 1 ? "submission" : "submissions"}
				</span>
				<div className="flex items-center gap-3">
					<Select
						items={PAGE_SIZES.map((size) => ({
							label: `${size} / page`,
							value: String(size),
						}))}
						onValueChange={(value) => setPerPage(Number(value))}
						value={String(perPage)}
					>
						<SelectTrigger className="w-28">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAGE_SIZES.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size} / page
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						disabled={page <= 1}
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						size="sm"
						variant="outline"
					>
						Previous
					</Button>
					<span>
						Page {page} of {pageCount}
					</span>
					<Button
						disabled={page >= pageCount}
						onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
						size="sm"
						variant="outline"
					>
						Next
					</Button>
				</div>
			</div>

			{formQuery.data ? (
				<SubmissionModal
					fieldOrder={columnOrder}
					form={formQuery.data}
					hasNext={hasNextSubmission}
					hasPrev={hasPrevSubmission}
					onClose={() => setActiveSubmissionId(null)}
					onNext={goToNextSubmission}
					onPrev={goToPrevSubmission}
					positionLabel={positionLabel}
					submission={activeSubmission}
				/>
			) : null}

			<ConfirmDialog
				description="This permanently removes the selected submissions. This can't be undone."
				loading={bulkDelete.isPending}
				onConfirm={() => bulkDelete.mutate({ formId, ids: selectedIds })}
				onOpenChange={setBulkDeleteOpen}
				open={bulkDeleteOpen}
				title={`Delete ${selectedIds.length} submission(s)?`}
			/>
		</div>
	);
}
