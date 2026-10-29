import type { ReactNode } from "react";

/**
 * One "Security" / "Payload shape" / "Advanced" group inside an integration
 * dialog: a small uppercase caption, an optional one-line description, and
 * its fields — always expanded, stacked with a top divider between groups.
 */
export function SettingsSection({
	children,
	description,
	title,
}: {
	children: ReactNode;
	description?: string;
	title: string;
}) {
	return (
		<div className="space-y-3 px-2 py-3">
			<div>
				<p className="font-medium text-subtle-foreground text-xs uppercase tracking-wide">
					{title}
				</p>
				{description ? (
					<p className="text-muted-foreground text-xs">{description}</p>
				) : null}
			</div>
			{children}
		</div>
	);
}
