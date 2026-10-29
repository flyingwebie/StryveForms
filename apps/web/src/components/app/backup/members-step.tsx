import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

import type { ArchiveMemberRow, MemberDecision } from "./contract";

type Role = "admin" | "user" | "readonly";

const ROLE_ITEMS: { label: string; value: Role }[] = [
	{ label: "Admin", value: "admin" },
	{ label: "Member", value: "user" },
	{ label: "Read only", value: "readonly" },
];

/** The archive's `role` is a loosely-typed string from the server; fall back to Member for anything unrecognized. */
function toRole(value: string): Role {
	return value === "admin" || value === "user" || value === "readonly"
		? value
		: "user";
}

/**
 * Step 4 of the "StryveForms file" import: choose which of the source
 * workspace's members and pending invites come along. Nobody is ticked by
 * default — this always creates a new workspace, so bringing people in is
 * opt-in. People who already have an account here are added right away;
 * people who don't become a pending invite, emailed only if "Send invites"
 * is on.
 */
export default function MembersStep({
	members: allMembers,
	onBack,
	onStart,
	starting,
}: {
	members: ArchiveMemberRow[];
	onBack: () => void;
	onStart: (decisions: MemberDecision[], sendInvites: boolean) => void;
	starting: boolean;
}) {
	const { data: session } = authClient.useSession();
	const myEmail = session?.user.email.toLowerCase();
	// You always become admin of the new workspace, so you're not a choice here.
	const members = allMembers.filter((m) => m.email.toLowerCase() !== myEmail);
	const [checked, setChecked] = useState<Record<string, boolean>>({});
	const [roles, setRoles] = useState<Record<string, Role>>(
		Object.fromEntries(members.map((m) => [m.email, toRole(m.role)]))
	);
	const [sendInvites, setSendInvites] = useState(false);

	const selectedCount = Object.values(checked).filter(Boolean).length;
	const needsInvite = members.some((m) => checked[m.email] && !m.hasAccount);

	const start = () => {
		const decisions: MemberDecision[] = members.map((m) => ({
			email: m.email,
			imported: Boolean(checked[m.email]),
			role: roles[m.email] ?? toRole(m.role),
		}));
		onStart(decisions, needsInvite && sendInvites);
	};

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg">Bring people along?</h2>
				<p className="text-muted-foreground text-sm">
					The new workspace starts with just you as admin. Tick anyone else who
					should have access — nothing is sent until you start the import.
				</p>
			</div>

			<div className="overflow-hidden rounded-xl border">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/40">
							<TableHead className="w-10" />
							<TableHead>Email</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Account</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{session ? (
							<TableRow className="bg-muted/20">
								<TableCell>
									<Checkbox aria-label="You" checked disabled />
								</TableCell>
								<TableCell className="font-medium">
									{session.user.email}
									<Badge className="ml-2" variant="outline">
										You
									</Badge>
								</TableCell>
								<TableCell className="text-muted-foreground text-sm">
									Admin
								</TableCell>
								<TableCell className="text-muted-foreground text-xs">
									You always become admin of the new workspace.
								</TableCell>
							</TableRow>
						) : null}
						{members.map((member) => (
							<TableRow key={member.email}>
								<TableCell>
									<Checkbox
										aria-label={`Add ${member.email}`}
										checked={checked[member.email] ?? false}
										onCheckedChange={(value) =>
											setChecked({ ...checked, [member.email]: value === true })
										}
									/>
								</TableCell>
								<TableCell className="font-medium">
									{member.email}
									{member.invited ? (
										<Badge className="ml-2" variant="outline">
											Was a pending invite
										</Badge>
									) : null}
								</TableCell>
								<TableCell>
									<Select
										items={ROLE_ITEMS}
										onValueChange={(value) =>
											value &&
											setRoles({
												...roles,
												[member.email]: value as Role,
											})
										}
										value={roles[member.email] ?? toRole(member.role)}
									>
										<SelectTrigger className="w-32" size="sm">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{ROLE_ITEMS.map((item) => (
												<SelectItem key={item.value} value={item.value}>
													{item.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</TableCell>
								<TableCell>
									<Badge variant={member.hasAccount ? "secondary" : "outline"}>
										{member.hasAccount
											? "Has an account here"
											: "No account here"}
									</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{members.length === 0 ? (
					<p className="p-6 text-center text-muted-foreground text-sm">
						This workspace had no other members or pending invites.
					</p>
				) : null}
			</div>

			{needsInvite ? (
				<label
					className="flex items-start justify-between gap-4 rounded-xl border p-3"
					htmlFor="members-send-invites"
				>
					<span>
						<span className="font-medium text-sm">Send invites</span>
						<span className="block text-muted-foreground text-xs">
							Email people without an account here so they can join. Left off,
							they're added as a pending invite you can send later from Members.
						</span>
					</span>
					<Checkbox
						checked={sendInvites}
						id="members-send-invites"
						onCheckedChange={(value) => setSendInvites(value === true)}
					/>
				</label>
			) : null}

			<div className="flex justify-between">
				<Button onClick={onBack} variant="outline">
					Back
				</Button>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{selectedCount} of {members.length} selected
					</span>
					<Button disabled={starting} onClick={start}>
						{starting ? "Starting…" : "Start import"}
					</Button>
				</div>
			</div>
		</div>
	);
}
