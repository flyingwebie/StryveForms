import { Button } from "@StryveForms/ui/components/button";
import { ScrollArea } from "@StryveForms/ui/components/scroll-area";
import { fetchServerSentEvents } from "@tanstack/ai-client";
import type { UIMessage } from "@tanstack/ai-react";
import { useChat } from "@tanstack/ai-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { apiBase } from "@/lib/api-url";
import { useTRPC, useTRPCClient } from "@/utils/trpc";

import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";
import { ComposerAttachFormButton } from "./form-context-picker";
import { FormHeaderCard } from "./form-header-card";

const SAVE_DEBOUNCE_MS = 1000;
const TITLE_MAX_LENGTH = 60;
const DEFAULT_TITLE = "New chat";
/** Tools whose completed call means the attached form changed in the DB — the editor needs to reload. */
const MUTATING_TOOLS = new Set(["create_form", "update_form_fields"]);

/** Starter prompts for a fresh, unattached chat — also used by the Assistant page's home screen. */
export const SUGGESTIONS_GENERAL = [
	"Build a customer feedback form",
	"Build an event signup form with name, email, and ticket type",
	"What can you help me do here?",
];

const SUGGESTIONS_COMPACT = [
	"Add a phone field",
	"Make this form shorter",
	"Summarise the latest responses",
];

function suggestionsFor(formTitle: string | null, compact?: boolean): string[] {
	if (compact) {
		return SUGGESTIONS_COMPACT;
	}
	if (!formTitle) {
		return SUGGESTIONS_GENERAL;
	}
	return [
		`Summarize the responses to "${formTitle}"`,
		`Add a required phone number field to "${formTitle}"`,
		`Explain this form's conditional logic`,
	];
}

/** Short, human title from the first user message, for chats still called "New chat". */
function titleFrom(message: string): string {
	const trimmed = message.trim().replace(/\s+/g, " ");
	return trimmed.length > TITLE_MAX_LENGTH
		? `${trimmed.slice(0, TITLE_MAX_LENGTH)}…`
		: trimmed;
}

/** The hint shown above the suggestion chips when the transcript is still empty. */
function emptyStateMessage(
	compact: boolean | undefined,
	formTitle: string | null
) {
	if (compact) {
		return "Ask the assistant to change this form, or about its responses.";
	}
	if (formTitle) {
		return `Ask about "${formTitle}", or anything else.`;
	}
	return "Ask the assistant to build a form, or ask a question.";
}

/** Whether the turn that just finished wrote to the attached form (create_form / update_form_fields). */
function didMutateForm(messages: readonly UIMessage[]): boolean {
	const lastAssistant = [...messages]
		.reverse()
		.find((m) => m.role === "assistant");
	return Boolean(
		lastAssistant?.parts.some(
			(part) =>
				part.type === "tool-call" &&
				part.state === "complete" &&
				MUTATING_TOOLS.has(part.name)
		)
	);
}

