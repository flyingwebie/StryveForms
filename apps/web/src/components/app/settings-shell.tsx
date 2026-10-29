import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { cn } from "@StryveForms/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageBody } from "@/components/app/page-header";

export interface SettingsNavItem {
	description: string;
	icon: LucideIcon;
	label: string;
	value: string;
}

export interface SettingsNavGroup {
	items: SettingsNavItem[];
	label: string;
}

/**
 * Two-column settings layout: a 220px grouped nav (icons + labels) on
 * desktop, collapsing to a single dropdown on mobile. Used by both Settings
 * (/dashboard/settings) and Admin (/dashboard/admin) — same shell, different
 * groups. The active item's label + description become the section heading;
 * `title` is kept for API compatibility (and screen readers) but, matching
 * the design, isn't shown as a second, redundant page heading — the
 * breadcrumb above already carries it.
 */
export default function SettingsShell({
	children,
	groups,
	onValueChange,
	title,
	value,
}: {
	children: ReactNode;
	groups: SettingsNavGroup[];
	onValueChange: (value: string) => void;
	title: string;
	value: string;
}) {
	const allItems = groups.flatMap((group) => group.items);
	const active = allItems.find((item) => item.value === value) ?? allItems[0];

	return (
		<PageBody className="gap-6">
			<h1 className="sr-only">{title}</h1>

			<div className="md:hidden">
				<Select
					items={allItems.map((item) => ({
						label: item.label,
						value: item.value,
					}))}
					onValueChange={(v) => v && onValueChange(v)}
					value={value}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{groups.map((group) => (
							<SelectGroup key={group.label}>
								<SelectLabel>{group.label}</SelectLabel>
								{group.items.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-10 md:flex-row">
				<nav className="hidden w-[220px] shrink-0 space-y-5 md:block">
					{groups.map((group) => (
						<div className="space-y-0.5" key={group.label}>
							<p className="px-2.5 pb-1.5 font-medium text-[11px] text-subtle-foreground uppercase tracking-wide">
								{group.label}
							</p>
							{group.items.map((item) => {
								const Icon = item.icon;
								const isActive = item.value === value;
								return (
									<button
										className={cn(
											"flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
											isActive
												? "bg-primary-soft font-medium text-foreground"
												: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
										)}
										key={item.value}
										onClick={() => onValueChange(item.value)}
										type="button"
									>
										<Icon
											className={cn(
												"size-4 shrink-0",
												isActive && "text-primary"
											)}
										/>
										{item.label}
									</button>
								);
							})}
						</div>
					))}
				</nav>

				<div className="min-w-0 flex-1">
					{active ? (
						<div className="mb-6 space-y-1">
							<h2 className="font-semibold text-base">{active.label}</h2>
							<p className="text-[13px] text-muted-foreground">
								{active.description}
							</p>
						</div>
					) : null}
					{children}
				</div>
			</div>
		</PageBody>
	);
}

/**
 * A labelled group of hairline-separated rows (the "label + helper | control"
 * pattern from the settings layout spec). Pass `title`/`description` for a
 * sub-heading above the rows (e.g. "Danger zone"); omit both for the first,
 * untitled group of a section.
 */
export function SettingsSection({
	children,
	className,
	description,
	title,
}: {
	children: ReactNode;
	className?: string;
	description?: ReactNode;
	title?: ReactNode;
}) {
	return (
		<section className={cn("space-y-4", className)}>
			{title || description ? (
				<div className="space-y-1">
					{title ? <h3 className="font-semibold text-base">{title}</h3> : null}
					{description ? (
						<p className="text-muted-foreground text-sm">{description}</p>
					) : null}
				</div>
			) : null}
			<div className="divide-y divide-border border-border border-t">
				{children}
			</div>
		</section>
	);
}

/**
 * One row inside a `SettingsSection`: a label + helper on the left (capped
 * width, so it wraps instead of squeezing the control) and a control on the
 * right, separated from neighbouring rows by a hairline.
 */
export function SettingsRow({
	align = "center",
	children,
	className,
	description,
	label,
}: {
	align?: "center" | "start";
	children: ReactNode;
	className?: string;
	description?: ReactNode;
	label: ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 py-5 first:pt-0 last:pb-0 sm:flex-row sm:justify-between sm:gap-6",
				align === "start" ? "sm:items-start" : "sm:items-center",
				className
			)}
		>
			<div className="max-w-xs space-y-0.5">
				<p className="font-medium text-[13px]">{label}</p>
				{description ? (
					<p className="text-subtle-foreground text-xs">{description}</p>
				) : null}
			</div>
			<div className="w-full sm:w-auto sm:min-w-72 sm:shrink-0">{children}</div>
		</div>
	);
}

/** The sticky Discard/Save bar shown at the bottom of a section with unsaved changes. */
export function SettingsFooter({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"sticky bottom-0 flex items-center justify-end gap-2 border-border border-t bg-background py-4",
				className
			)}
		>
			{children}
		</div>
	);
}
