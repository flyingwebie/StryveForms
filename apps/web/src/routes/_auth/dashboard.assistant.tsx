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
	Sheet,
	SheetContent,
	SheetTitle,
} from "@StryveForms/ui/components/sheet";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRoundIcon, MenuIcon, PlusIcon, SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { ChatComposer } from "@/components/app/ai/chat-composer";
import { ChatPanel, SUGGESTIONS_GENERAL } from "@/components/app/ai/chat-panel";
import { ConversationSidebar } from "@/components/app/ai/conversation-sidebar";
import { ComposerAttachFormButton } from "@/components/app/ai/form-context-picker";
import { NewChatDialog } from "@/components/app/ai/new-chat-dialog";
import { useWorkspaces } from "@/lib/workspace";
import { useTRPC } from "@/utils/trpc";

/** AI assistant chat: `/dashboard/assistant?formId=&chatId=`. */
export const Route = createFileRoute("/_auth/dashboard/assistant")({
	component: RouteComponent,
	validateSearch: z.object({
		chatId: z.string().optional(),
		formId: z.string().optional(),
	}),
});

function NoProviderEmptyState() {
	return (
		<Empty className="h-full">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<KeyRoundIcon />
				</EmptyMedia>
				<EmptyTitle>No AI provider configured</EmptyTitle>
				<EmptyDescription>
					Connect OpenAI, Anthropic, Gemini, or another provider to start using
					the assistant.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button render={<Link to="/dashboard/settings" />}>
					<KeyRoundIcon /> Open settings
				</Button>
			</EmptyContent>
		</Empty>
	);
}

/**
 * The "home" state before any chat is selected: the editorial Instrument
 * Serif greeting, a ready-to-type composer, and suggestion chips. Sending a
 * message (or a chip) creates the chat and immediately sends it, via
 * `ChatPanel`'s `autoSendMessage` — no separate "start chat" click needed.
 */
function AssistantHome({
	isCreating,
	onSend,
	workspaceId,
}: {
	isCreating: boolean;
	onSend: (text: string, formId: string | null) => void;
	workspaceId: string;
}) {
	const [formId, setFormId] = useState<string | null>(null);

	return (
		<div className="flex h-full flex-col items-center justify-center gap-6 p-4">
			<div className="max-w-lg text-center">
				<h1 className="font-display text-4xl">What are we building today?</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Ask the assistant to build a form, update fields, wire up
					notifications, or explain your data.
				</p>
			</div>
			<div className="w-full max-w-xl">
				<ChatComposer
					disabled={isCreating}
					formContext={
						<ComposerAttachFormButton
							formId={formId}
							onChange={setFormId}
							workspaceId={workspaceId}
						/>
					}
					isStreaming={false}
					onSend={(text) => onSend(text, formId)}
					onStop={() => {
						// Nothing to stop yet — no chat exists until the first send.
					}}
					placeholder="Message the assistant…"
				/>
			</div>
			<div className="flex flex-wrap justify-center gap-1.5">
				{SUGGESTIONS_GENERAL.map((suggestion) => (
					<Button
						className="h-auto max-w-full shrink whitespace-normal text-left"
						disabled={isCreating}
						key={suggestion}
						onClick={() => onSend(suggestion, formId)}
						size="sm"
						variant="outline"
					>
						<SparklesIcon className="shrink-0 text-primary" /> {suggestion}
					</Button>
				))}
			</div>
		</div>
	);
}

