import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@StryveForms/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { EllipsisIcon, LogOutIcon, SettingsIcon } from "lucide-react";

import { authClient } from "@/lib/auth-client";

function initials(name: string) {
	return name
		.split(" ")
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="size-8 rounded-lg" />;
	}

	if (!session) {
		return (
			<Link className="text-xs underline" to="/login">
				Sign in
			</Link>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:p-0.5">
				<Avatar className="size-7 rounded-full">
					<AvatarImage src={session.user.image ?? undefined} />
					<AvatarFallback className="rounded-full bg-primary-soft font-semibold text-[11px] text-primary-soft-foreground">
						{initials(session.user.name)}
					</AvatarFallback>
				</Avatar>
				<span className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
					<span className="truncate font-medium text-[13px]">
						{session.user.name}
					</span>
					<span className="truncate text-muted-foreground text-xs">
						{session.user.email}
					</span>
				</span>
				<EllipsisIcon className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="truncate font-normal text-muted-foreground">
						{session.user.email}
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					render={<Link search={{ tab: "account" }} to="/dashboard/settings" />}
				>
					<SettingsIcon /> Account settings
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={() => {
						authClient.signOut({
							fetchOptions: {
								onSuccess: () => navigate({ to: "/" }),
							},
						});
					}}
					variant="destructive"
				>
					<LogOutIcon /> Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
