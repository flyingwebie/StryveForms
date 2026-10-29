import { twoFactor, user } from "@StryveForms/db/schema/auth";
import { instanceSettings } from "@StryveForms/db/schema/forms";
import {
	EMAIL_TEMPLATE_CATALOG,
	emailPreviewElement,
	emailTemplateIdSchema,
	renderEmailPreview,
} from "@StryveForms/emails/preview";
import {
	type EmailSettings,
	emailSettingsSchema,
	resolveEmailSettings,
} from "@StryveForms/emails/settings";
import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure, router } from "../index";
import {
	agentSettingsSchema,
	resolveAgentSettings,
} from "../services/agent/settings";
import {
	createApiToken,
	listApiTokens,
	revokeApiToken,
	TOKEN_SCOPES,
} from "../services/agent/tokens";
import {
	type AgentContext,
	createEmailNotification,
	createEmailNotificationInput,
	createForm,
	createFormInput,
	createIntegration,
	createIntegrationInput,
	deleteEmailNotification,
	deleteEmailNotificationInput,
	deleteIntegration,
	deleteIntegrationInput,
	exportSubmissionsCsvLink,
	exportSubmissionsCsvLinkInput,
	getForm,
	getFormInput,
	getSubmission,
	getSubmissionInput,
	getSubmissionStats,
	getSubmissionStatsInput,
	listEmailNotifications,
	listEmailNotificationsInput,
	listForms,
	listFormsInput,
	listIntegrations,
	listIntegrationsInput,
	listIntegrationTypes,
	listIntegrationTypesInput,
	listSenders,
	listSendersInput,
	listSubmissions,
	listSubmissionsInput,
	listWorkspaces,
	previewEmailNotification,
	previewEmailNotificationInput,
	sendTestEmailNotificationInput,
	sendTestEmailNotificationTool,
	setFormVisibility,
	setFormVisibilityInput,
	testIntegration,
	testIntegrationInput,
	updateEmailNotification,
	updateEmailNotificationInput,
	updateFormFields,
	updateFormFieldsInput,
	updateFormSettings,
	updateFormSettingsInput,
	updateIntegration,
	updateIntegrationInput,
} from "../services/agent/tools";
import {
	clearInstanceCache,
	emailBranding,
	getInstanceSettings,
	hasUsers,
	INSTANCE_ID,
} from "../services/instance";

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

/** Only instance administrators. */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (!(ctx.session.user as { isAdmin?: boolean }).isAdmin) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only administrators can do this",
		});
	}
	return next();
});

const settingsInput = z
	.object({
		name: z.string().min(1).max(80),
		tagline: z.string().max(200).nullable(),
		logoUrl: z.string().max(2000).nullable(),
		logoDarkUrl: z.string().max(2000).nullable(),
		faviconUrl: z.string().max(2000).nullable(),
		faviconDarkUrl: z.string().max(2000).nullable(),
		primaryColor: z.string().regex(HEX_COLOR),
		primaryColorDark: z.string().regex(HEX_COLOR).nullable(),
		heroTitle: z.string().max(200).nullable(),
		heroSubtitle: z.string().max(500).nullable(),
		registrationMode: z.enum(["open", "closed"]),
		allowedEmailDomains: z.array(z.string().regex(DOMAIN).max(253)).max(50),
		supportEmail: z.string().email().nullable().or(z.literal("")),
	})
	.partial();

const MAX_TOKEN_EXPIRY_DAYS = 3650;
const DAY_MS = 86_400_000;

function agentContextOf(ctx: {
	db: unknown;
	services: unknown;
	session: { user: { id: string } };
}): AgentContext {
	return {
		db: ctx.db as AgentContext["db"],
		services: ctx.services as AgentContext["services"],
		userId: ctx.session.user.id,
	};
}

/**
 * Everything the CLI and the Settings/Admin "Developers" UI need for the AI
 * agents & MCP feature. Nested here (rather than as a new top-level router)
 * because routers/index.ts is locked for this round — see the file-ownership
 * note in AGENTS.md's accompanying brief. The `data.*` procedures are the
 * CLI's whole backend: they call the exact same services/agent/tools.ts
 * functions the MCP server calls (one service layer, two front-ends).
 */
