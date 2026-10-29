import { cn } from "@StryveForms/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * Standard page heading for signed-in pages: optional eyebrow (e.g. "28 forms"),
 * title, description and right-aligned actions (one primary button at most).
 */
export default function PageHeader({
	actions,
	className,
	description,
	eyebrow,
	title,
}: {
	actions?: ReactNode;
	className?: string;
	description?: ReactNode;
	eyebrow?: ReactNode;
	title: ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center justify-between gap-x-6 gap-y-3",
				className
			)}
		>
			<div className="flex min-w-0 flex-col gap-1">
				{eyebrow ? (
					<p className="font-medium text-[13px] text-subtle-foreground">
						{eyebrow}
					</p>
				) : null}
				<h1 className="truncate font-semibold text-2xl tracking-tight">
					{title}
				</h1>
				{description ? (
					<p className="text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex shrink-0 items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}

/** Standard padded page body: content area padding [28,32] with 24px rhythm. */
export function PageBody({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-8 md:py-7",
				className
			)}
		>
			{children}
		</div>
	);
}
