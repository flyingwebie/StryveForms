/**
 * The AI chat shown in the editor's left column ("AI" tab, wired up by the
 * editor engineer). A compact, per-form assistant: a dropdown of this
 * form's past chats + "New chat", suggested prompts to get started, and the
 * same chat engine as the full Assistant page (ChatPanel in `compact`
 * mode), sized to fit a narrow (280–400px) column.
 */
import { Button } from "@StryveForms/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Spinner } from "@StryveForms/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { KeyRoundIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { ChatPanel } from "@/components/app/ai/chat-panel";
import { useEditor } from "@/components/form-editor/state/editor-context";
import { useWorkspaces } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

/** Shown as starter chips when this form has no chats yet. */
const EDITOR_SUGGESTIONS = [
	"Add a phone field",
	"Make this form shorter",
	"Summarise the latest responses",
];

/** No provider configured yet — same message as the Assistant page's empty state, scaled down. */
function NoProviderEmptyState() {
	return (
		<Empty className="h-full">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<KeyRoundIcon />
				</EmptyMedia>
				<EmptyTitle className="text-sm">No AI provider configured</EmptyTitle>
				<EmptyDescription className="text-xs">
					Add an API key in Settings → AI assistant to chat about this form.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button
					render={<Link search={{ tab: "ai" }} to="/dashboard/settings" />}
					size="sm"
					variant="outline"
				>
					Open settings
				</Button>
			</EmptyContent>
		</Empty>
	);
}

/** Shown before the first chat exists for this form: a short hint and starter prompts. */
function StartState({
	onSuggestion,
}: {
	onSuggestion: (text: string) => void;
}) {
	return (
		<div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
			<p className="text-muted-foreground text-xs">
				Ask the assistant to change this form, or about its responses.
			</p>
			<div className="flex flex-wrap justify-center gap-1.5">
				{EDITOR_SUGGESTIONS.map((suggestion) => (
					<Button
						key={suggestion}
						onClick={() => onSuggestion(suggestion)}
						size="sm"
						variant="outline"
					>
						{suggestion}
					</Button>
				))}
			</div>
		</div>
	);
}

export default function EditorAiPanel({
	formId,
	onFormChanged,
}: {
	formId: string;
	/**
	 * Optional extra refresh hook, called alongside the editor's own
	 * `reloadFromServer()` (from `useEditor()`) whenever a tool call changes
	 * this form's fields — reloadFromServer is what actually refetches the
	 * form and resyncs the Build/Design tabs; this is only for anything else
	 * the caller wants to do on top of that.
	 */
	onFormChanged?: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { activeWorkspaceId } = useWorkspaces();
	const { reloadFromServer } = useEditor();
	const [chatId, setChatId] = useState<string | null>(null);
	// A suggestion chip queues its text here, then clears once the freshly
	// created chat has consumed it (see ChatPanel's `autoSendMessage`).
	const [pendingMessage, setPendingMessage] = useState<string | null>(null);

	const credential = useQuery({
		...trpc.ai.credential.get.queryOptions({
			workspaceId: activeWorkspaceId ?? "",
		}),
		enabled: Boolean(activeWorkspaceId),
	});
	const chatsListQueryKey = trpc.ai.chat.list.queryKey({
		formId,
		workspaceId: activeWorkspaceId ?? "",
	});
	const chats = useQuery({
		...trpc.ai.chat.list.queryOptions({
			formId,
			workspaceId: activeWorkspaceId ?? "",
		}),
		enabled: Boolean(activeWorkspaceId),
	});
	const createChat = useMutation(
		trpc.ai.chat.create.mutationOptions({
			onSuccess: async (data) => {
				setChatId(data.id);
				// The "past chats" dropdown is scoped to this formId, a narrower
				// key than the one ChatPanel invalidates after saving a turn — ask
				// for it explicitly so the new chat (and its eventual title) show
				// up right away instead of waiting on a coincidental refetch.
				await queryClient.invalidateQueries({ queryKey: chatsListQueryKey });
			},
		})
	);

	// Default to this form's most recent chat once the list loads.
	useEffect(() => {
		if (chatId === null && chats.data && chats.data.length > 0) {
			setChatId(chats.data[0].id);
		}
	}, [chats.data, chatId]);

	if (!activeWorkspaceId) {
		return null;
	}

	if (credential.data === null) {
		return <NoProviderEmptyState />;
	}

	const chatItems = (chats.data ?? []).map((c) => ({
		label: c.title,
		value: c.id,
	}));

	const startNewChat = (suggestion?: string) => {
		setPendingMessage(suggestion ?? null);
		createChat.mutate({ formId, workspaceId: activeWorkspaceId });
	};

	let body: ReactNode;
	if (chatId) {
		body = (
			<ChatPanel
				autoSendMessage={pendingMessage ?? undefined}
				chatId={chatId}
				compact
				key={chatId}
				onFormChanged={() => {
					reloadFromServer();
					onFormChanged?.();
				}}
				workspaceId={activeWorkspaceId}
			/>
		);
	} else if (chats.data === undefined) {
		body = (
			<div className="flex h-full items-center justify-center">
				<Spinner className="size-5" />
			</div>
		);
	} else {
		body = <StartState onSuggestion={(text) => startNewChat(text)} />;
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex items-center gap-1.5 border-b p-2">
				{chatItems.length > 0 ? (
					<Select
						items={chatItems}
						onValueChange={(value) => {
							setPendingMessage(null);
							setChatId(value);
						}}
						value={chatId ?? chatItems[0]?.value}
					>
						<SelectTrigger className="h-8 flex-1 text-xs" size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{chatItems.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : (
					<span className="flex-1 truncate text-muted-foreground text-xs">
						No chats yet for this form
					</span>
				)}
				<Button
					aria-label="New chat"
					disabled={createChat.isPending}
					onClick={() => startNewChat()}
					size="icon-sm"
					variant="outline"
				>
					<PlusIcon />
				</Button>
			</div>
			<div className="min-h-0 flex-1">{body}</div>
		</div>
	);
}
