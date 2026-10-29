import { aiChat, aiCredential } from "@StryveForms/db/schema/features";
import { form as formTable } from "@StryveForms/db/schema/forms";
import { chat as runChat } from "@tanstack/ai";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireForm, requireWorkspace } from "../lib/access";
import { newId } from "../lib/ids";
import {
	decryptApiKey,
	encryptApiKey,
	maskApiKey,
} from "../services/ai/crypto";
import { fetchProviderModels } from "../services/ai/model-fetch";
import {
	AI_PROVIDERS,
	buildTextAdapter,
	DEFAULT_MODELS,
} from "../services/ai/providers";

const providerSchema = z.enum(AI_PROVIDERS);
const TEST_TIMEOUT_MS = 20_000;
const MAX_MESSAGES = 1000;

/** Loads a chat the caller owns, in a workspace they're a member of. */
async function requireChat(
	db: Parameters<typeof requireWorkspace>[0],
	chatId: string,
	userId: string
) {
	const [row] = await db
		.select()
		.from(aiChat)
		.where(eq(aiChat.id, chatId))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
	}
	await requireWorkspace(db, row.workspaceId, userId);
	// Chats are personal scratchpads: only their owner can see or edit them.
	if (row.userId !== userId) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
	}
	return row;
}

export const aiRouter = router({
	chat: router({
		create: protectedProcedure
			.input(
				z.object({
					formId: z.string().optional(),
					workspaceId: z.string(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				await requireWorkspace(
					ctx.db,
					input.workspaceId,
					ctx.session.user.id,
					"view",
					"use_ai_assistant"
				);
				if (input.formId) {
					await requireForm(ctx.db, input.formId, ctx.session.user.id);
				}
				const id = newId();
				await ctx.db.insert(aiChat).values({
					formId: input.formId ?? null,
					id,
					userId: ctx.session.user.id,
					workspaceId: input.workspaceId,
				});
				return { id };
			}),

		delete: protectedProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				await requireChat(ctx.db, input.id, ctx.session.user.id);
				await ctx.db.delete(aiChat).where(eq(aiChat.id, input.id));
				return { ok: true };
			}),

		get: protectedProcedure
			.input(z.object({ id: z.string() }))
			.query(async ({ ctx, input }) => {
				const row = await requireChat(ctx.db, input.id, ctx.session.user.id);
				return {
					formId: row.formId,
					id: row.id,
					messages: row.messages,
					title: row.title,
					updatedAt: row.updatedAt.toISOString(),
					workspaceId: row.workspaceId,
				};
			}),

		list: protectedProcedure
			.input(
				z.object({
					/** Narrows the list to one form's chats — used by the editor's AI tab. */
					formId: z.string().optional(),
					workspaceId: z.string(),
				})
			)
			.query(async ({ ctx, input }) => {
				await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
				const filters = [
					eq(aiChat.workspaceId, input.workspaceId),
					eq(aiChat.userId, ctx.session.user.id),
				];
				if (input.formId) {
					filters.push(eq(aiChat.formId, input.formId));
				}
				const rows = await ctx.db
					.select({
						formId: aiChat.formId,
						// Shown under the chat title so a form's chat stands out at a glance.
						formTitle: formTable.title,
						id: aiChat.id,
						title: aiChat.title,
						updatedAt: aiChat.updatedAt,
					})
					.from(aiChat)
					.leftJoin(formTable, eq(formTable.id, aiChat.formId))
					.where(and(...filters))
					.orderBy(desc(aiChat.updatedAt))
					.limit(100);
				return rows.map((r) => ({
					...r,
					updatedAt: r.updatedAt.toISOString(),
				}));
			}),

		rename: protectedProcedure
			.input(z.object({ id: z.string(), title: z.string().min(1).max(200) }))
			.mutation(async ({ ctx, input }) => {
				await requireChat(ctx.db, input.id, ctx.session.user.id);
				await ctx.db
					.update(aiChat)
					.set({ title: input.title })
					.where(eq(aiChat.id, input.id));
				return { ok: true };
			}),

		/** Attaches, switches, or detaches (formId: null) the form the chat is focused on. */
		setFormContext: protectedProcedure
			.input(z.object({ formId: z.string().nullable(), id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				await requireChat(ctx.db, input.id, ctx.session.user.id);
				let formTitle: string | null = null;
				if (input.formId) {
					const { form } = await requireForm(
						ctx.db,
						input.formId,
						ctx.session.user.id
					);
					formTitle = form.title;
				}
				await ctx.db
					.update(aiChat)
					.set({ formId: input.formId })
					.where(eq(aiChat.id, input.id));
				return { formTitle, ok: true };
			}),

		/** Persists the full message transcript. The client calls this after each turn settles. */
		saveMessages: protectedProcedure
			.input(
				z.object({
					id: z.string(),
					messages: z.array(z.unknown()).max(MAX_MESSAGES),
					title: z.string().min(1).max(200).optional(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				await requireChat(ctx.db, input.id, ctx.session.user.id);
				await ctx.db
					.update(aiChat)
					.set({
						messages: input.messages,
						...(input.title ? { title: input.title } : {}),
					})
					.where(eq(aiChat.id, input.id));
				return { ok: true };
			}),
	}),

	credential: router({
		get: protectedProcedure
			.input(z.object({ workspaceId: z.string() }))
			.query(async ({ ctx, input }) => {
				await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
				const [row] = await ctx.db
					.select()
					.from(aiCredential)
					.where(eq(aiCredential.workspaceId, input.workspaceId))
					.limit(1);
				if (!row) {
					return null;
				}
				let lastFour: string | null = null;
				if (row.encryptedKey) {
					try {
						const plaintext = decryptApiKey(
							ctx.services.config.signingSecret,
							row.encryptedKey
						);
						lastFour = maskApiKey(plaintext);
					} catch {
						lastFour = null;
					}
				}
				return {
					baseUrl: row.baseUrl,
					hasKey: Boolean(row.encryptedKey),
					lastFour,
					model: row.model,
					provider: row.provider,
				};
			}),

		/**
		 * Lists the provider's available chat models, so the settings UI can
		 * auto-fetch them as soon as a key (and base URL, for OpenAI-compatible
		 * / Ollama) is entered — before the credential is saved. Falls back to
		 * the already-saved key/base URL when the caller omits them, so a
		 * configured credential can still be re-listed (e.g. after the model
		 * list changed upstream).
		 */
		models: protectedProcedure
			.input(
				z.object({
					apiKey: z.string().min(1).max(2000).optional(),
					baseUrl: z.string().url().max(500).optional().nullable(),
					provider: providerSchema,
					workspaceId: z.string(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				await requireWorkspace(
					ctx.db,
					input.workspaceId,
					ctx.session.user.id,
					"manage"
				);
				let apiKey = input.apiKey ?? null;
				let baseUrl = input.baseUrl ?? null;
				if (!(apiKey && baseUrl)) {
					const [existing] = await ctx.db
						.select({
							baseUrl: aiCredential.baseUrl,
							encryptedKey: aiCredential.encryptedKey,
							provider: aiCredential.provider,
						})
						.from(aiCredential)
						.where(eq(aiCredential.workspaceId, input.workspaceId))
						.limit(1);
					if (existing && existing.provider === input.provider) {
						if (!apiKey && existing.encryptedKey) {
							apiKey = decryptApiKey(
								ctx.services.config.signingSecret,
								existing.encryptedKey
							);
						}
						baseUrl ??= existing.baseUrl;
					}
				}
				try {
					const models = await fetchProviderModels({
						apiKey,
						baseUrl,
						provider: input.provider,
					});
					return { models };
				} catch (error) {
					// biome-ignore lint/style/useErrorCause: TRPCError takes the cause in its options object
					throw new TRPCError({
						cause: error,
						code: "BAD_REQUEST",
						message:
							error instanceof Error ? error.message : "Could not list models",
					});
				}
			}),

		/** Removes the stored key — the model and base URL stay so the form just needs re-authorizing. */
		remove: protectedProcedure
			.input(z.object({ workspaceId: z.string() }))
			.mutation(async ({ ctx, input }) => {
				await requireWorkspace(
					ctx.db,
					input.workspaceId,
					ctx.session.user.id,
					"manage"
				);
				await ctx.db
					.delete(aiCredential)
					.where(eq(aiCredential.workspaceId, input.workspaceId));
				return { ok: true };
			}),

		save: protectedProcedure
			.input(
				z.object({
					apiKey: z.string().min(1).max(2000).optional(),
					baseUrl: z.string().url().max(500).optional().nullable(),
					model: z.string().min(1).max(200),
					provider: providerSchema,
					workspaceId: z.string(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				await requireWorkspace(
					ctx.db,
					input.workspaceId,
					ctx.session.user.id,
					"manage"
				);
				const [existing] = await ctx.db
					.select({
						encryptedKey: aiCredential.encryptedKey,
						id: aiCredential.id,
					})
					.from(aiCredential)
					.where(eq(aiCredential.workspaceId, input.workspaceId))
					.limit(1);
				const encryptedKey = input.apiKey
					? encryptApiKey(ctx.services.config.signingSecret, input.apiKey)
					: (existing?.encryptedKey ?? null);
				if (existing) {
					await ctx.db
						.update(aiCredential)
						.set({
							baseUrl: input.baseUrl ?? null,
							encryptedKey,
							model: input.model,
							provider: input.provider,
						})
						.where(eq(aiCredential.id, existing.id));
				} else {
					await ctx.db.insert(aiCredential).values({
						baseUrl: input.baseUrl ?? null,
						createdBy: ctx.session.user.id,
						encryptedKey,
						id: newId(),
						model: input.model,
						provider: input.provider,
						workspaceId: input.workspaceId,
					});
				}
				return { ok: true };
			}),

		/** A good-faith "is this reachable" check: sends one short prompt and reports whether a reply came back. */
		test: protectedProcedure
			.input(
				z.object({
					apiKey: z.string().min(1).max(2000).optional(),
					baseUrl: z.string().url().max(500).optional().nullable(),
					model: z.string().min(1).max(200),
					provider: providerSchema,
					workspaceId: z.string(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				await requireWorkspace(
					ctx.db,
					input.workspaceId,
					ctx.session.user.id,
					"manage"
				);
				let apiKey = input.apiKey ?? null;
				if (!apiKey) {
					const [existing] = await ctx.db
						.select({ encryptedKey: aiCredential.encryptedKey })
						.from(aiCredential)
						.where(eq(aiCredential.workspaceId, input.workspaceId))
						.limit(1);
					if (existing?.encryptedKey) {
						apiKey = decryptApiKey(
							ctx.services.config.signingSecret,
							existing.encryptedKey
						);
					}
				}
				const abortController = new AbortController();
				const timeout = setTimeout(
					() => abortController.abort(),
					TEST_TIMEOUT_MS
				);
				try {
					const adapter = buildTextAdapter({
						apiKey,
						baseUrl: input.baseUrl ?? null,
						model: input.model,
						provider: input.provider,
					});
					const result = await runChat({
						abortController,
						adapter,
						messages: [
							{ content: "Reply with exactly one word: OK", role: "user" },
						],
						stream: false,
						threadId: `connection-test-${newId()}`,
					});
					return { ok: true, reply: result.text.trim().slice(0, 100) };
				} catch (error) {
					return {
						ok: false,
						reply: error instanceof Error ? error.message : "Connection failed",
					};
				} finally {
					clearTimeout(timeout);
				}
			}),
	}),

	/** Default models shown per provider, for the settings form. */
	defaultModels: protectedProcedure.query(() => DEFAULT_MODELS),
});