export function ChatPanel({
	autoSendMessage,
	chatId,
	compact,
	modelLabel,
	onFormChanged,
	workspaceId,
}: {
	/** Sent once, right after mount, if the chat has no messages yet — used by the editor's "suggested prompt" chips. */
	autoSendMessage?: string;
	chatId: string;
	/** Smaller, header-less layout for the editor's narrow "AI" tab. */
	compact?: boolean;
	/** The workspace's configured chat model (e.g. "gpt-4o"), shown in the composer as "Using <model>". */
	modelLabel?: string | null;
	/** Called once a tool call that mutates the attached form completes — lets the editor reload. */
	onFormChanged?: () => void;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const trpcClient = useTRPCClient();
	const queryClient = useQueryClient();

	const chatQuery = useQuery(trpc.ai.chat.get.queryOptions({ id: chatId }));
	const chatFormId = chatQuery.data?.formId ?? null;
	const formQuery = useQuery({
		...trpc.form.get.queryOptions({ id: chatFormId ?? "" }),
		enabled: Boolean(chatFormId),
	});
	const formTitle = chatFormId ? (formQuery.data?.title ?? null) : null;

	// The connection's `body` callback is captured once by useChat (it only
	// rebuilds the ChatClient when `threadId` changes), so reading
	// `chatQuery.data` there directly would freeze on whatever form was
	// attached on the first render. A ref always reads the current value,
	// which is how a mid-conversation form switch (see FormContextPicker
	// below) actually reaches the next request's system prompt.
	const chatFormIdRef = useRef(chatFormId);
	chatFormIdRef.current = chatFormId;

	const { append, error, isLoading, messages, reload, sendMessage, stop } =
		useChat({
			connection: fetchServerSentEvents(
				() => `${apiBase()}/api/ai/chat`,
				() => ({
					body: { formId: chatFormIdRef.current, workspaceId },
					credentials: "include",
				})
			),
			initialMessages:
				(chatQuery.data?.messages as UIMessage[] | undefined) ?? [],
			threadId: chatId,
		});

	// Fires a suggested-prompt chip the editor queued before this chat existed
	// — once only, the moment the panel mounts with no prior messages.
	const autoSentRef = useRef(false);
	// Intentionally fires once, keyed only on the chat's own messages finishing
	// their load — autoSentRef (not more deps) guards against re-sending.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		if (
			autoSendMessage &&
			!autoSentRef.current &&
			messages.length === 0 &&
			!chatQuery.isLoading
		) {
			autoSentRef.current = true;
			sendMessage(autoSendMessage);
		}
	}, [chatQuery.isLoading]);

	const chatTitle = chatQuery.data?.title;
	const saveMessages = trpcClient.ai.chat.saveMessages.mutate;
	const chatListQueryKey = trpc.ai.chat.list.queryKey({ workspaceId });
	const { invalidateQueries } = queryClient;

	// Persist the transcript after each turn settles — the server endpoint only
	// streams the reply; it doesn't own the ai_chat row.
	useEffect(() => {
		if (isLoading || messages.length === 0) {
			return;
		}
		const timeout = setTimeout(() => {
			const firstUserText = messages
				.find((m) => m.role === "user")
				?.parts.find((p) => p.type === "text")?.content;
			const shouldSetTitle =
				chatTitle === DEFAULT_TITLE &&
				typeof firstUserText === "string" &&
				firstUserText.length > 0;
			saveMessages({
				id: chatId,
				messages: messages as unknown[],
				...(shouldSetTitle ? { title: titleFrom(firstUserText) } : {}),
			})
				.then(() => invalidateQueries({ queryKey: chatListQueryKey }))
				.catch(() => {
					// Best-effort: the conversation still works this session even if a save fails.
				});
		}, SAVE_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [
		messages,
		isLoading,
		chatId,
		chatTitle,
		saveMessages,
		chatListQueryKey,
		invalidateQueries,
	]);

	useEffect(() => {
		if (error) {
			toast.error(error.message || "The assistant hit an error");
		}
	}, [error]);

	// When a turn that just finished made a tool call that writes to the form
	// (create_form / update_form_fields), tell the editor to reload — it has
	// its own copy of the form's fields open in the Build/Design tabs.
	const prevIsLoadingRef = useRef(isLoading);
	useEffect(() => {
		const justFinished = prevIsLoadingRef.current && !isLoading;
		prevIsLoadingRef.current = isLoading;
		if (justFinished && chatFormId && didMutateForm(messages)) {
			queryClient.invalidateQueries({
				queryKey: trpc.form.get.queryKey({ id: chatFormId }),
			});
			onFormChanged?.();
		}
	}, [isLoading, messages, chatFormId, queryClient, trpc, onFormChanged]);

	const setFormContext = useMutation(
		trpc.ai.chat.setFormContext.mutationOptions({
			onError: (mutationError) => toast.error(mutationError.message),
			onSuccess: async (data, variables) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.ai.chat.get.queryKey({ id: chatId }),
				});
				// Visible only — not sent to the model. The model instead sees the
				// new form in its system prompt on the next message, built fresh
				// per request from the chat's (now updated) formId.
				await append({
					id: `activity-${Date.now()}`,
					parts: [
						{
							content: variables.formId
								? `Context switched to "${data.formTitle}".`
								: "Form context removed.",
							type: "text",
						},
					],
					role: "activity",
				});
			},
		})
	);

	const lastAssistantIndex = messages.reduce(
		(acc, message, index) => (message.role === "assistant" ? index : acc),
		-1
	);

	const handleFormChange = (nextFormId: string | null) => {
		if (nextFormId === chatFormId) {
			return;
		}
		setFormContext.mutate({ formId: nextFormId, id: chatId });
	};

	// Only shown once the attached form has loaded — an unattached (general) chat
	// has no header at all, matching the design; attaching happens from the
	// composer's "Attach form" button below instead.
	let headerArea: ReactNode = null;
	if (!compact && chatFormId && formQuery.data) {
		headerArea = (
			<FormHeaderCard
				form={formQuery.data}
				onFormChange={handleFormChange}
				workspaceId={workspaceId}
			/>
		);
	}

	const emptyStateText = emptyStateMessage(compact, formTitle);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{headerArea}
			<ScrollArea className="flex-1">
				<div
					className={
						compact
							? "flex flex-col gap-3 p-3"
							: "mx-auto flex max-w-3xl flex-col gap-4 p-4"
					}
				>
					{messages.length === 0 ? (
						<div
							className={
								compact
									? "flex flex-col items-center gap-2 py-6 text-center"
									: "flex flex-col items-center gap-3 py-16 text-center"
							}
						>
							<p className="text-muted-foreground text-xs">{emptyStateText}</p>
							<div className="flex flex-wrap justify-center gap-1.5">
								{suggestionsFor(formTitle, compact).map((suggestion) => (
									<Button
										className="h-auto max-w-full shrink whitespace-normal text-left"
										key={suggestion}
										onClick={() => sendMessage(suggestion)}
										size="sm"
										variant="outline"
									>
										<SparklesIcon className="shrink-0 text-primary" />{" "}
										{suggestion}
									</Button>
								))}
							</div>
						</div>
					) : (
						messages.map((message, index) => (
							<div key={message.id}>
								<ChatMessage compact={compact} message={message} />
								{message.role === "assistant" && (
									<div className="mt-1 flex gap-1">
										<Button
											aria-label="Copy"
											onClick={() => {
												const text = message.parts
													.filter((p) => p.type === "text")
													.map((p) => p.content)
													.join("\n\n");
												navigator.clipboard.writeText(text).then(() => {
													toast.success("Copied");
												});
											}}
											size="icon-sm"
											variant="ghost"
										>
											<CopyIcon />
										</Button>
										{index === lastAssistantIndex && !isLoading && (
											<Button
												aria-label="Retry"
												onClick={() => reload()}
												size="icon-sm"
												variant="ghost"
											>
												<RotateCcwIcon />
											</Button>
										)}
									</div>
								)}
							</div>
						))
					)}
				</div>
			</ScrollArea>
			<ChatComposer
				formContext={
					compact ? undefined : (
						<ComposerAttachFormButton
							formId={chatFormId}
							onChange={handleFormChange}
							workspaceId={workspaceId}
						/>
					)
				}
				isStreaming={isLoading}
				modelLabel={modelLabel}
				onSend={sendMessage}
				onStop={stop}
			/>
		</div>
	);
}
