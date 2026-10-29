import {
	form,
	formSubmission,
	formView,
	workspace,
} from "@StryveForms/db/schema/forms";
import type { WorkspaceBrand } from "@StryveForms/forms/brand";
import type { FormField } from "@StryveForms/forms/types";
import { fileList, isFileField } from "@StryveForms/forms/values";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { Context } from "../context";
import { publicProcedure, router } from "../index";
import { getMembership } from "../lib/access";
import { submissionFileUrl } from "../lib/files";
import { type FormRow, toPublicFormDto } from "../lib/serialize";
import { verifyCaptcha } from "../services/captcha";
import {
	completedCount,
	isFormClosed,
	submitForm,
} from "../services/submissions";

const BOT_AGENTS = /bot|crawler|spider|preview|facebookexternalhit|slurp/i;
const WWW_PREFIX = /^www\./;

/** Finds a form by its current slug, or by its old OpnForm slug after migration. */
async function findPublicForm(
	db: Context["db"],
	slug: string
): Promise<FormRow | null> {
	const [row] = await db
		.select()
		.from(form)
		.where(
			and(
				or(eq(form.slug, slug), eq(form.legacySlug, slug)),
				isNull(form.deletedAt)
			)
		)
		.limit(1);
	return row ?? null;
}

/** The workspace's brand guideline, used to apply effective design to a public form. */
async function loadWorkspaceBrand(
	db: Context["db"],
	workspaceId: string
): Promise<WorkspaceBrand | null> {
	const [row] = await db
		.select({ brand: workspace.brand })
		.from(workspace)
		.where(eq(workspace.id, workspaceId))
		.limit(1);
	return (row?.brand as WorkspaceBrand | undefined) ?? null;
}

async function isOwnerViewing(ctx: Context, row: FormRow): Promise<boolean> {
	if (!ctx.session) {
		return false;
	}
	return (
		(await getMembership(ctx.db, row.workspaceId, ctx.session.user.id)) !== null
	);
}

async function checkPassword(
	ctx: Context,
	row: FormRow,
	password: string | undefined
) {
	if (!row.passwordHash || (await isOwnerViewing(ctx, row))) {
		return true;
	}
	return password ? Bun.password.verify(password, row.passwordHash) : false;
}

async function loadAvailableForm(ctx: Context, slug: string) {
	const row = await findPublicForm(ctx.db, slug);
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
	}
	if (row.visibility === "draft" && !(await isOwnerViewing(ctx, row))) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Form not found" });
	}
	return row;
}

/** Turns stored file names into short-lived links so respondents can see their uploads. */
function withFileLinks(
	ctx: Context,
	row: FormRow,
	data: Record<string, unknown>
) {
	const out = { ...data };
	for (const field of row.properties as FormField[]) {
		if (isFileField(field) && out[field.id]) {
			out[field.id] = fileList(out[field.id]).map((name) => ({
				file_name: name,
				file_url: submissionFileUrl(ctx.services.config, row.id, name),
			}));
		}
	}
	return out;
}

