import type { Database } from "@StryveForms/db";
import { aiCredential } from "@StryveForms/db/schema/features";
import { chat as runChat } from "@tanstack/ai";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { AppConfig } from "../context";
import { protectedProcedure, router } from "../index";
import { requireForm } from "../lib/access";
import { decryptApiKey } from "../services/ai/crypto";
import { buildTextAdapter, isAiProvider } from "../services/ai/providers";
import {
	notificationDataSchema,
	previewEmailNotification,
	sendTestEmailNotification,
} from "../services/notifications";
import { sanitizeRichText } from "../services/sanitize";

export const writerRouter = router({
	/**
	 * Renders the real email template with the draft's current data, so the
	 * "Email notifications" tab can show a live, accurate preview next to the
	 * settings form. Uses the form's latest submission (or sample values when
	 * there isn't one yet) and the same `composeEmail` the real send uses.
	 * Shared with the `preview_email_notification` agent tool — see
	 * services/notifications.ts.
	 */
	notificationPreview: protectedProcedure
		.input(
			z.object({
				colorScheme: z.enum(["light", "dark"]).optional(),
				data: notificationDataSchema,
				formId: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			const { form } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id
			);
			return previewEmailNotification(
				ctx.db,
				ctx.services,
				form,
				input.data,
				input.colorScheme
			);
		}),

	/** Sends the draft to the current user's own email, so they can check a real inbox before saving. */
	sendTest: protectedProcedure
		.input(z.object({ data: notificationDataSchema, formId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { form } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit"
			);
			return sendTestEmailNotification(
				ctx.db,
				ctx.services,
				form,
				input.data,
				ctx.session.user.email
			);
		}),

	ai: router({
		/**
		 * One-shot AI writing help for the email body/subject editors: write
		 * from a prompt, improve/shorten/tone/grammar, or translate. Needs the
		 * workspace's AI provider (Settings -> AI assistant); the client shows
		 * a hint there when `ai.credential.get` has no key configured.
		 */
		generate: protectedProcedure
			.input(
				z.object({
					action: z.enum([
						"write",
						"improve",
						"shorten",
						"friendlier",
						"formal",
						"grammar",
						"translate",
					]),
					html: z.string().max(20_000).default(""),
					/** Free prompt for "write"; target language for "translate". */
					instruction: z.string().max(2000).optional(),
					workspaceId: z.string(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const html = await generateEmailHtml(
					ctx.db,
					ctx.services.config,
					input
				);
				return { html: sanitizeRichText(html) };
			}),
	}),
});

async function requireAiCredential(db: Database, workspaceId: string) {
	const [row] = await db
		.select()
		.from(aiCredential)
		.where(eq(aiCredential.workspaceId, workspaceId))
		.limit(1);
	if (!row?.encryptedKey) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"No AI provider is configured for this workspace yet. Set one up in Settings → AI assistant.",
		});
	}
	return row;
}

const SYSTEM_PROMPT = `You write and edit HTML email content for a form-builder's "email notifications" feature.
Only use these HTML tags: p, br, strong, b, em, i, u, s, mark, h1, h2, h3, ul, ol, li, a, img, hr, table, thead, tbody, tr, th, td, span.
The content may contain field-mention placeholders like <span mention="true" mention-field-id="..." mention-field-name="Name" ...>Name</span> — these are opaque tokens that get replaced with a real answer when the email is sent. Never translate, reword, remove, or alter their attributes or inner text; copy each one through exactly as it appears.
Reply with ONLY the resulting HTML fragment. No markdown, no code fences, no explanation, no surrounding <html>/<body> tags.`;

const TIMEOUT_MS = 30_000;
const CODE_FENCE = /^```(?:html)?\n([\s\S]*)\n```$/;

type WriterAiAction =
	| "write"
	| "improve"
	| "shorten"
	| "friendlier"
	| "formal"
	| "grammar"
	| "translate";

async function generateEmailHtml(
	db: Database,
	config: AppConfig,
	input: {
		action: WriterAiAction;
		html: string;
		instruction?: string;
		workspaceId: string;
	}
): Promise<string> {
	const credential = await requireAiCredential(db, input.workspaceId);
	const provider = isAiProvider(credential.provider)
		? credential.provider
		: "openai_compatible";
	const apiKey = decryptApiKey(
		config.signingSecret,
		credential.encryptedKey as string
	);
	const adapter = buildTextAdapter({
		apiKey,
		baseUrl: credential.baseUrl,
		model: credential.model,
		provider,
	});
	const prompt = buildPrompt(input);
	const abortController = new AbortController();
	const timeout = setTimeout(() => abortController.abort(), TIMEOUT_MS);
	try {
		const result = await runChat({
			abortController,
			adapter,
			// The adapter's `ModelMessage` role union has no "system" — fold the
			// instructions into the one user turn instead (same pattern as
			// routers/ai.ts's connection-test call).
			messages: [{ content: `${SYSTEM_PROMPT}\n\n${prompt}`, role: "user" }],
			stream: false,
			threadId: `writer-${input.workspaceId}-${Date.now()}`,
		});
		return stripCodeFence(result.text.trim());
	} finally {
		clearTimeout(timeout);
	}
}

function stripCodeFence(text: string): string {
	const match = text.match(CODE_FENCE);
	return match?.[1] ?? text;
}

const ACTION_VERBS: Record<string, string> = {
	formal:
		"Rewrite this HTML email content in a more formal, professional tone.",
	friendlier: "Rewrite this HTML email content in a warmer, friendlier tone.",
	grammar:
		"Fix grammar and spelling mistakes in this HTML email content without changing its meaning or tone.",
	improve:
		"Improve the clarity and writing quality of this HTML email content, keeping its meaning and roughly the same length.",
	shorten:
		"Make this HTML email content more concise, keeping the key information.",
};

function buildPrompt(input: {
	action: string;
	html: string;
	instruction?: string;
}): string {
	if (input.action === "write") {
		return `Write the HTML body of a form-submission email. What it should say: ${
			input.instruction ||
			"a friendly note letting the recipient know about this form submission"
		}`;
	}
	if (input.action === "translate") {
		const language = input.instruction || "Spanish";
		return `Translate the following HTML email content into ${language}, keeping the same HTML structure and any field-mention spans untouched:\n\n${input.html}`;
	}
	const instruction = ACTION_VERBS[input.action] ?? ACTION_VERBS.improve;
	return `${instruction}\n\n${input.html}`;
}
