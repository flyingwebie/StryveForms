import { Button } from "@StryveForms/ui/components/button";
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
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CheckIcon,
	FileTextIcon,
	MessageSquareIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
	XIcon,
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

interface ChatListItem {
	formId: string | null;
	formTitle: string | null;
	id: string;
	title: string;
	updatedAt: string;
}

interface ChatGroup {
	items: ChatListItem[];
	label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Buckets chats (already sorted newest-first by the server) into Today / This week / Older. */
function groupChats(items: ChatListItem[]): ChatGroup[] {
	const now = Date.now();
	const groups: ChatGroup[] = [
		{ items: [], label: "Today" },
		{ items: [], label: "This week" },
		{ items: [], label: "Older" },
	];
	for (const item of items) {
		const ageMs = now - new Date(item.updatedAt).getTime();
		if (ageMs < DAY_MS) {
			groups[0].items.push(item);
		} else if (ageMs < 7 * DAY_MS) {
			groups[1].items.push(item);
		} else {
			groups[2].items.push(item);
		}
	}
	return groups.filter((group) => group.items.length > 0);
}

/** Left pane of the assistant page: the user's chats in this workspace, grouped by recency, with rename/delete. */
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
	const groups = groupChats(items);

	function commitRename() {
		const trimmed = renameValue.trim();
		if (trimmed && renamingId) {
			rename.mutate({ id: renamingId, title: trimmed });
		}
	}

	return (
		<div className="flex h-full w-full shrink-0 flex-col border-r sm:w-72">
			<div className="border-b p-3">
				<Button className="w-full justify-start" onClick={onNewChat}>
					<PlusIcon /> New chat
				</Button>
			</div>
			<ScrollArea className="flex-1">
				<div className="flex flex-col gap-4 p-2">
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
						groups.map((group) => (
							<div key={group.label}>
								<p className="px-2 pb-1 font-medium text-[11px] text-subtle-foreground uppercase tracking-wide">
									{group.label}
								</p>
								<ItemGroup>
									{group.items.map((item) => (
										<Item
											className="group/chat cursor-pointer flex-nowrap gap-2 rounded-lg px-2 py-1.5 data-[active=true]:bg-primary-soft"
											data-active={item.id === activeChatId}
											key={item.id}
											onClick={() => {
												if (renamingId !== item.id) {
													onSelect(item.id);
												}
											}}
											size="sm"
											variant="default"
										>
											{renamingId === item.id ? (
												<>
													<ItemContent className="min-w-0">
														<Input
															autoFocus
															className="h-7 text-sm"
															onChange={(event) =>
																setRenameValue(event.target.value)
															}
															onClick={(event) => event.stopPropagation()}
															onKeyDown={(event) => {
																if (event.key === "Enter") {
																	commitRename();
																}
																if (event.key === "Escape") {
																	setRenamingId(null);
																}
															}}
															value={renameValue}
														/>
													</ItemContent>
													<ItemActions>
														<Button
															aria-label="Save name"
															onClick={(event) => {
																event.stopPropagation();
																commitRename();
															}}
															size="icon-sm"
															variant="ghost"
														>
															<CheckIcon className="text-success" />
														</Button>
														<Button
															aria-label="Cancel rename"
															onClick={(event) => {
																event.stopPropagation();
																setRenamingId(null);
															}}
															size="icon-sm"
															variant="ghost"
														>
															<XIcon />
														</Button>
													</ItemActions>
												</>
											) : (
												<>
													<MessageSquareIcon
														className={cn(
															"size-4 shrink-0 text-muted-foreground",
															item.id === activeChatId && "text-primary"
														)}
													/>
													<ItemContent className="min-w-0">
														<ItemTitle
															className={cn(
																"block w-full truncate font-normal text-sm",
																item.id === activeChatId &&
																	"font-medium text-primary"
															)}
														>
															{item.title}
														</ItemTitle>
														{item.formTitle ? (
															<p className="flex items-center gap-1 truncate text-muted-foreground text-xs">
																<FileTextIcon className="size-3 shrink-0" />
																{item.formTitle}
															</p>
														) : null}
													</ItemContent>
													<ItemActions className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/chat:opacity-100 group-data-[active=true]/chat:opacity-100">
														<Button
															aria-label="Rename chat"
															onClick={(event) => {
																event.stopPropagation();
																setRenamingId(item.id);
																setRenameValue(item.title);
															}}
															size="icon-sm"
															variant="ghost"
														>
															<PencilIcon />
														</Button>
														<Button
															aria-label="Delete chat"
															onClick={(event) => {
																event.stopPropagation();
																setDeletingId(item.id);
															}}
															size="icon-sm"
															variant="ghost"
														>
															<Trash2Icon />
														</Button>
													</ItemActions>
												</>
											)}
										</Item>
									))}
								</ItemGroup>
							</div>
						))
					)}
				</div>
			</ScrollArea>

			<ConfirmDialog
				confirmIcon={<Trash2Icon />}
				confirmLabel="Delete chat"
				description="This permanently deletes the conversation and everything the assistant created in it. This can't be undone."
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
				title={`Delete "${items.find((i) => i.id === deletingId)?.title ?? "this chat"}"?`}
			/>
		</div>
	);
}