const agentRouter = router({
	/** Instance-wide toggle, admin only. */
	settings: router({
		get: adminProcedure.query(async ({ ctx }) => {
			const settings = await getInstanceSettings(ctx.db);
			return resolveAgentSettings(settings.agentSettings);
		}),
		update: adminProcedure
			.input(
				agentSettingsSchema
					.pick({
						allowApiTokens: true,
						allowWriteTools: true,
						mcpEnabled: true,
					})
					.partial()
			)
			.mutation(async ({ ctx, input }) => {
				const current = await getInstanceSettings(ctx.db);
				const next = {
					...resolveAgentSettings(current.agentSettings),
					...input,
				};
				await ctx.db
					.update(instanceSettings)
					.set({ agentSettings: next })
					.where(eq(instanceSettings.id, INSTANCE_ID));
				clearInstanceCache();
				return next;
			}),
	}),

	/** What the non-admin "API tokens / Developers" settings page needs to decide whether to show MCP instructions. */
	publicInfo: protectedProcedure.query(async ({ ctx }) => {
		const settings = await getInstanceSettings(ctx.db);
		const resolved = resolveAgentSettings(settings.agentSettings);
		return {
			allowApiTokens: resolved.allowApiTokens,
			mcpEnabled: resolved.mcpEnabled,
			serverUrl: ctx.services.config.serverUrl,
		};
	}),

	/** Personal API tokens (Settings → API tokens). Always scoped to the calling user. */
	tokens: router({
		list: protectedProcedure.query(({ ctx }) =>
			listApiTokens(ctx.db, ctx.session.user.id)
		),
		create: protectedProcedure
			.input(
				z.object({
					expiresInDays: z
						.number()
						.int()
						.min(1)
						.max(MAX_TOKEN_EXPIRY_DAYS)
						.nullable(),
					name: z.string().min(1).max(100),
					scope: z.enum(TOKEN_SCOPES),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const settings = await getInstanceSettings(ctx.db);
				if (!resolveAgentSettings(settings.agentSettings).allowApiTokens) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Personal API tokens are disabled on this instance.",
					});
				}
				return createApiToken(ctx.db, ctx.session.user.id, {
					expiresAt: input.expiresInDays
						? new Date(Date.now() + input.expiresInDays * DAY_MS)
						: null,
					name: input.name,
					scope: input.scope,
				});
			}),
		revoke: protectedProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const ok = await revokeApiToken(ctx.db, ctx.session.user.id, input.id);
				if (!ok) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Token not found",
					});
				}
				return { ok: true };
			}),
	}),

	/** The CLI's backend — same functions the MCP server's tools call. */
	data: router({
		workspaces: router({
			list: protectedProcedure.query(({ ctx }) =>
				listWorkspaces(agentContextOf(ctx))
			),
		}),
		forms: router({
			create: protectedProcedure
				.input(createFormInput)
				.mutation(({ ctx, input }) => createForm(agentContextOf(ctx), input)),
			get: protectedProcedure
				.input(getFormInput)
				.query(({ ctx, input }) => getForm(agentContextOf(ctx), input)),
			list: protectedProcedure
				.input(listFormsInput)
				.query(({ ctx, input }) => listForms(agentContextOf(ctx), input)),
			setVisibility: protectedProcedure
				.input(setFormVisibilityInput)
				.mutation(({ ctx, input }) =>
					setFormVisibility(agentContextOf(ctx), input)
				),
			updateFields: protectedProcedure
				.input(updateFormFieldsInput)
				.mutation(({ ctx, input }) =>
					updateFormFields(agentContextOf(ctx), input)
				),
			updateSettings: protectedProcedure
				.input(updateFormSettingsInput)
				.mutation(({ ctx, input }) =>
					updateFormSettings(agentContextOf(ctx), input)
				),
		}),
		integrations: router({
			create: protectedProcedure
				.input(createIntegrationInput)
				.mutation(({ ctx, input }) =>
					createIntegration(agentContextOf(ctx), input)
				),
			delete: protectedProcedure
				.input(deleteIntegrationInput)
				.mutation(({ ctx, input }) =>
					deleteIntegration(agentContextOf(ctx), input)
				),
			list: protectedProcedure
				.input(listIntegrationsInput)
				.query(({ ctx, input }) =>
					listIntegrations(agentContextOf(ctx), input)
				),
			test: protectedProcedure
				.input(testIntegrationInput)
				.mutation(({ ctx, input }) =>
					testIntegration(agentContextOf(ctx), input)
				),
			types: protectedProcedure
				.input(listIntegrationTypesInput)
				.query(({ ctx }) => listIntegrationTypes(agentContextOf(ctx))),
			update: protectedProcedure
				.input(updateIntegrationInput)
				.mutation(({ ctx, input }) =>
					updateIntegration(agentContextOf(ctx), input)
				),
		}),
		notifications: router({
			create: protectedProcedure
				.input(createEmailNotificationInput)
				.mutation(({ ctx, input }) =>
					createEmailNotification(agentContextOf(ctx), input)
				),
			delete: protectedProcedure
				.input(deleteEmailNotificationInput)
				.mutation(({ ctx, input }) =>
					deleteEmailNotification(agentContextOf(ctx), input)
				),
			list: protectedProcedure
				.input(listEmailNotificationsInput)
				.query(({ ctx, input }) =>
					listEmailNotifications(agentContextOf(ctx), input)
				),
			preview: protectedProcedure
				.input(previewEmailNotificationInput)
				.query(({ ctx, input }) =>
					previewEmailNotification(agentContextOf(ctx), input)
				),
			sendTest: protectedProcedure
				.input(sendTestEmailNotificationInput)
				.mutation(({ ctx, input }) =>
					sendTestEmailNotificationTool(agentContextOf(ctx), input)
				),
			update: protectedProcedure
				.input(updateEmailNotificationInput)
				.mutation(({ ctx, input }) =>
					updateEmailNotification(agentContextOf(ctx), input)
				),
		}),
		senders: router({
			list: protectedProcedure
				.input(listSendersInput)
				.query(({ ctx, input }) => listSenders(agentContextOf(ctx), input)),
		}),
		submissions: router({
			exportLink: protectedProcedure
				.input(exportSubmissionsCsvLinkInput)
				.query(({ ctx, input }) =>
					exportSubmissionsCsvLink(agentContextOf(ctx), input)
				),
			get: protectedProcedure
				.input(getSubmissionInput)
				.query(({ ctx, input }) => getSubmission(agentContextOf(ctx), input)),
			list: protectedProcedure
				.input(listSubmissionsInput)
				.query(({ ctx, input }) => listSubmissions(agentContextOf(ctx), input)),
			stats: protectedProcedure
				.input(getSubmissionStatsInput)
				.query(({ ctx, input }) =>
					getSubmissionStats(agentContextOf(ctx), input)
				),
		}),
	}),
});

