import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { InboxIcon, SearchIcon } from "lucide-react";
import { useState } from "react";

import { useTRPC } from "@/utils/trpc";

import { plural } from "./format";
import type { JotformConnection } from "./jotform-connect-step";
import { SourceLogo } from "./source-picker";

export interface JotformChoice {
	formIds: string[];
	options: { files: boolean; integrations: boolean; submissions: boolean };
	targetWorkspaceId: string;
}

type Filter = "all" | "enabled" | "disabled" | "new";

const FILTERS: { label: string; value: Filter }[] = [
	{ label: "All forms", value: "all" },
	{ label: "Active", value: "enabled" },
	{ label: "Disabled", value: "disabled" },
	{ label: "Not imported yet", value: "new" },
];

const REGION_LABELS: Record<string, string> = {
	enterprise: "Enterprise",
	eu: "EU",
	hipaa: "HIPAA",
	us: "US",
};

function formatDate(value: string | null): string {
	if (!value) {
		return "—";
	}
	const date = new Date(value.replace(" ", "T"));
	return Number.isNaN(date.getTime())
		? "—"
		: date.toLocaleDateString(undefined, {
				day: "numeric",
				month: "short",
				year: "numeric",
			});
}

function OptionSwitch({
	checked,
	description,
	disabled,
	id,
	label,
	onChange,
}: {
	checked: boolean;
	description: string;
	disabled?: boolean;
	id: string;
	label: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label
			className="flex items-start justify-between gap-4 rounded-xl border p-3 has-disabled:opacity-60"
			htmlFor={id}
		>
			<span>
				<span className="font-medium text-sm">{label}</span>
				<span className="block text-muted-foreground text-xs">
					{description}
				</span>
			</span>
			<Switch
				checked={checked}
				disabled={disabled}
				id={id}
				onCheckedChange={onChange}
			/>
		</label>
	);
}

