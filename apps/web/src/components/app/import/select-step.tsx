import { Button } from "@StryveForms/ui/components/button";
import { Switch } from "@StryveForms/ui/components/switch";
import { useQuery } from "@tanstack/react-query";

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
					Open a workspace to pick its forms and where they should land.
				</p>
			</div>

			<div className="space-y-3">
				{connection.workspaces.map((workspace) => (
					<WorkspaceSelector
						connectionId={connection.connectionId}
						key={workspace.id}
						onChange={(selection) =>
							setSelections({ ...selections, [workspace.id]: selection })
						}
						ownWorkspaces={ownWorkspaces}
						selection={
							selections[workspace.id] ?? {
								formIds: [],
								targetWorkspaceId: "new",
							}
						}
						sourceWorkspace={workspace}
					/>
				))}
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				{OPTION_FIELDS.map(({ description, key, label }) => {
					const disabled = key === "files" && !options.submissions;
					return (
						<label
							className="flex items-start justify-between gap-4 rounded-xl border p-3 has-disabled:opacity-60"
							htmlFor={`import-option-${key}`}
							key={key}
						>
							<span>
								<span className="font-medium text-sm">{label}</span>
								<span className="block text-muted-foreground text-xs">
									{description}
								</span>
							</span>
							<Switch
								checked={options[key] && !disabled}
								disabled={disabled}
								id={`import-option-${key}`}
								onCheckedChange={(checked) =>
									setOptions({ ...options, [key]: checked })
								}
							/>
						</label>
					);
				})}
			</div>

			<div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t bg-background/90 px-1 py-4 backdrop-blur">
				<Button onClick={onBack} variant="outline">
					Back
				</Button>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{plural(formCount, "form")} selected
					</span>
					<Button disabled={formCount === 0 || reviewing} onClick={onReview}>
						{reviewing ? "Analysing forms…" : "Review import"}
					</Button>
				</div>
			</div>
		</div>
	);
}
