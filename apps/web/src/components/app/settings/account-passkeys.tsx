import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { getAuthenticatorName } from "@better-auth/passkey";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FingerprintIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import { authClient } from "@/lib/auth-client";

interface PasskeyRow {
	aaguid?: string | null;
	createdAt: string | Date;
	deviceType: string;
	id: string;
	name?: string | null;
}

const PASSKEYS_QUERY_KEY = ["account", "passkeys"];

function useListPasskeys() {
	return useQuery({
		queryFn: async () => {
			const { data, error } = await authClient.passkey.listUserPasskeys();
			if (error) {
				throw new Error(error.message || "Couldn't load passkeys");
			}
			return (data ?? []) as PasskeyRow[];
		},
		queryKey: PASSKEYS_QUERY_KEY,
	});
}

/** A passkey's display label: its own name, or the authenticator model, or a generic fallback. */
function passkeyLabel(passkey: PasskeyRow): string {
	return (
		passkey.name?.trim() ||
		getAuthenticatorName(passkey.aaguid ?? undefined) ||
		"Passkey"
	);
}

function deviceTypeLabel(deviceType: string): string {
	return deviceType === "multiDevice"
		? "Synced across your devices"
		: "This device only";
}

/** Names a new passkey, then runs the browser's WebAuthn registration ceremony. */
function AddPasskeyDialog({
	onAdded,
	onOpenChange,
	open,
}: {
	onAdded: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (open) {
			setName("");
		}
	}, [open]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="rounded-xl">
				<DialogHeader>
					<DialogTitle>Add a passkey</DialogTitle>
					<DialogDescription>
						Your browser or device will ask you to confirm with your
						fingerprint, face, PIN, or a security key.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="passkey-name">Name</Label>
					<Input
						id="passkey-name"
						onChange={(event) => setName(event.target.value)}
						placeholder="e.g. My laptop"
						value={name}
					/>
				</div>
				<DialogFooter>
					<Button
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							const { error } = await authClient.passkey.addPasskey({
								name: name.trim() || undefined,
							});
							setBusy(false);
							if (error) {
								toast.error(error.message || "Couldn't add that passkey");
								return;
							}
							onOpenChange(false);
							onAdded();
							toast.success("Passkey added");
						}}
						type="button"
					>
						{busy ? "Waiting for your device…" : "Continue"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Renames an existing passkey. */
function RenamePasskeyDialog({
	onOpenChange,
	onRenamed,
	open,
	passkey,
}: {
	onOpenChange: (open: boolean) => void;
	onRenamed: () => void;
	open: boolean;
	passkey: PasskeyRow | null;
}) {
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (open) {
			setName(passkey ? passkeyLabel(passkey) : "");
		}
	}, [open, passkey]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="rounded-xl">
				<DialogHeader>
					<DialogTitle>Rename passkey</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="passkey-rename">Name</Label>
					<Input
						id="passkey-rename"
						onChange={(event) => setName(event.target.value)}
						value={name}
					/>
				</div>
				<DialogFooter>
					<Button
						disabled={!name.trim() || busy || !passkey}
						onClick={async () => {
							if (!passkey) {
								return;
							}
							setBusy(true);
							const { error } = await authClient.passkey.updatePasskey({
								id: passkey.id,
								name: name.trim(),
							});
							setBusy(false);
							if (error) {
								toast.error(error.message || "Couldn't rename that passkey");
								return;
							}
							onOpenChange(false);
							onRenamed();
						}}
						type="button"
					>
						{busy ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** Settings → Account → Passkeys: list, add, rename, delete. */
export default function AccountPasskeysCard() {
	const passkeys = useListPasskeys();
	const queryClient = useQueryClient();
	const [addOpen, setAddOpen] = useState(false);
	const [renameTarget, setRenameTarget] = useState<PasskeyRow | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<PasskeyRow | null>(null);
	const [deleting, setDeleting] = useState(false);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: PASSKEYS_QUERY_KEY });

	return (
		<Card className="rounded-xl">
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div>
					<CardTitle className="flex items-center gap-2">
						<FingerprintIcon className="size-4" />
						Passkeys
					</CardTitle>
					<CardDescription>
						A passkey lets you sign in with your fingerprint, face, or device
						PIN instead of typing a password — it's tied to this device (or
						synced ones) and can't be phished or guessed.
					</CardDescription>
				</div>
				<Button onClick={() => setAddOpen(true)} size="sm" type="button">
					Add a passkey
				</Button>
			</CardHeader>
			<CardContent>
				{passkeys.data && passkeys.data.length > 0 ? (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Added</TableHead>
								<TableHead className="w-20" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{passkeys.data.map((passkey) => (
								<TableRow key={passkey.id}>
									<TableCell className="font-medium">
										{passkeyLabel(passkey)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{deviceTypeLabel(passkey.deviceType)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{new Date(passkey.createdAt).toLocaleDateString()}
									</TableCell>
									<TableCell className="flex justify-end gap-1">
										<Button
											onClick={() => setRenameTarget(passkey)}
											size="icon-sm"
											variant="ghost"
										>
											<PencilIcon />
										</Button>
										<Button
											onClick={() => setDeleteTarget(passkey)}
											size="icon-sm"
											variant="ghost"
										>
											<TrashIcon className="text-destructive" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				) : (
					<p className="text-muted-foreground text-sm">
						No passkeys yet. Add one to sign in without typing your password.
					</p>
				)}
			</CardContent>

			<AddPasskeyDialog
				onAdded={invalidate}
				onOpenChange={setAddOpen}
				open={addOpen}
			/>
			<RenamePasskeyDialog
				onOpenChange={(open) => !open && setRenameTarget(null)}
				onRenamed={invalidate}
				open={renameTarget !== null}
				passkey={renameTarget}
			/>
			<ConfirmDialog
				description={`You won't be able to sign in with "${deleteTarget ? passkeyLabel(deleteTarget) : "this passkey"}" anymore. Your password (and other passkeys) still work.`}
				loading={deleting}
				onConfirm={async () => {
					if (!deleteTarget) {
						return;
					}
					setDeleting(true);
					const { error } = await authClient.passkey.deletePasskey({
						id: deleteTarget.id,
					});
					setDeleting(false);
					if (error) {
						toast.error(error.message || "Couldn't delete that passkey");
						return;
					}
					setDeleteTarget(null);
					invalidate();
					toast.success("Passkey deleted");
				}}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
				open={deleteTarget !== null}
				title="Delete this passkey?"
			/>
		</Card>
	);
}
