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
import { Switch } from "@StryveForms/ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

import type { ArchiveMemberRow, MemberDecision } from "./contract";

const NAME_SPLIT_RE = /[._-]/;

const AVATAR_TINTS = [
	"bg-primary-soft text-primary-soft-foreground",
	"bg-info-soft text-info",
	"bg-success-soft text-success",
	"bg-warning-soft text-warning",
];

function initials(email: string): string {
	const name = email.split("@")[0] ?? email;
	const parts = name.split(NAME_SPLIT_RE).filter(Boolean);
	const letters = parts.length > 1 ? [parts[0], parts[1]] : [name, name];
	return letters
		.map((part) => part?.[0] ?? "")
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

function Avatar({ email, index }: { email: string; index: number }) {
	return (
		<span
			aria-hidden="true"
			className={`flex size-8 shrink-0 items-center justify-center rounded-full font-medium text-xs ${AVATAR_TINTS[index % AVATAR_TINTS.length]}`}
		>
			{initials(email)}
		</span>
	);
}

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
				<h2 className="font-semibold text-lg">Workspace members</h2>
				<p className="text-muted-foreground text-sm">
					Choose a role for each person included in the backup. Nothing is sent
					until you start the import.
				</p>
			</div>

			{needsInvite ? (
				<label
					className="flex items-start justify-between gap-4 rounded-xl border bg-subtle p-4"
					htmlFor="members-send-invites"
				>
					<span>
						<span className="font-medium text-sm">
							Send invite emails to new members
						</span>
						<span className="block text-muted-foreground text-xs">
							People new to this workspace get an email invite once it's ready.
						</span>
					</span>
					<Switch
						checked={sendInvites}
						id="members-send-invites"
						onCheckedChange={setSendInvites}
					/>
				</label>
			) : null}

			<div className="overflow-hidden rounded-xl border">
				<Table>
					<TableHeader>
						<TableRow className="bg-muted/40">
							<TableHead className="w-10" />
							<TableHead>Member</TableHead>
							<TableHead className="text-right">Role</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{session ? (
							<TableRow className="bg-muted/20">
								<TableCell>
									<Checkbox aria-label="You" checked disabled />
								</TableCell>
								<TableCell>
									<div className="flex items-center gap-3">
										<Avatar email={session.user.email} index={0} />
										<div className="min-w-0">
											<div className="flex items-center gap-2 font-medium">
												{session.user.name}
												<Badge variant="outline">You</Badge>
											</div>
											<div className="text-muted-foreground text-xs">
												{session.user.email}
											</div>
										</div>
									</div>
								</TableCell>
								<TableCell className="text-right text-muted-foreground text-sm">
									Admin
								</TableCell>
							</TableRow>
						) : null}
						{members.map((member, index) => (
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
								<TableCell>
									<div className="flex items-center gap-3">
										<Avatar email={member.email} index={index + 1} />
										<div className="min-w-0">
											<div className="flex items-center gap-2 font-medium">
												{member.email.split("@")[0]}
												{member.invited ? (
													<Badge variant="outline">Pending invite</Badge>
												) : null}
												{member.hasAccount ? null : (
													<Badge variant="outline">No account here</Badge>
												)}
											</div>
											<div className="text-muted-foreground text-xs">
												{member.email}
											</div>
										</div>
									</div>
								</TableCell>
								<TableCell className="text-right">
									<Select
										disabled={!checked[member.email]}
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
										<SelectTrigger className="ml-auto w-32" size="sm">
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

			<div className="flex justify-between">
				<Button onClick={onBack} variant="outline">
					← Back
				</Button>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						{selectedCount} of {members.length} selected
					</span>
					<Button disabled={starting} onClick={start}>
						<SparklesIcon />
						{starting ? "Starting…" : "Create workspace"}
					</Button>
				</div>
			</div>
		</div>
	);
}
