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
 * Two-column settings layout: a secondary sidebar (icons + labels, grouped)
 * on desktop, collapsing to a single dropdown on mobile. Used by both
 * Settings (/dashboard/settings) and Admin (/dashboard/admin) — same pattern,
 * different groups. The active item's description becomes the page header.
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
		<div className="space-y-6 p-6">
			<h1 className="font-semibold text-2xl">{title}</h1>

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

			<div className="grid gap-8 md:grid-cols-[14rem_1fr] lg:grid-cols-[16rem_1fr]">
				<nav className="hidden space-y-5 md:block">
					{groups.map((group) => (
						<div className="space-y-1" key={group.label}>
							<p className="px-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
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
												? "bg-muted font-medium text-foreground"
												: "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
										)}
										key={item.value}
										onClick={() => onValueChange(item.value)}
										type="button"
									>
										<Icon className="size-4 shrink-0" />
										{item.label}
									</button>
								);
							})}
						</div>
					))}
				</nav>

				<div className="min-w-0 space-y-6">
					{active ? (
						<div className="space-y-1">
							<h2 className="font-semibold text-lg">{active.label}</h2>
							<p className="text-muted-foreground text-sm">
								{active.description}
							</p>
						</div>
					) : null}
					{children}
				</div>
			</div>
		</div>
	);
}
