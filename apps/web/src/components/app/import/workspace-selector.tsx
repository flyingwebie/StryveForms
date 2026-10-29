import { Badge } from "@StryveForms/ui/components/badge";
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
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

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

export default function WorkspaceSelector({
	connectionId,
	onChange,
	ownWorkspaces,
	selection,
	sourceWorkspace,
}: {
	connectionId: string;
	onChange: (selection: ImportSelection) => void;
	ownWorkspaces: { id: string; name: string }[];
	selection: ImportSelection;
	sourceWorkspace: SourceWorkspace;
}) {
	const trpc = useTRPC();
	const [expanded, setExpanded] = useState(false);
	const [search, setSearch] = useState("");

	const formsQuery = useQuery({
		...trpc.importer.opnform.forms.queryOptions({
			connectionId,
			workspaceId: sourceWorkspace.id,
		}),
		enabled: expanded,
	});

	const included = selection.formIds.length > 0;
	const forms = formsQuery.data ?? [];
	const filtered = forms.filter((f) =>
		f.title.toLowerCase().includes(search.toLowerCase())
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
			<button
				className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/50"
				onClick={() => setExpanded((v) => !v)}
				type="button"
			>
				<div className="flex items-center gap-2">
					<span className="text-base">{sourceWorkspace.icon ?? "📁"}</span>
					<span className="font-medium text-sm">{sourceWorkspace.name}</span>
					{included ? <Badge>{selection.formIds.length} selected</Badge> : null}
				</div>
				<span className="text-muted-foreground text-xs">
					{expanded ? "Hide forms" : "Show forms"}
				</span>
			</button>

			{expanded ? (
				<div className="space-y-3 border-border border-t p-3">
					<div className="flex flex-wrap items-center gap-2">
						<Label>Import into</Label>
						<Select
							items={[
								{ label: "Create a new workspace", value: "new" },
								...ownWorkspaces.map((w) => ({ label: w.name, value: w.id })),
							]}
							onValueChange={(value) =>
								onChange({ ...selection, targetWorkspaceId: value ?? "new" })
							}
							value={selection.targetWorkspaceId}
						>
							<SelectTrigger className="w-56">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="new">Create a new workspace</SelectItem>
								{ownWorkspaces.map((w) => (
									<SelectItem key={w.id} value={w.id}>
										{w.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="relative">
						<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
						<Input
							className="pl-8"
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search forms…"
							value={search}
						/>
					</div>

					{/* biome-ignore lint/suspicious/noUnnecessaryConditions: isLoading is a runtime query-status flag */}
					{formsQuery.isLoading ? (
						<Skeleton className="h-24 w-full" />
					) : (
						<div className="max-h-64 space-y-1 overflow-y-auto">
							<label
								className="flex cursor-pointer items-center gap-2 border-border border-b px-1 py-1.5 text-xs"
								htmlFor={`select-all-forms-${sourceWorkspace.id}`}
							>
								<Checkbox
									checked={allSelected}
									id={`select-all-forms-${sourceWorkspace.id}`}
									onCheckedChange={(c) => toggleAll(c === true)}
								/>
								Select all ({filtered.length})
							</label>
							{filtered.map((form) => (
								<label
									className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
									htmlFor={`form-${form.id}`}
									key={form.id}
								>
									<span className="flex items-center gap-2">
										<Checkbox
											checked={selection.formIds.includes(form.id)}
											id={`form-${form.id}`}
											onCheckedChange={(c) => toggleForm(form.id, c === true)}
										/>
										{form.title}
									</span>
									<span className="flex items-center gap-2 text-muted-foreground text-xs">
										{form.submissionsCount} submissions
										{form.importedFormId ? (
											<Badge variant="outline">Already imported</Badge>
										) : null}
									</span>
								</label>
							))}
							{filtered.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-sm">
									No forms found
								</p>
							) : null}
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}

function Label({ children }: { children: ReactNode }) {
	return <span className="text-muted-foreground text-xs">{children}</span>;
}
