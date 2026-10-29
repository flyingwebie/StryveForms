import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
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
	CalendarIcon,
	FileArchiveIcon,
	FileTextIcon,
	GlobeIcon,
	InboxIcon,
	InfoIcon,
	LayoutGridIcon,
	LockIcon,
	PaperclipIcon,
	TagIcon,
	UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { formatBytes, plural } from "../import/format";
import type { WorkspaceArchiveOverview } from "./contract";

function Row({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
			<span className="flex items-center gap-2.5 text-muted-foreground">
				<span className="[&_svg]:size-4">{icon}</span>
				{label}
			</span>
			<span className="font-medium tabular-nums">{value}</span>
		</div>
	);
}

/**
 * Step 2 of the "StryveForms file" import: a read-only summary of what's
 * inside the archive, in the same style as the OpnForm/JotForm review step —
 * counts, size, where it came from, and anything that needs attention.
 */
export default function ArchiveOverviewStep({
	onBack,
	onContinue,
	overview,
}: {
	onBack: () => void;
	onContinue: () => void;
	overview: WorkspaceArchiveOverview;
}) {
	const { counts } = overview;

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg">What's inside this backup</h2>
				<p className="text-muted-foreground text-sm">
					Review the contents before importing — nothing changes yet.
				</p>
			</div>

			<div className="flex items-center gap-3 rounded-xl border bg-subtle px-4 py-3">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
					<FileArchiveIcon className="size-4" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-sm">
						{overview.manifest.source.instanceName}
					</p>
					<p className="text-muted-foreground text-xs">
						{formatBytes(overview.sizeBytes)}
					</p>
				</div>
			</div>

			<div className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
				<Row
					icon={<LayoutGridIcon />}
					label="Workspace"
					value={overview.manifest.workspaces[0]?.name ?? "—"}
				/>
				<Row
					icon={<FileTextIcon />}
					label="Forms"
					value={counts.forms.toLocaleString()}
				/>
				<Row
					icon={<InboxIcon />}
					label="Submissions"
					value={counts.submissions.toLocaleString()}
				/>
				<Row
					icon={<PaperclipIcon />}
					label="Files"
					value={counts.files.toLocaleString()}
				/>
				<Row
					icon={<UsersIcon />}
					label="Members"
					value={overview.members.length}
				/>
				<Row
					icon={<CalendarIcon />}
					label="Exported"
					value={new Date(overview.manifest.createdAt).toLocaleDateString(
						undefined,
						{ day: "numeric", month: "short", year: "numeric" }
					)}
				/>
				<Row
					icon={<TagIcon />}
					label="StryveForms version"
					value={overview.manifest.appVersion}
				/>
			</div>

			{overview.includesSecrets ? (
				<div className="flex items-start gap-2.5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm">
					<LockIcon className="mt-0.5 size-4 shrink-0 text-info" />
					<div>
						<p className="font-medium text-info">
							This export includes encrypted secrets
						</p>
						<p className="text-muted-foreground text-xs">
							API keys and integration credentials are encrypted. You'll need
							the passphrase to restore them.
						</p>
					</div>
				</div>
			) : null}

			{overview.warnings.length > 0 ? (
				<Alert>
					<InfoIcon />
					<AlertTitle>Good to know</AlertTitle>
					<AlertDescription>
						<ul className="list-disc space-y-1 pl-4">
							{overview.warnings.map((warning) => (
								<li key={warning}>{warning}</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			) : null}

			{overview.slugChanges.length > 0 ? (
				<div className="space-y-2">
					<h3 className="font-medium text-sm">Links that will change</h3>
					<p className="text-muted-foreground text-xs">
						These links are already taken on this instance, so a short random
						suffix is added (example below). You'll see the final links when the
						import finishes.
					</p>
					<div className="overflow-hidden rounded-xl border">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/40">
									<TableHead>Current link</TableHead>
									<TableHead />
									<TableHead>New link</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{overview.slugChanges.map((change) => (
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

			{overview.customDomains.length > 0 ? (
				<div className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm">
					<GlobeIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<div>
						<p className="font-medium">
							{plural(overview.customDomains.length, "custom domain")} to set up
							again
						</p>
						<p className="text-muted-foreground text-xs">
							{overview.customDomains.join(", ")} won't be carried over — you'll
							need to point them at the new workspace yourself.
						</p>
					</div>
					<Badge className="ml-auto" variant="outline">
						After import
					</Badge>
				</div>
			) : null}

			<div className="flex justify-between">
				<Button onClick={onBack} variant="outline">
					Back
				</Button>
				<Button onClick={onContinue}>Continue</Button>
			</div>
		</div>
	);
}
