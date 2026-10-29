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
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	CheckIcon,
	FileTextIcon,
	SearchIcon,
	SparklesIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

const NO_FORM = "none";

const VISIBILITY_LABELS: Record<string, string> = {
	closed: "Closed",
	draft: "Draft",
	public: "Live",
};

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
	const [formSearch, setFormSearch] = useState("");
	const forms = useQuery(trpc.form.list.queryOptions({ workspaceId }));

	const create = useMutation(
		trpc.ai.chat.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => {
				onCreated(data.id);
				onOpenChange(false);
				setFormId(NO_FORM);
				setFormSearch("");
			},
		})
	);

	const filteredForms = (forms.data ?? []).filter((f) =>
		f.title.toLowerCase().includes(formSearch.toLowerCase())
	);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New chat</DialogTitle>
					<DialogDescription>
						Start a conversation with the assistant, optionally scoped to one
						form.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<Label htmlFor="new-chat-search">Form context (optional)</Label>
					<div className="relative">
						<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
						<Input
							className="pl-8"
							id="new-chat-search"
							onChange={(event) => setFormSearch(event.target.value)}
							placeholder="Search…"
							value={formSearch}
						/>
					</div>
					<div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
						<button
							className={cn(
								"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted",
								formId === NO_FORM && "bg-primary-soft hover:bg-primary-soft"
							)}
							onClick={() => setFormId(NO_FORM)}
							type="button"
						>
							<SparklesIcon className="size-4 shrink-0 text-muted-foreground" />
							<span className="flex-1 font-medium text-sm">
								No form — general chat
							</span>
							{formId === NO_FORM ? (
								<CheckIcon className="size-4 shrink-0 text-primary" />
							) : null}
						</button>
						{filteredForms.map((form) => {
							const fieldsCount = form.properties?.length ?? 0;
							const selected = form.id === formId;
							return (
								<button
									className={cn(
										"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted",
										selected && "bg-primary-soft hover:bg-primary-soft"
									)}
									key={form.id}
									onClick={() => setFormId(form.id)}
									type="button"
								>
									<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium text-sm">
											{form.title}
										</span>
										<span className="text-subtle-foreground text-xs">
											{fieldsCount} field{fieldsCount === 1 ? "" : "s"} ·{" "}
											{VISIBILITY_LABELS[form.visibility] ?? form.visibility}
										</span>
									</span>
									{selected ? (
										<CheckIcon className="size-4 shrink-0 text-primary" />
									) : null}
								</button>
							);
						})}
					</div>
				</div>
				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={create.isPending}
						onClick={() =>
							create.mutate({
								formId: formId === NO_FORM ? undefined : formId,
								workspaceId,
							})
						}
					>
						<SparklesIcon /> {create.isPending ? "Starting…" : "Start chat"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
