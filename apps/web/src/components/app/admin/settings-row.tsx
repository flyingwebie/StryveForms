import { Button } from "@StryveForms/ui/components/button";
import type { ReactNode } from "react";

/**
 * One settings row: `label + helper` on the left (fixed width on desktop),
 * `control` on the right, separated by a hairline — the pattern every admin
 * settings section on this tab uses (see design/docs/BRIEF-COMMON.md
 * "Settings layout").
 */
export function SettingsRow({
	children,
	description,
	htmlFor,
	label,
}: {
	children: ReactNode;
	description?: ReactNode;
	htmlFor?: string;
	label: ReactNode;
}) {
	return (
		<div className="grid grid-cols-1 gap-3 border-border border-b py-5 first:pt-0 last:border-b-0 last:pb-0 sm:grid-cols-[280px_1fr] sm:gap-6">
			<div className="space-y-1">
				{htmlFor ? (
					<label className="font-medium text-[13px]" htmlFor={htmlFor}>
						{label}
					</label>
				) : (
					<p className="font-medium text-[13px]">{label}</p>
				)}
				{description ? (
					<p className="text-subtle-foreground text-xs">{description}</p>
				) : null}
			</div>
			<div className="flex min-w-0 flex-col justify-center gap-2">
				{children}
			</div>
		</div>
	);
}

/** A titled group of `SettingsRow`s. */
export function SettingsSection({
	children,
	description,
	title,
}: {
	children: ReactNode;
	description?: ReactNode;
	title: ReactNode;
}) {
	return (
		<section className="space-y-1">
			<div>
				<h3 className="font-semibold text-base">{title}</h3>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			<div>{children}</div>
		</section>
	);
}

/** Discard/Save footer shown when there are unsaved changes. */
export function SettingsFooter({
	dirty,
	leading,
	onDiscard,
	onSave,
	saveDisabled = false,
	saveLabel = "Save changes",
	saving = false,
}: {
	dirty: boolean;
	/** Extra content on the left, e.g. a "Reset to defaults" link. */
	leading?: ReactNode;
	onDiscard: () => void;
	onSave: () => void;
	/** Disables Save beyond the `saving` state, e.g. a required field is empty. */
	saveDisabled?: boolean;
	saveLabel?: string;
	saving?: boolean;
}) {
	if (!dirty) {
		return null;
	}
	const label: string = saving ? "Saving…" : saveLabel;
	return (
		<div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-border border-t bg-background/90 px-1 py-4 backdrop-blur">
			<div>{leading}</div>
			<div className="flex items-center gap-2">
				<Button onClick={onDiscard} type="button" variant="outline">
					Discard
				</Button>
				<Button
					disabled={saving || saveDisabled}
					onClick={onSave}
					type="button"
				>
					{label}
				</Button>
			</div>
		</div>
	);
}
