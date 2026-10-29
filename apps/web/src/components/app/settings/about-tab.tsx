import { useQuery } from "@tanstack/react-query";
import { CodeIcon, ScaleIcon } from "lucide-react";

import { useTRPC } from "@/utils/trpc";

import { APP_VERSION } from "../app-version";

export default function AboutSettingsTab() {
	const trpc = useTRPC();
	const health = useQuery(trpc.healthCheck.queryOptions());

	return (
		<div className="max-w-lg space-y-6">
			<div className="flex items-center gap-2">
				<img
					alt=""
					className="size-8"
					height={32}
					src="/brand/stryveforms-mark.svg"
					width={32}
				/>
				<div>
					<p className="font-medium text-sm">
						StryveForms{" "}
						<span className="font-normal text-muted-foreground">
							v{APP_VERSION}
						</span>
					</p>
					<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<span
							className={`size-1.5 rounded-full ${health.data ? "bg-green-500" : "bg-red-500"}`}
						/>
						{health.data ? "API connected" : "API unreachable"}
					</p>
				</div>
			</div>

			<div className="flex items-start gap-2 text-sm">
				<ScaleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
				<p className="text-muted-foreground">
					StryveForms is open source under the{" "}
					<a
						className="underline"
						href="https://www.gnu.org/licenses/agpl-3.0.html"
						rel="noopener"
						target="_blank"
					>
						AGPL-3.0 license
					</a>
					. A rebuild of OpnForm, independently developed.
				</p>
			</div>

			<a
				className="flex items-center gap-2 text-sm underline"
				href="https://github.com"
				rel="noopener"
				target="_blank"
			>
				<CodeIcon className="size-4" /> Source on GitHub
			</a>
		</div>
	);
}