export default function JotformSelectStep({
	choice,
	connection,
	onBack,
	onChange,
	onReview,
	reviewing,
}: {
	choice: JotformChoice;
	connection: JotformConnection;
	onBack: () => void;
	onChange: (choice: JotformChoice) => void;
	onReview: () => void;
	reviewing: boolean;
}) {
	const trpc = useTRPC();
	const workspaces = useQuery(trpc.workspace.list.queryOptions());
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<Filter>("all");

	const { account, forms } = connection;
	const selected = new Set(choice.formIds);
	const visible = forms.filter((form) => {
		if (!form.title.toLowerCase().includes(search.trim().toLowerCase())) {
			return false;
		}
		if (filter === "enabled") {
			return form.status === "ENABLED";
		}
		if (filter === "disabled") {
			return form.status === "DISABLED";
		}
		if (filter === "new") {
			return !form.importedFormId;
		}
		return true;
	});
	const allVisibleSelected =
		visible.length > 0 && visible.every((f) => selected.has(f.id));
	const someVisibleSelected = visible.some((f) => selected.has(f.id));
	const selectedSubmissions = forms
		.filter((f) => selected.has(f.id))
		.reduce((n, f) => n + f.submissionsCount, 0);

	const setSelected = (ids: Set<string>) =>
		onChange({ ...choice, formIds: [...ids] });
	const toggle = (id: string, on: boolean) => {
		const next = new Set(selected);
		if (on) {
			next.add(id);
		} else {
			next.delete(id);
		}
		setSelected(next);
	};
	const toggleVisible = (on: boolean) => {
		const next = new Set(selected);
		for (const form of visible) {
			if (on) {
				next.add(form.id);
			} else {
				next.delete(form.id);
			}
		}
		setSelected(next);
	};
	const setOption = (key: keyof JotformChoice["options"], value: boolean) =>
		onChange({ ...choice, options: { ...choice.options, [key]: value } });

	const targetItems = [
		{ label: "A new workspace called “JotForm”", value: "new" },
		...(workspaces.data ?? []).map((w) => ({ label: w.name, value: w.id })),
	];

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
				<SourceLogo source="jotform" />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate font-medium">{account.name}</span>
						<Badge variant="outline">
							{REGION_LABELS[account.region] ?? account.region}
						</Badge>
					</div>
					<div className="truncate text-muted-foreground text-sm">
						{account.email} · {plural(forms.length, "form")}
					</div>
				</div>
				{connection.apiCallsLeft === null ? null : (
					<div className="text-right text-sm">
						<div className="font-medium tabular-nums">
							{connection.apiCallsLeft.toLocaleString()}
						</div>
						<div className="text-muted-foreground text-xs">
							API calls left today
						</div>
					</div>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="jotform-target">Import into</Label>
				<Select
					items={targetItems}
					onValueChange={(value) =>
						onChange({ ...choice, targetWorkspaceId: value ?? "new" })
					}
					value={choice.targetWorkspaceId}
				>
					<SelectTrigger className="w-full sm:w-80" id="jotform-target">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{targetItems.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<div className="relative min-w-56 flex-1">
						<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Search forms"
							className="pl-9"
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search forms…"
							value={search}
						/>
					</div>
					<Select
						items={FILTERS}
						onValueChange={(value) =>
							setFilter(value ? (value as Filter) : "all")
						}
						value={filter}
					>
						<SelectTrigger aria-label="Filter forms" className="w-44">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FILTERS.map((f) => (
								<SelectItem key={f.value} value={f.value}>
									{f.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="max-h-[28rem] overflow-auto rounded-xl border">
					<Table>
						<TableHeader className="sticky top-0 z-10 bg-background">
							<TableRow>
								<TableHead className="w-10">
									<Checkbox
										aria-label="Select all shown forms"
										checked={allVisibleSelected}
										indeterminate={someVisibleSelected && !allVisibleSelected}
										onCheckedChange={(checked) =>
											toggleVisible(checked === true)
										}
									/>
								</TableHead>
								<TableHead>Form</TableHead>
								<TableHead className="text-right">Submissions</TableHead>
								<TableHead className="hidden md:table-cell">
									Last submission
								</TableHead>
								<TableHead className="hidden sm:table-cell">Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{visible.map((form) => (
								<TableRow
									className="cursor-pointer"
									data-state={selected.has(form.id) ? "selected" : undefined}
									key={form.id}
									onClick={() => toggle(form.id, !selected.has(form.id))}
								>
									<TableCell onClick={(event) => event.stopPropagation()}>
										<Checkbox
											aria-label={`Select ${form.title}`}
											checked={selected.has(form.id)}
											onCheckedChange={(checked) =>
												toggle(form.id, checked === true)
											}
										/>
									</TableCell>
									<TableCell className="max-w-72">
										<div className="flex items-center gap-2">
											<span className="truncate font-medium">{form.title}</span>
											{form.importedFormId ? (
												<Badge variant="secondary">Imported</Badge>
											) : null}
										</div>
										<div className="text-muted-foreground text-xs">
											Created {formatDate(form.createdAt)}
										</div>
									</TableCell>
									<TableCell className="text-right tabular-nums">
										{form.submissionsCount.toLocaleString()}
									</TableCell>
									<TableCell className="hidden text-muted-foreground md:table-cell">
										{formatDate(form.lastSubmission)}
									</TableCell>
									<TableCell className="hidden sm:table-cell">
										<Badge
											variant={
												form.status === "ENABLED" ? "outline" : "secondary"
											}
										>
											{form.status === "ENABLED" ? "Active" : "Disabled"}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{visible.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground text-sm">
							<InboxIcon className="size-6" />
							No forms match.
						</div>
					) : null}
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-3">
				<OptionSwitch
					checked={choice.options.submissions}
					description="Every response, with its date and IP address"
					id="jotform-opt-submissions"
					label="Submissions"
					onChange={(value) => setOption("submissions", value)}
				/>
				<OptionSwitch
					checked={choice.options.submissions && choice.options.files}
					description="Uploads and signatures, copied to your storage"
					disabled={!choice.options.submissions}
					id="jotform-opt-files"
					label="Uploaded files"
					onChange={(value) => setOption("files", value)}
				/>
				<OptionSwitch
					checked={choice.options.integrations}
					description="Email notifications, autoresponders and webhooks"
					id="jotform-opt-integrations"
					label="Notifications & webhooks"
					onChange={(value) => setOption("integrations", value)}
				/>
			</div>

			<div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t bg-background/90 px-1 py-4 backdrop-blur">
				<Button onClick={onBack} variant="outline">
					Back
				</Button>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{plural(selected.size, "form")} ·{" "}
						{plural(selectedSubmissions, "submission")}
					</span>
					<Button
						disabled={selected.size === 0 || reviewing}
						onClick={onReview}
					>
						{reviewing ? "Analysing forms…" : "Review import"}
					</Button>
				</div>
			</div>
		</div>
	);
}
