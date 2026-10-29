import { Checkbox } from "@StryveForms/ui/components/checkbox";
import { Input } from "@StryveForms/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@StryveForms/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import StatusBadge from "@/components/app/status-badge";
import { useTRPC } from "@/utils/trpc";

export interface SourceWorkspace {
	icon: string | null;
	id: number;
	name: string;
}

export interface ImportSelection {
	formIds: number[];
	targetWorkspaceId: string;
}

const STATUS_OPTIONS = [
	{ label: "All statuses", value: "all" },
	{ label: "Live", value: "public" },
	{ label: "Draft", value: "draft" },
	{ label: "Closed", value: "closed" },
];

export default function WorkspaceSelector({
	connectionId,
	multiple,
	onChange,
	ownWorkspaces,
	selection,
	sourceWorkspace,
}: {
	connectionId: string;
	/** Whether more than one source workspace is being imported at once. */
	multiple: boolean;
	onChange: (selection: ImportSelection) => void;
	ownWorkspaces: { id: string; name: string }[];
	selection: ImportSelection;
	sourceWorkspace: SourceWorkspace;
}) {
	const trpc = useTRPC();
	const [expanded, setExpanded] = useState(true);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState("all");

	const formsQuery = useQuery({
		...trpc.importer.opnform.forms.queryOptions({
			connectionId,
			workspaceId: sourceWorkspace.id,
		}),
		enabled: expanded,
	});

	const included = selection.formIds.length > 0;
	const forms = formsQuery.data ?? [];
	const filtered = forms.filter(
		(f) =>
			f.title.toLowerCase().includes(search.toLowerCase()) &&
			(status === "all" || f.visibility === status)
	);
	const allSelected =
		filtered.length > 0 &&
		filtered.every((f) => selection.formIds.includes(f.id));

	const toggleForm = (id: number, checked: boolean) => {
		const next = checked
			? [...new Set([...selection.formIds, id])]
			: selection.formIds.filter((f) => f !== id);
		onChange({ ...selection, formIds: next });
	};

	const toggleAll = (checked: boolean) => {
		const ids = filtered.map((f) => f.id);
		const next = checked
			? [...new Set([...selection.formIds, ...ids])]
			: selection.formIds.filter((f) => !ids.includes(f));
		onChange({ ...selection, formIds: next });
	};

	return (
		<div className="overflow-hidden rounded-xl border bg-card">
			{multiple ? (
				<button
					className="flex w-full items-center justify-between gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50"
					onClick={() => setExpanded((v) => !v)}
					type="button"
				>
					<span className="flex items-center gap-2 font-medium text-sm">
						<span aria-hidden="true" className="text-base">
							{sourceWorkspace.icon ?? "📁"}
						</span>
						{sourceWorkspace.name}
						{included ? (
							<span className="font-normal text-muted-foreground">
								&middot; {selection.formIds.length} selected
							</span>
						) : null}
					</span>
					<ChevronDownIcon
						className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
					/>
				</button>
			) : null}

			{expanded ? (
				<div className="space-y-3 p-4">
					<div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 p-3">
						<Tabs
							onValueChange={(value) =>
								onChange({
									...selection,
									targetWorkspaceId:
										value === "new" ? "new" : (ownWorkspaces[0]?.id ?? ""),
								})
							}
							value={selection.targetWorkspaceId === "new" ? "new" : "existing"}
						>
							<TabsList>
								<TabsTrigger value="existing">Existing workspace</TabsTrigger>
								<TabsTrigger value="new">Create new workspace</TabsTrigger>
							</TabsList>
						</Tabs>
						{selection.targetWorkspaceId === "new" ? null : (
							<Select
								items={ownWorkspaces.map((w) => ({
									label: w.name,
									value: w.id,
								}))}
								onValueChange={(value) =>
									onChange({ ...selection, targetWorkspaceId: value ?? "" })
								}
								value={selection.targetWorkspaceId || undefined}
							>
								<SelectTrigger className="w-56">
									<SelectValue placeholder="Choose a workspace" />
								</SelectTrigger>
								<SelectContent>
									{ownWorkspaces.map((w) => (
										<SelectItem key={w.id} value={w.id}>
											{w.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="relative flex-1">
							<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
							<Input
								className="pl-8"
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search forms…"
								value={search}
							/>
						</div>
						<Select
							items={STATUS_OPTIONS}
							onValueChange={(value) => setStatus(value ?? "all")}
							value={status}
						>
							<SelectTrigger className="w-40">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{STATUS_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* biome-ignore lint/suspicious/noUnnecessaryConditions: isLoading is a runtime query-status flag */}
					{formsQuery.isLoading ? (
						<Skeleton className="h-40 w-full" />
					) : (
						<div className="overflow-hidden rounded-lg border">
							<div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-muted-foreground text-xs uppercase tracking-wide">
								<Checkbox
									checked={allSelected}
									onCheckedChange={(c) => toggleAll(c === true)}
								/>
								<span className="flex-1">Form</span>
								<span>Submissions</span>
								<span className="w-20 text-right">Status</span>
							</div>
							<div className="max-h-72 divide-y overflow-y-auto">
								{filtered.map((form) => (
									<label
										className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40"
										htmlFor={`form-${form.id}`}
										key={form.id}
									>
										<Checkbox
											checked={selection.formIds.includes(form.id)}
											id={`form-${form.id}`}
											onCheckedChange={(c) => toggleForm(form.id, c === true)}
										/>
										<span className="flex-1 truncate">
											{form.title}
											{form.importedFormId ? (
												<span className="ml-2 text-muted-foreground text-xs">
													Already imported
												</span>
											) : null}
										</span>
										<span className="text-muted-foreground tabular-nums">
											{form.submissionsCount.toLocaleString()}
										</span>
										<span className="w-20 text-right">
											<StatusBadge visibility={form.visibility} />
										</span>
									</label>
								))}
								{filtered.length === 0 ? (
									<p className="py-6 text-center text-muted-foreground text-sm">
										No forms found
									</p>
								) : null}
							</div>
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}
