import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, GitBranchIcon } from "lucide-react";

import { SettingsRow, SettingsSection } from "@/components/app/settings-shell";
import { useTRPC } from "@/utils/trpc";

import { APP_VERSION } from "../app-version";

export default function AboutSettingsTab() {
	const trpc = useTRPC();
	const health = useQuery(trpc.healthCheck.queryOptions());

	return (
		<div className="space-y-6">
			<div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-subtle py-10">
				<img
					alt=""
					className="size-10 rounded-xl"
					height={40}
					src="/brand/stryveforms-mark.svg"
					width={40}
				/>
				<p className="font-semibold">StryveForms</p>
				<p className="font-mono text-subtle-foreground text-xs">
					v{APP_VERSION}
				</p>
				<p className="flex items-center gap-1.5 text-xs">
					<span
						className={`size-1.5 rounded-full ${health.data ? "bg-success" : "bg-destructive"}`}
					/>
					<span className={health.data ? "text-success" : "text-destructive"}>
						{health.data ? "API connected" : "API unreachable"}
					</span>
				</p>
			</div>

			<SettingsSection>
				<SettingsRow
					description="Licensed under the GNU AGPL-3.0. StryveForms is free, open-source software."
					label="License"
				>
					<a
						className="flex items-center justify-end gap-1.5 text-sm hover:underline sm:justify-start"
						href="https://www.gnu.org/licenses/agpl-3.0.html"
						rel="noopener"
						target="_blank"
					>
						<ExternalLinkIcon className="size-3.5" /> View license
					</a>
				</SettingsRow>
				<SettingsRow
					description="Contribute, report issues, or self-host your own instance."
					label="Source code"
				>
					<a
						className="flex items-center justify-end gap-1.5 font-mono text-sm hover:underline sm:justify-start"
						href="https://github.com/flyingwebie/stryveforms"
						rel="noopener"
						target="_blank"
					>
						<GitBranchIcon className="size-3.5" />
						github.com/flyingwebie/stryveforms
					</a>
				</SettingsRow>
			</SettingsSection>
		</div>
	);
}
