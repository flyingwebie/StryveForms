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
	CheckCircle2Icon,
	GlobeIcon,
	InfoIcon,
	UsersIcon,
} from "lucide-react";

import { plural } from "../import/format";
import type { WorkspaceImportSummary } from "./contract";

/**
 * Final step: what actually happened, and a direct way into the new
 * workspace. Shown once the import job completes.
 */
export default function ImportSummaryStep({
	onOpenWorkspace,
	summary,
}: {
	onOpenWorkspace: () => void;
	summary: WorkspaceImportSummary;
}) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2">
				<CheckCircle2Icon className="size-5 text-green-600" />
				<h2 className="font-semibold text-lg">
					{summary.workspaceName
						? `"${summary.workspaceName}" is ready`
						: "Your new workspace is ready"}
				</h2>
			</div>

			{summary.slugChanges.length > 0 ? (
				<div className="space-y-2">
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

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="flex items-start gap-2 rounded-xl border p-3 text-sm">
					<UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div>
						<p className="font-medium">
							{plural(summary.membersAdded, "member")} added
						</p>
						<p className="text-muted-foreground text-xs">
							{plural(summary.invitesCreated, "invite")} created
						</p>
					</div>
				</div>
				<div className="flex items-start gap-2 rounded-xl border p-3 text-sm">
					<GlobeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div>
						<p className="font-medium">
							{summary.customDomains.length === 0
								? "No custom domains"
								: `${plural(summary.customDomains.length, "domain")} to set up`}
						</p>
						{summary.customDomains.length > 0 ? (
							<p className="text-muted-foreground text-xs">
								{summary.customDomains.join(", ")}
							</p>
						) : null}
					</div>
				</div>
			</div>

			{summary.reconnectCount > 0 ? (
				<div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
					<InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
					<div>
						<p className="font-medium">
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

			<Button onClick={onOpenWorkspace}>Open workspace</Button>
		</div>
	);
}