function RouteComponent() {
	const { chatId: chatIdParam, formId: formIdParam } = Route.useSearch();
	const navigate = Route.useNavigate();
	const trpc = useTRPC();
	const { activeWorkspaceId } = useWorkspaces();
	const [newChatOpen, setNewChatOpen] = useState(false);
	const [mobileNavOpen, setMobileNavOpen] = useState(false);
	const autoCreatedForFormId = useRef<string | null>(null);
	const [pendingMessage, setPendingMessage] = useState<string | undefined>();

	const credentialQuery = useQuery({
		...trpc.ai.credential.get.queryOptions({
			workspaceId: activeWorkspaceId ?? "",
		}),
		enabled: Boolean(activeWorkspaceId),
	});

	const selectChat = useCallback(
		(id: string) => {
			setMobileNavOpen(false);
			navigate({ search: { chatId: id } });
		},
		[navigate]
	);

	const createChat = useMutation(trpc.ai.chat.create.mutationOptions());

	// "Ask AI" linking in with ?formId= and no chat yet: start one for that
	// form right away instead of making the user click through a dialog.
	useEffect(() => {
		if (
			!(activeWorkspaceId && formIdParam) ||
			chatIdParam ||
			autoCreatedForFormId.current === formIdParam ||
			createChat.isPending
		) {
			return;
		}
		autoCreatedForFormId.current = formIdParam;
		createChat.mutate(
			{ formId: formIdParam, workspaceId: activeWorkspaceId },
			{ onSuccess: (data) => selectChat(data.id) }
		);
	}, [
		activeWorkspaceId,
		formIdParam,
		chatIdParam,
		createChat.isPending,
		createChat.mutate,
		selectChat,
	]);

	const handleHomeSend = useCallback(
		(text: string, formId: string | null) => {
			if (!activeWorkspaceId) {
				return;
			}
			setPendingMessage(text);
			createChat.mutate(
				{ formId: formId ?? undefined, workspaceId: activeWorkspaceId },
				{ onSuccess: (data) => selectChat(data.id) }
			);
		},
		[activeWorkspaceId, createChat, selectChat]
	);

	if (!activeWorkspaceId) {
		return null;
	}

	const resolvedChatId = chatIdParam ?? null;
	const modelLabel = credentialQuery.data?.model ?? null;

	let mainContent: ReactNode;
	if (credentialQuery.data === null) {
		mainContent = <NoProviderEmptyState />;
	} else if (resolvedChatId) {
		mainContent = (
			<ChatPanel
				autoSendMessage={pendingMessage}
				chatId={resolvedChatId}
				key={resolvedChatId}
				modelLabel={modelLabel}
				workspaceId={activeWorkspaceId}
			/>
		);
	} else {
		mainContent = (
			<AssistantHome
				isCreating={createChat.isPending}
				onSend={handleHomeSend}
				workspaceId={activeWorkspaceId}
			/>
		);
	}

	return (
		<div className="flex h-[calc(100vh-3.5rem)] flex-col">
			<div className="flex items-center gap-2 border-b p-2 sm:hidden">
				<Sheet onOpenChange={setMobileNavOpen} open={mobileNavOpen}>
					<Button
						aria-label="Open chat list"
						onClick={() => setMobileNavOpen(true)}
						size="icon-sm"
						variant="ghost"
					>
						<MenuIcon />
					</Button>
					<SheetContent className="w-80 p-0" side="left">
						<SheetTitle className="sr-only">Chats</SheetTitle>
						<ConversationSidebar
							activeChatId={resolvedChatId}
							onNewChat={() => {
								setMobileNavOpen(false);
								setNewChatOpen(true);
							}}
							onSelect={selectChat}
							workspaceId={activeWorkspaceId}
						/>
					</SheetContent>
				</Sheet>
				<span className="flex-1 font-semibold text-sm">Assistant</span>
				<Button
					aria-label="New chat"
					onClick={() => setNewChatOpen(true)}
					size="icon-sm"
					variant="ghost"
				>
					<PlusIcon />
				</Button>
			</div>
			<div className="flex min-h-0 flex-1">
				<div className="hidden sm:flex">
					<ConversationSidebar
						activeChatId={resolvedChatId}
						onNewChat={() => setNewChatOpen(true)}
						onSelect={selectChat}
						workspaceId={activeWorkspaceId}
					/>
				</div>
				<div className="flex min-w-0 flex-1 flex-col">{mainContent}</div>
			</div>
			<NewChatDialog
				onCreated={selectChat}
				onOpenChange={setNewChatOpen}
				open={newChatOpen}
				workspaceId={activeWorkspaceId}
			/>
		</div>
	);
}
