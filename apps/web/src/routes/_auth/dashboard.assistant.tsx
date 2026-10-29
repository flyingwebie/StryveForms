import { Button } from "@StryveForms/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@StryveForms/ui/components/empty";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRoundIcon, SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { ChatPanel } from "@/components/app/ai/chat-panel";
import { ConversationSidebar } from "@/components/app/ai/conversation-sidebar";
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
					A workspace admin needs to add an API key in Settings → AI assistant
					before the assistant can reply.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button render={<Link to="/dashboard/settings" />} variant="outline">
					Open settings
				</Button>
			</EmptyContent>
		</Empty>
	);
}

function StartEmptyState({ onNewChat }: { onNewChat: () => void }) {
	return (
		<Empty className="h-full">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<SparklesIcon />
				</EmptyMedia>
				<EmptyTitle>Ask the assistant</EmptyTitle>
				<EmptyDescription>
					Build a form from a description, or ask questions about an existing
					one and its responses.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button onClick={onNewChat}>New chat</Button>
			</EmptyContent>
		</Empty>
	);
}

function RouteComponent() {
	const { chatId: chatIdParam, formId: formIdParam } = Route.useSearch();
	const navigate = Route.useNavigate();
	const trpc = useTRPC();
	const { activeWorkspaceId } = useWorkspaces();
	const [newChatOpen, setNewChatOpen] = useState(false);
	const autoCreatedForFormId = useRef<string | null>(null);

	const credentialQuery = useQuery({
		...trpc.ai.credential.get.queryOptions({
			workspaceId: activeWorkspaceId ?? "",
		}),
		enabled: Boolean(activeWorkspaceId),
	});

	const selectChat = useCallback(
		(id: string) => {
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

	if (!activeWorkspaceId) {
		return null;
	}

	const resolvedChatId = chatIdParam ?? null;

	let mainContent: ReactNode;
	if (credentialQuery.data === null) {
		mainContent = <NoProviderEmptyState />;
	} else if (resolvedChatId) {
		mainContent = (
			<ChatPanel
				chatId={resolvedChatId}
				key={resolvedChatId}
				workspaceId={activeWorkspaceId}
			/>
		);
	} else {
		mainContent = <StartEmptyState onNewChat={() => setNewChatOpen(true)} />;
	}

	return (
		<div className="flex h-[calc(100vh-3.5rem)]">
			<ConversationSidebar
				activeChatId={resolvedChatId}
				onNewChat={() => setNewChatOpen(true)}
				onSelect={selectChat}
				workspaceId={activeWorkspaceId}
			/>
			<div className="flex min-w-0 flex-1 flex-col">{mainContent}</div>
			<NewChatDialog
				onCreated={selectChat}
				onOpenChange={setNewChatOpen}
				open={newChatOpen}
				workspaceId={activeWorkspaceId}
			/>
		</div>
	);
}
