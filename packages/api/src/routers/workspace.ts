import { user } from "@StryveForms/db/schema/auth";
import {
	form,
	workspace,
	workspaceInvite,
	workspaceMember,
} from "@StryveForms/db/schema/forms";
import { emails } from "@StryveForms/emails/messages";
import { workspaceBrandSchema } from "@StryveForms/forms/brand";
import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import {
	CAPABILITIES,
	effectiveCapabilityMatrix,
	type RolePermissionOverrides,
	requireWorkspace,
} from "../lib/access";
import { newId, newPublicId } from "../lib/ids";
import { emailBranding } from "../services/instance";
import {
	getDefaultSenderId,
	listSenders,
	senderSchema,
} from "../services/senders";

const roleSchema = z.enum(["admin", "user", "readonly"]);
const INVITE_TTL_DAYS = 7;
const DAY_MS = 86_400_000;

/** None = plain, SSL/TLS = implicit from the start (usually 465), STARTTLS = upgrades after connecting (usually 587). */
const smtpEncryptionSchema = z.enum(["none", "ssl", "starttls"]);

const roleOverrideShape = Object.fromEntries(
	CAPABILITIES.map((c) => [c.key, z.boolean().optional()])
) as Record<(typeof CAPABILITIES)[number]["key"], z.ZodOptional<z.ZodBoolean>>;
const roleOverrideSchema = z.object(roleOverrideShape).partial();
/** Matches `RolePermissionOverrides`: both roles are optional, as is every capability within them. */
const rolePermissionOverridesSchema = z
	.object({ readonly: roleOverrideSchema, user: roleOverrideSchema })
	.partial()
	.optional();

const workspaceSettingsSchema = z
	.object({
		emailSettings: z
			.object({
				replyTo: z.string().email().optional().or(z.literal("")),
				senderName: z.string().max(100).optional(),
			})
			.partial()
			.optional(),
		customCode: z.string().max(50_000).optional(),
		customCss: z.string().max(50_000).optional(),
		/** The workspace's "From" identities. One is the default; see `defaultSenderId`. */
		senders: z.array(senderSchema).max(20).optional(),
		/** Which sender in `senders` is used when a notification doesn't pick one. */
		defaultSenderId: z.string().nullable().optional(),
		/** Per-role overrides for the "Roles & permissions" capability matrix. */
		rolePermissions: rolePermissionOverridesSchema,
		/** Workspace's own SMTP server for notification emails. Send `password: undefined` to keep the saved one. */
		smtp: z
			.object({
				encryption: smtpEncryptionSchema,
				host: z.string().max(253),
				password: z.string().max(500).optional(),
				port: z.number().int().min(1).max(65_535),
				senderAddress: z.string().email().optional().or(z.literal("")),
				username: z.string().max(253),
			})
			.nullable()
			.optional(),
		externalFileLinks: z
			.object({
				expiresInHours: z
					.number()
					.int()
					.min(1)
					.max(24 * 30),
			})
			.partial()
			.optional(),
	})
	.partial();

/** Never send the SMTP password back to the browser; resolve the effective senders list for the UI. */
function publicSettings(settings: Record<string, unknown>) {
	const smtp = settings.smtp as Record<string, unknown> | null | undefined;
	const senders = listSenders(settings);
	return {
		...settings,
		defaultSenderId: getDefaultSenderId(settings) ?? null,
		senders,
		...(smtp
			? {
					smtp: (() => {
						const { password, ...rest } = smtp;
						return { ...rest, hasPassword: Boolean(password) };
					})(),
				}
			: {}),
	};
}

/** Keeps the stored SMTP password when the update leaves it out. */
function mergeSmtp(
	current: Record<string, unknown>,
	next: z.infer<typeof workspaceSettingsSchema>["smtp"]
): Record<string, unknown> | null | undefined {
	if (next === undefined || next === null) {
		return next;
	}
	const saved = current.smtp as { password?: string } | null | undefined;
	return { ...next, password: next.password ?? saved?.password };
}

