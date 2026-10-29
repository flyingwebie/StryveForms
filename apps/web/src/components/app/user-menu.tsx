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
import { LogOutIcon, SettingsIcon } from "lucide-react";

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
			<DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left outline-none hover:bg-sidebar-accent">
				<Avatar className="size-7 rounded-full">
					<AvatarImage src={session.user.image ?? undefined} />
					<AvatarFallback className="rounded-full text-xs">
						{initials(session.user.name)}
					</AvatarFallback>
				</Avatar>
				<span className="min-w-0 flex-1 truncate text-xs group-data-[collapsible=icon]:hidden">
					{session.user.name}
				</span>
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
