import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import {
	ArrowRightIcon,
	CheckIcon,
	FileTextIcon,
	GlobeIcon,
	InboxIcon,
	InfoIcon,
	UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { plural } from "../import/format";
import type { WorkspaceImportSummary } from "./contract";

function Stat({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-left">
			<div className="flex items-center justify-between text-muted-foreground text-xs">
				{label}
				<span className="[&_svg]:size-4">{icon}</span>
			</div>
			<div className="font-semibold text-2xl tabular-nums tracking-tight">
				{value}
			</div>
		</div>
	);
}

/**
 * Final step: what actually happened, and a direct way into the new
 * workspace. Shown once the import job completes.
 */
export default function ImportSummaryStep({
	onOpenWorkspace,
	onStartAnother,
	summary,
}: {
	onOpenWorkspace: () => void;
	onStartAnother: () => void;
	summary: WorkspaceImportSummary;
}) {
	return (
		<div className="mx-auto max-w-lg space-y-8 py-6 text-center">
			<div className="space-y-4">
				<span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-success-soft text-success">
					<CheckIcon className="size-6" />
				</span>
				<div className="space-y-2">
					<h2 className="font-display font-normal text-4xl">
						{summary.workspaceName
							? `"${summary.workspaceName}" is ready.`
							: "Your new workspace is ready."}
					</h2>
					<p className="text-muted-foreground text-sm">
						{plural(summary.forms, "form")},{" "}
						{plural(summary.submissions, "submission")} and{" "}
						{plural(summary.membersAdded, "member")} were restored into a new
						workspace.
					</p>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-3">
				<Stat icon={<FileTextIcon />} label="Forms" value={summary.forms} />
				<Stat
					icon={<InboxIcon />}
					label="Submissions"
					value={summary.submissions}
				/>
				<Stat
					icon={<UsersIcon />}
					label="Members"
					value={summary.membersAdded}
				/>
			</div>

			{summary.slugChanges.length > 0 ? (
				<div className="space-y-2 text-left">
					<h3 className="font-medium text-sm">Links that changed</h3>
					<div className="overflow-hidden rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead>Old link</TableHead>
									<TableHead />
									<TableHead>New link</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{summary.slugChanges.map((change) => (
									<TableRow key={change.from}>
										<TableCell className="font-mono text-muted-foreground text-xs">
											/{change.from}
										</TableCell>
										<TableCell className="w-6 px-0 text-muted-foreground">
											<ArrowRightIcon className="size-3.5" />
										</TableCell>
										<TableCell className="font-mono text-xs">
											/{change.to}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			) : null}

			{summary.customDomains.length > 0 ? (
				<div className="flex items-start gap-2.5 rounded-xl border border-dashed p-3 text-left text-sm">
					<GlobeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div>
						<p className="font-medium">
							{plural(summary.customDomains.length, "custom domain")} to set up
							again
						</p>
						<p className="text-muted-foreground text-xs">
							{summary.customDomains.join(", ")} won't be carried over — you'll
							need to point them at the new workspace yourself.
						</p>
					</div>
					<Badge className="ml-auto" variant="outline">
						After import
					</Badge>
				</div>
			) : null}

			{summary.reconnectCount > 0 ? (
				<div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3 text-left text-sm">
					<InfoIcon className="mt-0.5 size-4 shrink-0 text-warning" />
					<div>
						<p className="font-medium text-warning">
							{plural(summary.reconnectCount, "integration")} need
							{summary.reconnectCount === 1 ? "s" : ""} reconnecting
						</p>
						<p className="text-muted-foreground text-xs">
							Their secrets weren't in the file, so they were added switched
							off. Open each form's Integrations tab, re-enter the key or token,
							and switch them back on.
						</p>
					</div>
				</div>
			) : null}

			<div className="flex items-center justify-center gap-3">
				<Button onClick={onStartAnother} variant="outline">
					Start another import
				</Button>
				<Button onClick={onOpenWorkspace}>
					Go to forms
					<ArrowRightIcon />
				</Button>
			</div>
		</div>
	);
}