export const publicRouter = router({
	/** Everything the public page needs to render a form. */
	form: publicProcedure
		.input(
			z.object({
				slug: z.string().max(200),
				password: z.string().max(200).optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const row = await loadAvailableForm(ctx, input.slug);
			const unlocked = await checkPassword(ctx, row, input.password);
			const brand = row.useWorkspaceBrand
				? await loadWorkspaceBrand(ctx.db, row.workspaceId)
				: null;
			const dto = toPublicFormDto(row, ctx.services.config, brand);
			const maxReached =
				row.maxSubmissionsCount !== null &&
				(await completedCount(ctx.db, row.id)) >= row.maxSubmissionsCount;
			return {
				form: unlocked
					? dto
					: { ...dto, properties: [], computedVariables: [] },
				isClosed: isFormClosed(row),
				isOwner: await isOwnerViewing(ctx, row),
				maxSubmissionsReached: maxReached,
				passwordRequired: !unlocked,
				wrongPassword: Boolean(input.password) && !unlocked,
			};
		}),

	/** Counts one page view (owners previewing their form are not counted). */
	view: publicProcedure
		.input(z.object({ slug: z.string().max(200) }))
		.mutation(async ({ ctx, input }) => {
			const row = await findPublicForm(ctx.db, input.slug);
			const agent = ctx.request.headers.get("user-agent") ?? "";
			if (
				row?.visibility !== "public" ||
				BOT_AGENTS.test(agent) ||
				(await isOwnerViewing(ctx, row))
			) {
				return { counted: false };
			}
			const referer = ctx.request.headers.get("referer");
			let source = "Direct";
			if (referer) {
				try {
					source = new URL(referer).hostname.replace(WWW_PREFIX, "");
				} catch {
					source = "Unknown";
				}
			}
			await ctx.db.insert(formView).values({
				formId: row.id,
				meta: {
					country: ctx.request.headers.get("cf-ipcountry") ?? "Unknown",
					source,
				},
			});
			return { counted: true };
		}),

	submit: publicProcedure
		.input(
			z.object({
				slug: z.string().max(200),
				data: z.record(z.string(), z.unknown()),
				password: z.string().max(200).optional(),
				submissionId: z.string().uuid().optional(),
				isPartial: z.boolean().optional(),
				completionTime: z
					.number()
					.int()
					.min(0)
					.max(60 * 60 * 24 * 30)
					.optional(),
				captchaToken: z.string().max(5000).optional(),
				tracking: z.record(z.string(), z.unknown()).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const row = await loadAvailableForm(ctx, input.slug);
			if (!(await checkPassword(ctx, row, input.password))) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "This form is protected by a password.",
				});
			}
			if (isFormClosed(row) && !(await isOwnerViewing(ctx, row))) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This form is closed.",
				});
			}
			const isFinal = !(input.isPartial && row.enablePartialSubmissions);
			if (isFinal && row.useCaptcha) {
				const ok = await verifyCaptcha(
					ctx.services.config,
					row.captchaProvider as "hcaptcha" | "recaptcha" | "turnstile",
					input.captchaToken,
					ctx.request.ip
				);
				if (!ok) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Please complete the captcha.",
					});
				}
			}
			const result = await submitForm(ctx.db, ctx.services, row, {
				completionTime: input.completionTime,
				data: input.data,
				ip: ctx.request.ip,
				isPartial: input.isPartial,
				// Captured for the submission detail view's "device/browser" and
				// "source" info (services/submissions.ts buildMeta).
				referrer: ctx.request.headers.get("referer") ?? undefined,
				submissionId: input.submissionId,
				tracking: input.tracking,
				userAgent: ctx.request.headers.get("user-agent") ?? undefined,
			});
			return { ...result, data: withFileLinks(ctx, row, result.data) };
		}),

	/** Loads a previous submission so the respondent can edit it. */
	submission: publicProcedure
		.input(
			z.object({
				slug: z.string().max(200),
				submissionId: z.string().uuid(),
				password: z.string().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const row = await loadAvailableForm(ctx, input.slug);
			if (!(row.editableSubmissions || row.enablePartialSubmissions)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This form doesn't allow editing answers.",
				});
			}
			if (!(await checkPassword(ctx, row, input.password))) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "This form is protected by a password.",
				});
			}
			const [submission] = await ctx.db
				.select()
				.from(formSubmission)
				.where(
					and(
						eq(formSubmission.formId, row.id),
						eq(formSubmission.publicId, input.submissionId)
					)
				);
			const allowed =
				submission &&
				(row.editableSubmissions || submission.status === "partial");
			if (!allowed) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Submission not found",
				});
			}
			return {
				data: withFileLinks(ctx, row, submission.data),
				status: submission.status,
				submissionId: submission.publicId,
			};
		}),
});
