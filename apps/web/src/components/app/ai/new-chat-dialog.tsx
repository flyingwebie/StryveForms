import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

const NO_FORM = "none";

/** Starts a new chat, optionally pinned to one form so the assistant has that context right away. */
export function NewChatDialog({
	onCreated,
	onOpenChange,
	open,
	workspaceId,
}: {
	onCreated: (chatId: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const [formId, setFormId] = useState(NO_FORM);
	const forms = useQuery(trpc.form.list.queryOptions({ workspaceId }));

	const create = useMutation(
		trpc.ai.chat.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => {
				onCreated(data.id);
				onOpenChange(false);
				setFormId(NO_FORM);
			},
		})
	);

	const items = [
		{ label: "No form (general questions)", value: NO_FORM },
		...(forms.data ?? []).map((form) => ({
			label: form.title,
			value: form.id,
		})),
	];

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>New chat</DialogTitle>
					<DialogDescription>
						Optionally attach a form so the assistant can see its fields and
						answer questions about its responses.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="new-chat-form">Form</Label>
					<Select
						items={items}
						onValueChange={(value) => setFormId(value ?? NO_FORM)}
						value={formId}
					>
						<SelectTrigger id="new-chat-form">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{items.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<DialogFooter>
					<Button
						disabled={create.isPending}
						onClick={() =>
							create.mutate({
								formId: formId === NO_FORM ? undefined : formId,
								workspaceId,
							})
						}
					>
						{create.isPending ? "Creating…" : "Start chat"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