export const workspaceRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db
			.select({
				id: workspace.id,
				name: workspace.name,
				icon: workspace.icon,
				// Just the brand colour (not the whole guideline) — the icon
				// picker tints a Lucide workspace icon with it.
				brand: workspace.brand,
				role: workspaceMember.role,
				createdAt: workspace.createdAt,
			})
			.from(workspaceMember)
			.innerJoin(workspace, eq(workspace.id, workspaceMember.workspaceId))
			.where(eq(workspaceMember.userId, ctx.session.user.id))
			.orderBy(workspace.createdAt);

		const ids = rows.map((r) => r.id);
		const formCounts =
			ids.length === 0
				? []
				: await ctx.db
						.select({ workspaceId: form.workspaceId, total: count() })
						.from(form)
						.where(and(inArray(form.workspaceId, ids), isNull(form.deletedAt)))
						.groupBy(form.workspaceId);
		const countsById = new Map(formCounts.map((c) => [c.workspaceId, c.total]));
		return rows.map(({ brand, ...r }) => ({
			...r,
			brandColor: (brand as { color?: string } | null)?.color ?? null,
			formsCount: countsById.get(r.id) ?? 0,
		}));
	}),

	get: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const membership = await requireWorkspace(
				ctx.db,
				input.id,
				ctx.session.user.id
			);
			const [row] = await ctx.db
				.select()
				.from(workspace)
				.where(eq(workspace.id, input.id));
			if (!row) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Workspace not found",
				});
			}
			return {
				...row,
				role: membership.role,
				settings: publicSettings(row.settings),
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				// Plain emoji, or "lucide:<icon-name>" — some Lucide names run long.
				icon: z.string().max(40).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const id = newId();
			await ctx.db.transaction(async (tx) => {
				await tx
					.insert(workspace)
					.values({ id, name: input.name, icon: input.icon ?? "📝" });
				await tx.insert(workspaceMember).values({
					workspaceId: id,
					userId: ctx.session.user.id,
					role: "admin",
				});
			});
			return { id };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(100).optional(),
				// Plain emoji, or "lucide:<icon-name>" — some Lucide names run long.
				icon: z.string().max(40).nullable().optional(),
				settings: workspaceSettingsSchema.optional(),
				customDomains: z.array(z.string().max(253)).max(20).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"manage",
				"manage_workspace"
			);
			const { id, settings, ...rest } = input;
			let patch: Record<string, unknown> | undefined;
			if (settings) {
				const [current] = await ctx.db
					.select({ settings: workspace.settings })
					.from(workspace)
					.where(eq(workspace.id, id));
				patch = { ...settings };
				if ("smtp" in settings) {
					patch.smtp = mergeSmtp(current?.settings ?? {}, settings.smtp);
				}
			}
			await ctx.db
				.update(workspace)
				.set({
					...rest,
					...(patch
						? {
								settings: sql`${workspace.settings} || ${JSON.stringify(patch)}::jsonb`,
							}
						: {}),
				})
				.where(eq(workspace.id, id));
			return { ok: true };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(ctx.db, input.id, ctx.session.user.id, "manage");
			const [{ total } = { total: 0 }] = await ctx.db
				.select({ total: count() })
				.from(workspaceMember)
				.where(eq(workspaceMember.userId, ctx.session.user.id));
			if (total <= 1) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You can't delete your only workspace",
				});
			}
			await ctx.db.delete(workspace).where(eq(workspace.id, input.id));
			return { ok: true };
		}),

	members: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
			const [members, invites] = await Promise.all([
				ctx.db
					.select({
						userId: user.id,
						name: user.name,
						email: user.email,
						image: user.image,
						role: workspaceMember.role,
						joinedAt: workspaceMember.createdAt,
					})
					.from(workspaceMember)
					.innerJoin(user, eq(user.id, workspaceMember.userId))
					.where(eq(workspaceMember.workspaceId, input.workspaceId)),
				ctx.db
					.select({
						id: workspaceInvite.id,
						email: workspaceInvite.email,
						role: workspaceInvite.role,
						expiresAt: workspaceInvite.expiresAt,
					})
					.from(workspaceInvite)
					.where(
						and(
							eq(workspaceInvite.workspaceId, input.workspaceId),
							eq(workspaceInvite.status, "pending")
						)
					),
			]);
			return { invites, members };
		}),

	invite: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				email: z.string().email(),
				role: roleSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"manage",
				"manage_members"
			);
			const email = input.email.toLowerCase();
			const [existingUser] = await ctx.db
				.select()
				.from(user)
				.where(eq(user.email, email));

			if (existingUser) {
				await ctx.db
					.insert(workspaceMember)
					.values({
						workspaceId: input.workspaceId,
						userId: existingUser.id,
						role: input.role,
					})
					.onConflictDoNothing();
				return { status: "added" as const };
			}

			const [ws] = await ctx.db
				.select()
				.from(workspace)
				.where(eq(workspace.id, input.workspaceId));
			const token = newPublicId();
			await ctx.db.insert(workspaceInvite).values({
				id: newId(),
				workspaceId: input.workspaceId,
				email,
				role: input.role,
				token,
				invitedById: ctx.session.user.id,
				expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY_MS),
			});
			const { config } = ctx.services;
			const branding = await emailBranding(ctx.db, config, {
				workspaceId: input.workspaceId,
			});
			await ctx.services.mailer.send({
				to: email,
				subject: `You're invited to ${ws?.name ?? "a workspace"} on ${branding.appName}`,
				react: emails.workspaceInvite({
					branding,
					inviteUrl: `${config.appUrl}/invites/${token}`,
					inviterName: ctx.session.user.name,
					workspaceName: ws?.name ?? "Workspace",
				}),
			});
			return { status: "invited" as const };
		}),

	cancelInvite: protectedProcedure
		.input(z.object({ workspaceId: z.string(), inviteId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"manage",
				"manage_members"
			);
			await ctx.db
				.update(workspaceInvite)
				.set({ status: "cancelled" })
				.where(
					and(
						eq(workspaceInvite.id, input.inviteId),
						eq(workspaceInvite.workspaceId, input.workspaceId)
					)
				);
			return { ok: true };
		}),

	/** Joins the workspace of an invite link. The signed-in email must match the invite. */
	acceptInvite: protectedProcedure
		.input(z.object({ token: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const [invite] = await ctx.db
				.select()
				.from(workspaceInvite)
				.where(
					and(
						eq(workspaceInvite.token, input.token),
						eq(workspaceInvite.status, "pending")
					)
				);
			if (!invite || invite.expiresAt < new Date()) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "This invite is invalid or expired",
				});
			}
			if (invite.email !== ctx.session.user.email.toLowerCase()) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: `This invite was sent to ${invite.email}. Sign in with that email to accept it.`,
				});
			}
			await ctx.db.transaction(async (tx) => {
				await tx
					.insert(workspaceMember)
					.values({
						workspaceId: invite.workspaceId,
						userId: ctx.session.user.id,
						role: invite.role,
					})
					.onConflictDoNothing();
				await tx
					.update(workspaceInvite)
					.set({ status: "accepted" })
					.where(eq(workspaceInvite.id, invite.id));
			});
			return { workspaceId: invite.workspaceId };
		}),

	updateMemberRole: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				userId: z.string(),
				role: roleSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"manage",
				"manage_members"
			);
			if (input.userId === ctx.session.user.id && input.role !== "admin") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You can't demote yourself",
				});
			}
			await ctx.db
				.update(workspaceMember)
				.set({ role: input.role })
				.where(
					and(
						eq(workspaceMember.workspaceId, input.workspaceId),
						eq(workspaceMember.userId, input.userId)
					)
				);
			return { ok: true };
		}),

	removeMember: protectedProcedure
		.input(z.object({ workspaceId: z.string(), userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const isSelf = input.userId === ctx.session.user.id;
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				isSelf ? "view" : "manage",
				isSelf ? undefined : "manage_members"
			);
			if (isSelf) {
				const [{ admins } = { admins: 0 }] = await ctx.db
					.select({ admins: count() })
					.from(workspaceMember)
					.where(
						and(
							eq(workspaceMember.workspaceId, input.workspaceId),
							eq(workspaceMember.role, "admin")
						)
					);
				const me = await requireWorkspace(
					ctx.db,
					input.workspaceId,
					ctx.session.user.id
				);
				if (me.role === "admin" && admins <= 1) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Add another admin before leaving this workspace",
					});
				}
			}
			await ctx.db
				.delete(workspaceMember)
				.where(
					and(
						eq(workspaceMember.workspaceId, input.workspaceId),
						eq(workspaceMember.userId, input.userId)
					)
				);
			return { ok: true };
		}),

	/** How many of the workspace's forms follow (or follow-and-override) its brand. */
	brandCoverage: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireWorkspace(ctx.db, input.id, ctx.session.user.id);
			const rows = await ctx.db
				.select({
					brandOverrides: form.brandOverrides,
					useWorkspaceBrand: form.useWorkspaceBrand,
				})
				.from(form)
				.where(and(eq(form.workspaceId, input.id), isNull(form.deletedAt)));
			const following = rows.filter((r) => r.useWorkspaceBrand).length;
			const overriding = rows.filter(
				(r) => r.useWorkspaceBrand && (r.brandOverrides as string[]).length > 0
			).length;
			return { following, overriding, total: rows.length };
		}),

	/** Replaces the workspace's brand guideline. Omit a key to leave it unset. */
	updateBrand: protectedProcedure
		.input(z.object({ brand: workspaceBrandSchema, id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"manage",
				"manage_workspace"
			);
			await ctx.db
				.update(workspace)
				.set({ brand: input.brand })
				.where(eq(workspace.id, input.id));
			return { ok: true };
		}),

	/** Makes every form in the workspace follow the brand, clearing their overrides. */
	applyBrandToAllForms: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.id,
				ctx.session.user.id,
				"manage",
				"manage_workspace"
			);
			const updated = await ctx.db
				.update(form)
				.set({ brandOverrides: [], useWorkspaceBrand: true })
				.where(and(eq(form.workspaceId, input.id), isNull(form.deletedAt)))
				.returning({ id: form.id });
			return { formsUpdated: updated.length };
		}),

	/** The current user's effective capabilities in this workspace, for the UI to hide disabled actions. */
	myPermissions: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ ctx, input }) => {
			const membership = await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id
			);
			const [row] = await ctx.db
				.select({ settings: workspace.settings })
				.from(workspace)
				.where(eq(workspace.id, input.workspaceId));
			return {
				capabilities: effectiveCapabilityMatrix(row?.settings)[membership.role],
				role: membership.role,
			};
		}),

	/** The full Admin/Member/Read only capability matrix for the "Roles & permissions" page. */
	rolePermissions: protectedProcedure
		.input(z.object({ workspaceId: z.string() }))
		.query(async ({ ctx, input }) => {
			await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
			const [row] = await ctx.db
				.select({ settings: workspace.settings })
				.from(workspace)
				.where(eq(workspace.id, input.workspaceId));
			return {
				capabilities: CAPABILITIES,
				matrix: effectiveCapabilityMatrix(row?.settings),
				overrides: (row?.settings?.rolePermissions ??
					{}) as RolePermissionOverrides,
			};
		}),

	/** Saves per-role overrides for the capability matrix. Admin can't be changed. */
	updateRolePermissions: protectedProcedure
		.input(
			z.object({
				overrides: rolePermissionOverridesSchema,
				workspaceId: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await requireWorkspace(
				ctx.db,
				input.workspaceId,
				ctx.session.user.id,
				"manage",
				"manage_workspace"
			);
			await ctx.db
				.update(workspace)
				.set({
					settings: sql`${workspace.settings} || ${JSON.stringify({ rolePermissions: input.overrides ?? {} })}::jsonb`,
				})
				.where(eq(workspace.id, input.workspaceId));
			return { ok: true };
		}),
});
