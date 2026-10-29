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
	FileTextIcon,
	GlobeIcon,
	InboxIcon,
	InfoIcon,
	LockIcon,
	PackageIcon,
	UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { formatBytes, plural } from "../import/format";
import type { WorkspaceArchiveOverview } from "./contract";

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
		<div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
			<div className="flex items-center gap-2 text-muted-foreground text-xs">
				<span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:size-3.5">
					{icon}
				</span>
				{label}
			</div>
			<div className="font-semibold text-2xl tabular-nums tracking-tight">
				{value}
			</div>
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
				<h2 className="font-semibold text-lg">What's in this file</h2>
				<p className="text-muted-foreground text-sm">
					Nothing has been imported yet. This always creates a new workspace
					that you own and manage.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Stat
					icon={<FileTextIcon />}
					label="Forms"
					value={counts.forms.toLocaleString()}
				/>
				<Stat
					icon={<InboxIcon />}
					label="Submissions"
					value={counts.submissions.toLocaleString()}
				/>
				<Stat
					icon={<PackageIcon />}
					label="Files"
					value={counts.files.toLocaleString()}
				/>
				<Stat
					icon={<UsersIcon />}
					label="Members & invites"
					value={overview.members.length}
				/>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1 rounded-xl border bg-card p-4 text-sm">
					<p className="text-muted-foreground text-xs">From</p>
					<p className="font-medium">{overview.manifest.source.instanceName}</p>
					<p className="text-muted-foreground text-xs">
						StryveForms {overview.manifest.appVersion} · exported{" "}
						{new Date(overview.manifest.createdAt).toLocaleDateString()}
					</p>
				</div>
				<div className="space-y-1 rounded-xl border bg-card p-4 text-sm">
					<p className="text-muted-foreground text-xs">Archive size</p>
					<p className="font-medium">{formatBytes(overview.sizeBytes)}</p>
					<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
						{overview.includesSecrets ? (
							<>
								<LockIcon className="size-3" /> Includes encrypted secrets —
								you'll need the passphrase next
							</>
						) : (
							"Secrets weren't included when this was exported"
						)}
					</p>
				</div>
			</div>

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
