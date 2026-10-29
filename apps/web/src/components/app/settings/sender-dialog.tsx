import { Button } from "@StryveForms/ui/components/button";
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
import { useEffect, useState } from "react";

export interface SenderFormValue {
	address: string;
	id: string;
	name: string;
	replyTo?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Add or edit one "From" identity a workspace can send notification emails as. */
export default function SenderDialog({
	onOpenChange,
	onSave,
	open,
	sender,
}: {
	onOpenChange: (open: boolean) => void;
	onSave: (sender: SenderFormValue) => void;
	open: boolean;
	sender?: SenderFormValue | null;
}) {
	const [name, setName] = useState(sender?.name ?? "");
	const [address, setAddress] = useState(sender?.address ?? "");
	const [replyTo, setReplyTo] = useState(sender?.replyTo ?? "");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setName(sender?.name ?? "");
			setAddress(sender?.address ?? "");
			setReplyTo(sender?.replyTo ?? "");
			setError(null);
		}
	}, [open, sender]);

	function handleSubmit() {
		const trimmedName = name.trim();
		const trimmedAddress = address.trim();
		const trimmedReplyTo = replyTo.trim();
		if (!trimmedName) {
			setError("Give this sender a display name");
			return;
		}
		if (!EMAIL_PATTERN.test(trimmedAddress)) {
			setError('Enter a valid "From" email address');
			return;
		}
		if (trimmedReplyTo && !EMAIL_PATTERN.test(trimmedReplyTo)) {
			setError("Enter a valid reply-to address, or leave it blank");
			return;
		}
		onSave({
			address: trimmedAddress,
			id: sender?.id ?? crypto.randomUUID(),
			name: trimmedName,
			replyTo: trimmedReplyTo || undefined,
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>{sender ? "Edit sender" : "Add sender"}</DialogTitle>
					<DialogDescription>
						An email identity notifications can be sent from.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="sender-display-name">Display name</Label>
						<Input
							id="sender-display-name"
							onChange={(event) => setName(event.target.value)}
							placeholder="Acme Support"
							value={name}
						/>
						<p className="text-muted-foreground text-xs">
							The name recipients see next to the email address.
						</p>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="sender-address">Address</Label>
						<Input
							id="sender-address"
							onChange={(event) => setAddress(event.target.value)}
							placeholder="support@yourcompany.com"
							type="email"
							value={address}
						/>
						<p className="text-muted-foreground text-xs">
							The "From" address. This only works if your SMTP server is allowed
							to send mail as this address.
						</p>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="sender-reply-to">Reply-to</Label>
						<Input
							id="sender-reply-to"
							onChange={(event) => setReplyTo(event.target.value)}
							placeholder={address || "Same as the address above"}
							type="email"
							value={replyTo}
						/>
						<p className="text-muted-foreground text-xs">
							Where replies land. Leave blank to use the address above.
						</p>
					</div>

					{error ? <p className="text-destructive text-sm">{error}</p> : null}
				</div>

				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
					<Button onClick={handleSubmit} type="button">
						{sender ? "Save changes" : "Add sender"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
