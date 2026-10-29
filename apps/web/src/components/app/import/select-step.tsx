import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";

import { useTRPC } from "@/utils/trpc";

import type { OpnformConnection } from "./connect-step";
import { plural } from "./format";
import type { ImportTarget } from "./progress-step";
import WorkspaceSelector, { type ImportSelection } from "./workspace-selector";

export interface ImportOptions {
	files: boolean;
	integrations: boolean;
	keepSlugs: boolean;
	submissions: boolean;
}

const OPTION_FIELDS: {
	description: string;
	key: keyof ImportOptions;
	label: string;
}[] = [
	{
		description: "Every response, including partial ones",
		key: "submissions",
		label: "Submissions",
	},
	{
		description: "Uploads and signatures, copied to your storage",
		key: "files",
		label: "Uploaded files",
	},
	{
		description: "Email, Slack, webhooks, Zapier…",
		key: "integrations",
		label: "Integrations",
	},
	{
		description: "Old /forms/<slug> links keep working",
		key: "keepSlugs",
		label: "Keep form links",
	},
];

export interface OpnformPlan {
	selections: {
		formIds: number[];
		sourceWorkspaceId: number;
		targetWorkspaceId: string;
	}[];
	targets: ImportTarget[];
}

/** Turns the per-workspace choices into the API payload and result targets. */
export function useOpnformPlan(
	connection: OpnformConnection,
	selections: Record<number, ImportSelection>
): OpnformPlan {
	const trpc = useTRPC();
	const workspacesQuery = useQuery(trpc.workspace.list.queryOptions());
	const own = workspacesQuery.data ?? [];
	const entries = Object.entries(selections).filter(
		([, s]) => s.formIds.length > 0
	);
	const rawTargets: ImportTarget[] = entries.map(([sourceId, selection]) => {
		if (selection.targetWorkspaceId === "new") {
			const source = connection.workspaces.find(
				(w) => w.id === Number(sourceId)
			);
			return {
				label: `New workspace (from ${source?.name ?? "import"})`,
				workspaceId: null,
			};
		}
		const target = own.find((w) => w.id === selection.targetWorkspaceId);
		return {
			label: target?.name ?? "Workspace",
			workspaceId: selection.targetWorkspaceId,
		};
	});
	return {
		selections: entries.map(([sourceWorkspaceId, selection]) => ({
			formIds: selection.formIds,
			sourceWorkspaceId: Number(sourceWorkspaceId),
			targetWorkspaceId: selection.targetWorkspaceId,
		})),
		targets: Array.from(
			new Map(rawTargets.map((t) => [t.workspaceId ?? t.label, t])).values()
		),
	};
}

export default function SelectStep({
	connection,
	onBack,
	onReview,
	options,
	reviewing,
	selections,
	setOptions,
	setSelections,
}: {
	connection: OpnformConnection;
	onBack: () => void;
	onReview: () => void;
	options: ImportOptions;
	reviewing: boolean;
	selections: Record<number, ImportSelection>;
	setOptions: (options: ImportOptions) => void;
	setSelections: (selections: Record<number, ImportSelection>) => void;
}) {
	const trpc = useTRPC();
	const workspacesQuery = useQuery(trpc.workspace.list.queryOptions());
	const ownWorkspaces = (workspacesQuery.data ?? []).map((w) => ({
		id: w.id,
		name: w.name,
	}));
	const formCount = Object.values(selections).reduce(
		(n, s) => n + s.formIds.length,
		0
	);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg">Choose what to import</h2>
				<p className="text-muted-foreground text-sm">
					Select the forms you want to bring into{" "}
					{connection.workspaces.length > 1 ? "your workspaces" : "StryveForms"}
					.
				</p>
			</div>

			<div className="space-y-3">
				{connection.workspaces.map((workspace) => (
					<WorkspaceSelector
						connectionId={connection.connectionId}
						key={workspace.id}
						multiple={connection.workspaces.length > 1}
						onChange={(selection) =>
							setSelections({ ...selections, [workspace.id]: selection })
						}
						ownWorkspaces={ownWorkspaces}
						selection={
							selections[workspace.id] ?? {
								formIds: [],
								targetWorkspaceId: ownWorkspaces[0]?.id ?? "new",
							}
						}
						sourceWorkspace={workspace}
					/>
				))}
			</div>

			<div className="space-y-3">
				<h3 className="font-medium text-sm">What to bring</h3>
				<div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
					{OPTION_FIELDS.map(({ description, key, label }) => {
						const disabled = key === "files" && !options.submissions;
						return (
							<label
								className="flex items-start gap-2.5 has-disabled:opacity-60"
								htmlFor={`import-option-${key}`}
								key={key}
							>
								<Checkbox
									checked={options[key] && !disabled}
									className="mt-0.5"
									disabled={disabled}
									id={`import-option-${key}`}
									onCheckedChange={(checked) =>
										setOptions({ ...options, [key]: checked === true })
									}
								/>
								<span>
									<span className="font-medium text-sm">{label}</span>
									<span className="block text-muted-foreground text-xs">
										{description}
									</span>
								</span>
							</label>
						);
					})}
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
				<Button onClick={onBack} variant="outline">
					<ArrowLeftIcon />
					Back
				</Button>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{plural(formCount, "form")} selected
					</span>
					<Button disabled={formCount === 0 || reviewing} onClick={onReview}>
						{reviewing ? "Analysing forms…" : "Continue to review"}
					</Button>
				</div>
			</div>
		</div>
	);
}
