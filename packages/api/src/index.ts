import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

/** Field errors attached to BAD_REQUEST errors, keyed by field id. */
function fieldErrorsOf(cause: unknown): Record<string, string> | null {
	if (cause && typeof cause === "object" && "fieldErrors" in cause) {
		const { fieldErrors } = cause as { fieldErrors: unknown };
		return fieldErrors && typeof fieldErrors === "object"
			? (fieldErrors as Record<string, string>)
			: null;
	}
	return null;
}

export const t = initTRPC.context<Context>().create({
	errorFormatter({ error, shape }) {
		return {
			...shape,
			data: { ...shape.data, fieldErrors: fieldErrorsOf(error.cause) },
		};
	},
});

export const { router } = t;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});