export const instanceRouter = router({
	/** Public branding and access info for the sign-in page and the whole UI. */
	public: publicProcedure.query(async ({ ctx }) => {
		const [settings, anyUsers] = await Promise.all([
			getInstanceSettings(ctx.db),
			hasUsers(ctx.db),
		]);
		const agent = resolveAgentSettings(settings.agentSettings);
		return {
			/** What `stryveforms login` needs before the user is signed in: whether to even try the device flow, and its public client id. */
			agent: {
				cliClientId: agent.cliClientId,
				mcpEnabled: agent.mcpEnabled,
				serverUrl: ctx.services.config.serverUrl,
			},
			faviconDarkUrl: settings.faviconDarkUrl,
			faviconUrl: settings.faviconUrl,
			heroSubtitle: settings.heroSubtitle,
			heroTitle: settings.heroTitle,
			logoDarkUrl: settings.logoDarkUrl,
			logoUrl: settings.logoUrl,
			name: settings.name,
			primaryColor: settings.primaryColor,
			primaryColorDark: settings.primaryColorDark,
			registrationOpen: settings.registrationMode === "open",
			allowedEmailDomains: settings.allowedEmailDomains,
			/** True on a brand-new installation: the first visitor creates the admin account. */
			setupRequired: !anyUsers,
			/** False until the admin finishes the onboarding wizard. */
			setupCompleted: settings.setupCompletedAt !== null,
			supportEmail: settings.supportEmail,
			tagline: settings.tagline,
		};
	}),

	get: adminProcedure.query(({ ctx }) => getInstanceSettings(ctx.db)),

	update: adminProcedure
		.input(settingsInput)
		.mutation(async ({ ctx, input }) => {
			await getInstanceSettings(ctx.db);
			const values = {
				...input,
				allowedEmailDomains: input.allowedEmailDomains?.map((d) =>
					d.toLowerCase()
				),
				supportEmail: input.supportEmail === "" ? null : input.supportEmail,
			};
			await ctx.db
				.update(instanceSettings)
				.set(values)
				.where(eq(instanceSettings.id, INSTANCE_ID));
			clearInstanceCache();
			return getInstanceSettings(ctx.db);
		}),

	/** Marks the onboarding wizard as done. */
	completeSetup: adminProcedure.mutation(async ({ ctx }) => {
		await getInstanceSettings(ctx.db);
		await ctx.db
			.update(instanceSettings)
			.set({ setupCompletedAt: new Date() })
			.where(eq(instanceSettings.id, INSTANCE_ID));
		clearInstanceCache();
		return { ok: true };
	}),

	users: adminProcedure.query(({ ctx }) =>
		ctx.db
			.select({
				createdAt: user.createdAt,
				email: user.email,
				id: user.id,
				image: user.image,
				isAdmin: user.isAdmin,
				name: user.name,
				twoFactorEnabled: user.twoFactorEnabled,
			})
			.from(user)
			.orderBy(asc(user.createdAt))
	),

	setAdmin: adminProcedure
		.input(z.object({ userId: z.string(), isAdmin: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			if (!input.isAdmin) {
				const [others] = await ctx.db
					.select({ n: count() })
					.from(user)
					.where(and(eq(user.isAdmin, true), ne(user.id, input.userId)));
				if ((others?.n ?? 0) === 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "There must be at least one administrator",
					});
				}
			}
			await ctx.db
				.update(user)
				.set({ isAdmin: input.isAdmin })
				.where(eq(user.id, input.userId));
			return { ok: true };
		}),

	deleteUser: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			if (input.userId === ctx.session.user.id) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You can't delete your own account here",
				});
			}
			await ctx.db.delete(user).where(eq(user.id, input.userId));
			return { ok: true };
		}),

	/**
	 * Recovery path for a user who lost both their authenticator app and
	 * their backup codes: an instance admin can clear their TOTP enrollment
	 * so they can sign in with just their password again (and set up 2FA
	 * fresh afterwards). Passkeys aren't affected — they're never required to
	 * sign in, so they can't lock anyone out on their own.
	 */
	resetTwoFactor: adminProcedure
		.input(z.object({ userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(twoFactor).where(eq(twoFactor.userId, input.userId));
			await ctx.db
				.update(user)
				.set({ twoFactorEnabled: false })
				.where(eq(user.id, input.userId));
			return { ok: true };
		}),

	/** The saved email wrapper design (colours, logo, footer…), with defaults filled in. */
	emailSettings: adminProcedure.query(async ({ ctx }) => {
		const settings = await getInstanceSettings(ctx.db);
		// Unsaved values follow the instance branding, like real emails do.
		return resolveEmailSettings({
			accentColor: settings.primaryColor,
			logoDarkUrl: settings.logoDarkUrl,
			logoUrl: settings.logoUrl,
			...(settings.emailSettings as Partial<EmailSettings>),
		});
	}),

	updateEmailSettings: adminProcedure
		.input(emailSettingsSchema)
		.mutation(async ({ ctx, input }) => {
			await getInstanceSettings(ctx.db);
			await ctx.db
				.update(instanceSettings)
				.set({ emailSettings: input })
				.where(eq(instanceSettings.id, INSTANCE_ID));
			clearInstanceCache();
			return resolveEmailSettings(input);
		}),

	/** Templates the admin can preview/test, for the switcher in the Emails tab. */
	emailTemplates: adminProcedure.query(() => EMAIL_TEMPLATE_CATALOG),

	/** Renders a template with sample data, applying an optional unsaved settings draft. */
	emailPreview: adminProcedure
		.input(
			z.object({
				colorScheme: z.enum(["light", "dark"]).optional(),
				settings: emailSettingsSchema.optional(),
				template: emailTemplateIdSchema,
			})
		)
		.query(async ({ ctx, input }) => {
			const branding = await emailBranding(ctx.db, ctx.services.config);
			return renderEmailPreview(
				input.template,
				{
					...branding,
					...input.settings,
				},
				{ colorScheme: input.colorScheme }
			);
		}),

	/** Sends a real sample email to the admin (or `to`), using the configured mailer. */
	sendTestEmail: adminProcedure
		.input(
			z.object({
				settings: emailSettingsSchema.optional(),
				template: emailTemplateIdSchema,
				to: z.string().email().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const branding = await emailBranding(ctx.db, ctx.services.config);
			const { element, subject } = emailPreviewElement(input.template, {
				...branding,
				...input.settings,
			});
			const to = input.to || ctx.session.user.email;
			await ctx.services.mailer.send({
				react: element,
				subject: `[Test] ${subject}`,
				to,
			});
			return {
				message: ctx.services.mailer.logOnly
					? "SMTP isn't configured — the test email was logged on the server instead of being delivered."
					: `Test email sent to ${to}.`,
			};
		}),

	/** AI agents & MCP: instance settings, personal API tokens, and the CLI's backend. */
	agent: agentRouter,
});
