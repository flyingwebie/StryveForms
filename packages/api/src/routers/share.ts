import type { Database } from "@StryveForms/db";
import { form } from "@StryveForms/db/schema/forms";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireForm } from "../lib/access";
import { shareUrl } from "../lib/files";
import { formSlug, newId, slugify } from "../lib/ids";

const CANDIDATE_COUNT = 5;

/** Generates a few short random slug candidates and picks the first unused one. */
async function uniqueShareSlug(db: Database, title: string) {
	const candidates = Array.from({ length: CANDIDATE_COUNT }, () =>
		formSlug(title)
	);
	const taken = await db
		.select({ slug: form.slug })
		.from(form)
		.where(inArray(form.slug, candidates));
	const used = new Set(taken.map((t) => t.slug));
	return (
		candidates.find((slug) => !used.has(slug)) ??
		`${slugify(title) || "form"}-${newId().toLowerCase()}`
	);
}

export const shareRouter = router({
	/** Swaps the form's public slug for a fresh random one. The old link stops working. */
	regenerateSlug: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { form: row } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit"
			);
			const slug = await uniqueShareSlug(ctx.db, row.title);
			await ctx.db.update(form).set({ slug }).where(eq(form.id, row.id));
			return {
				shareUrl: shareUrl(ctx.services.config, slug, row.customDomain),
				slug,
			};
		}),

	/** Makes a draft or closed form publicly reachable at its share link again. */
	publish: protectedProcedure
		.input(z.object({ formId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { form: row } = await requireForm(
				ctx.db,
				input.formId,
				ctx.session.user.id,
				"edit"
			);
			await ctx.db
				.update(form)
				.set({ visibility: "public" })
				.where(eq(form.id, row.id));
			return { visibility: "public" as const };
		}),
});
