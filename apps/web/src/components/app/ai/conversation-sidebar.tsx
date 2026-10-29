import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { Input } from "@StryveForms/ui/components/input";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemGroup,
	ItemTitle,
} from "@StryveForms/ui/components/item";
import { ScrollArea } from "@StryveForms/ui/components/scroll-area";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	FileTextIcon,
	MessageSquareIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import { useTRPC } from "@/utils/trpc";

interface ConversationSidebarProps {
	activeChatId: string | null;
	onNewChat: () => void;
	onSelect: (chatId: string) => void;
	workspaceId: string;
}

/** Left pane of the assistant page: the user's chats in this workspace, with rename/delete. */
export function ConversationSidebar({
	activeChatId,
	onNewChat,
	onSelect,
	workspaceId,
}: ConversationSidebarProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [deletingId, setDeletingId] = useState<string | null>(null);

	const chats = useQuery(trpc.ai.chat.list.queryOptions({ workspaceId }));

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.ai.chat.list.queryKey({ workspaceId }),
		});

	const rename = useMutation(
		trpc.ai.chat.rename.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				setRenamingId(null);
			},
		})
	);
	const remove = useMutation(
		trpc.ai.chat.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				setDeletingId(null);
				if (deletingId === activeChatId) {
					onNewChat();
				}
			},
		})
	);

	const items = chats.data ?? [];

	return (
		<div className="flex h-full w-64 shrink-0 flex-col border-r">
			<div className="border-b p-3">
				<Button className="w-full justify-start" onClick={onNewChat}>
					<PlusIcon /> New chat
				</Button>
			</div>
			<ScrollArea className="flex-1">
				<div className="p-2">
					{items.length === 0 ? (
						<Empty className="p-6">
							<EmptyHeader>
								<EmptyTitle>No chats yet</EmptyTitle>
								<EmptyDescription>
									Start a new chat to ask the assistant to build a form or
									answer a question.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					) : (
						<ItemGroup>
							{items.map((item) => (
								<Item
									className="group/chat cursor-pointer flex-nowrap gap-2 rounded-lg px-2 py-1.5"
									data-active={item.id === activeChatId}
									key={item.id}
									onClick={() => onSelect(item.id)}
									size="sm"
									variant={item.id === activeChatId ? "muted" : "default"}
								>
									<MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
									<ItemContent className="min-w-0">
										{renamingId === item.id ? (
											<Input
												autoFocus
												className="h-7 text-sm"
												onBlur={() => setRenamingId(null)}
												onChange={(event) => setRenameValue(event.target.value)}
												onClick={(event) => event.stopPropagation()}
												onKeyDown={(event) => {
													if (event.key === "Enter" && renameValue.trim()) {
														rename.mutate({
															id: item.id,
															title: renameValue.trim(),
														});
													}
													if (event.key === "Escape") {
														setRenamingId(null);
													}
												}}
												value={renameValue}
											/>
										) : (
											<>
												<ItemTitle className="block w-full truncate font-normal text-sm">
													{item.title}
												</ItemTitle>
												{item.formTitle ? (
													<p className="flex items-center gap-1 truncate text-muted-foreground text-xs">
														<FileTextIcon className="size-3 shrink-0" />
														{item.formTitle}
													</p>
												) : null}
											</>
										)}
									</ItemContent>
									<ItemActions className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/chat:opacity-100 group-data-[active=true]/chat:opacity-100">
										<DropdownMenu>
											<DropdownMenuTrigger
												onClick={(event) => event.stopPropagation()}
												render={
													<Button size="icon-sm" variant="ghost">
														<MoreHorizontalIcon />
													</Button>
												}
											/>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() => {
														setRenamingId(item.id);
														setRenameValue(item.title);
													}}
												>
													<PencilIcon /> Rename
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => setDeletingId(item.id)}
													variant="destructive"
												>
													<Trash2Icon /> Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</ItemActions>
								</Item>
							))}
						</ItemGroup>
					)}
				</div>
			</ScrollArea>

			<ConfirmDialog
				description="This chat and its messages will be permanently deleted."
				loading={remove.isPending}
				onConfirm={() => {
					if (deletingId) {
						remove.mutate({ id: deletingId });
					}
				}}
				onOpenChange={(open) => {
					if (!open) {
						setDeletingId(null);
					}
				}}
				open={deletingId !== null}
				title="Delete chat?"
			/>
		</div>
	);
}
