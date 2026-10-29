import { FieldDescription, FieldLabel } from "@StryveForms/ui/components/field";
import { cn } from "@StryveForms/ui/lib/utils";
import type { ReactNode } from "react";

/** A settings section's bold title, with an optional description paragraph below it. */
export function SettingsSection({
	children,
	description,
	title,
}: {
	children?: ReactNode;
	description?: ReactNode;
	title: string;
}) {
	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-1">
				<h2 className="font-semibold text-base">{title}</h2>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			<div className="flex flex-col">{children}</div>
		</div>
	);
}

/**
 * One divided, two-column settings row: a label + description on the left,
 * the control on the right. Rows stack with a hairline divider between them
 * (none above the first, none below the last), matching the design's flat
 * settings-dialog sections (no card chrome).
 */
export function SettingsRow({
	children,
	className,
	description,
	expanded,
	htmlFor,
	label,
}: {
	children: ReactNode;
	className?: string;
	description?: ReactNode;
	/** Extra settings revealed by this row's control (e.g. a switch), shown full width below the row. */
	expanded?: ReactNode;
	htmlFor?: string;
	label?: ReactNode;
}) {
	return (
		<div
			className={cn(
				"grid grid-cols-[minmax(0,220px)_1fr] items-start gap-x-8 gap-y-4 border-border border-b py-5 first:pt-0 last:border-b-0 last:pb-0",
				className
			)}
		>
			{label ? (
				<div className="flex flex-col gap-0.5 pt-2">
					{typeof label === "string" ? (
						<FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
					) : (
						label
					)}
					{description ? (
						<FieldDescription className="text-xs">
							{description}
						</FieldDescription>
					) : null}
				</div>
			) : (
				<div />
			)}
			<div className="flex flex-col gap-2">{children}</div>
			{expanded ? (
				<div className="fade-in slide-in-from-top-1 col-span-2 animate-in rounded-xl border border-border bg-subtle p-4 duration-200">
					{expanded}
				</div>
			) : null}
		</div>
	);
}

/**
 * A row whose control spans the full row width below the label (code
 * editors, the computed-variables list…), instead of sitting in a
 * right-hand column.
 */
export function SettingsFullRow({
	children,
	className,
	description,
	htmlFor,
	label,
}: {
	children: ReactNode;
	className?: string;
	description?: ReactNode;
	htmlFor?: string;
	label?: ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-2 border-border border-b py-5 first:pt-0 last:border-b-0 last:pb-0",
				className
			)}
		>
			{label ? (
				<div className="flex flex-col gap-0.5">
					{typeof label === "string" ? (
						<FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
					) : (
						label
					)}
					{description ? (
						<FieldDescription className="text-xs">
							{description}
						</FieldDescription>
					) : null}
				</div>
			) : null}
			{children}
		</div>
	);
}
