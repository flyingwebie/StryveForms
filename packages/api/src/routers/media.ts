import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { requireWorkspace } from "../lib/access";
import {
	decryptApiKey,
	encryptApiKey,
	maskApiKey,
} from "../services/ai/crypto";
import { getInstanceSettings } from "../services/instance";
import { listWorkspaceLibrary } from "../services/media/library";
import {
	resolveMediaSettings,
	updateMediaSettings,
} from "../services/media/settings";
import {
	searchUnsplashPhotos,
	testUnsplashKey,
	triggerUnsplashDownload,
	UnsplashError,
	type UnsplashOrientation,
} from "../services/media/unsplash";

/**
 * Image library + Unsplash proxy for the shared ImagePicker.
 * Owner: engineer T. See /tmp/sf-scripts/ROUND7_BRIEF.md.
 */

/** Only instance administrators — same guard as routers/instance.ts's local `adminProcedure` (not exported there). */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (!(ctx.session.user as { isAdmin?: boolean }).isAdmin) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only administrators can do this",
		});
	}
	return next();
});

const orientationSchema: z.ZodType<UnsplashOrientation> = z.enum([
	"landscape",
	"portrait",
	"squarish",
]);

/** Decrypts the saved Unsplash key, or throws a friendly error if Unsplash isn't set up yet. */
async function requireUnsplashKey(ctx: {
	db: Parameters<typeof getInstanceSettings>[0];
	services: { config: { signingSecret: string } };
}): Promise<string> {
	const settings = await getInstanceSettings(ctx.db);
	const media = resolveMediaSettings(settings.agentSettings);
	if (!(media.unsplashEnabled && media.unsplashAccessKeyEncrypted)) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"Unsplash isn't enabled on this instance yet. Ask an administrator to add a free Access Key in Admin → Images & Unsplash.",
		});
	}
	try {
		return decryptApiKey(
			ctx.services.config.signingSecret,
			media.unsplashAccessKeyEncrypted
		);
	} catch (cause) {
		// biome-ignore lint/style/useErrorCause: TRPCError takes the cause in its options object
		throw new TRPCError({
			cause,
			code: "INTERNAL_SERVER_ERROR",
			message:
				"The saved Unsplash key couldn't be decrypted. Ask an administrator to re-enter it in Admin → Images & Unsplash.",
		});
	}
}

export const mediaRouter = router({
	/** The workspace's own previously uploaded images, for the picker's "Library" tab. */
	library: router({
		list: protectedProcedure
			.input(z.object({ workspaceId: z.string() }))
			.query(async ({ ctx, input }) => {
				await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
				return listWorkspaceLibrary(
					ctx.db,
					ctx.services.config,
					input.workspaceId
				);
			}),
	}),

	/** Admin-only: the instance's Unsplash Access Key and enable switch (Admin → "Images & Unsplash"). */
	admin: router({
		get: adminProcedure.query(async ({ ctx }) => {
			const settings = await getInstanceSettings(ctx.db);
			const media = resolveMediaSettings(settings.agentSettings);
			let lastFour: string | null = null;
			if (media.unsplashAccessKeyEncrypted) {
				try {
					lastFour = maskApiKey(
						decryptApiKey(
							ctx.services.config.signingSecret,
							media.unsplashAccessKeyEncrypted
						)
					);
				} catch {
					lastFour = null;
				}
			}
			return {
				enabled: media.unsplashEnabled,
				hasKey: Boolean(media.unsplashAccessKeyEncrypted),
				lastFour,
			};
		}),

		/** Removes the saved key and turns the tab off. */
		remove: adminProcedure.mutation(async ({ ctx }) => {
			await updateMediaSettings(ctx.db, {
				unsplashAccessKeyEncrypted: null,
				unsplashEnabled: false,
			});
			return { ok: true };
		}),

		save: adminProcedure
			.input(
				z.object({
					accessKey: z.string().min(1).max(500).optional(),
					enabled: z.boolean().optional(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				const patch: {
					unsplashAccessKeyEncrypted?: string | null;
					unsplashEnabled?: boolean;
				} = {};
				if (input.enabled !== undefined) {
					patch.unsplashEnabled = input.enabled;
				}
				if (input.accessKey) {
					patch.unsplashAccessKeyEncrypted = encryptApiKey(
						ctx.services.config.signingSecret,
						input.accessKey
					);
				}
				const next = await updateMediaSettings(ctx.db, patch);
				let lastFour: string | null = null;
				if (next.unsplashAccessKeyEncrypted) {
					try {
						lastFour = maskApiKey(
							decryptApiKey(
								ctx.services.config.signingSecret,
								next.unsplashAccessKeyEncrypted
							)
						);
					} catch {
						lastFour = null;
					}
				}
				return {
					enabled: next.unsplashEnabled,
					hasKey: Boolean(next.unsplashAccessKeyEncrypted),
					lastFour,
				};
			}),

		/** Tests either a not-yet-saved key (typed into the field) or the already-saved one. */
		test: adminProcedure
			.input(z.object({ accessKey: z.string().min(1).max(500).optional() }))
			.mutation(async ({ ctx, input }) => {
				let accessKey = input.accessKey ?? null;
				if (!accessKey) {
					const settings = await getInstanceSettings(ctx.db);
					const media = resolveMediaSettings(settings.agentSettings);
					if (media.unsplashAccessKeyEncrypted) {
						try {
							accessKey = decryptApiKey(
								ctx.services.config.signingSecret,
								media.unsplashAccessKeyEncrypted
							);
						} catch {
							return {
								message:
									"The saved key couldn't be decrypted — re-enter it below.",
								ok: false,
							};
						}
					}
				}
				if (!accessKey) {
					return {
						message: "Enter an Access Key first.",
						ok: false,
					};
				}
				return testUnsplashKey({ accessKey });
			}),
	}),

	/** Whether every workspace member can see the Unsplash tab at all — no key is ever sent back. */
	unsplash: router({
		search: protectedProcedure
			.input(
				z.object({
					orientation: orientationSchema.optional(),
					page: z.number().int().min(1).max(50).optional(),
					perPage: z.number().int().min(1).max(30).optional(),
					query: z.string().min(1).max(200),
					workspaceId: z.string(),
				})
			)
			.query(async ({ ctx, input }) => {
				await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
				const accessKey = await requireUnsplashKey(ctx);
				try {
					return await searchUnsplashPhotos({
						accessKey,
						orientation: input.orientation,
						page: input.page,
						perPage: input.perPage,
						query: input.query,
					});
				} catch (error) {
					// biome-ignore lint/style/useErrorCause: TRPCError takes the cause in its options object
					throw new TRPCError({
						cause: error,
						code: "BAD_REQUEST",
						message:
							error instanceof UnsplashError
								? error.message
								: "Could not search Unsplash",
					});
				}
			}),

		status: protectedProcedure.query(async ({ ctx }) => {
			const settings = await getInstanceSettings(ctx.db);
			const media = resolveMediaSettings(settings.agentSettings);
			return {
				enabled:
					media.unsplashEnabled && Boolean(media.unsplashAccessKeyEncrypted),
			};
		}),

		/**
		 * Fires the Unsplash API guideline's required download-tracking ping
		 * (`photo.links.download_location`) the moment a photo is actually
		 * picked — never on hover/preview. Best-effort: a failure here isn't
		 * shown to the user, the chosen image is still used.
		 */
		trackDownload: protectedProcedure
			.input(
				z.object({
					downloadLocation: z.string().url(),
					workspaceId: z.string(),
				})
			)
			.mutation(async ({ ctx, input }) => {
				await requireWorkspace(ctx.db, input.workspaceId, ctx.session.user.id);
				const accessKey = await requireUnsplashKey(ctx);
				try {
					await triggerUnsplashDownload({
						accessKey,
						downloadLocation: input.downloadLocation,
					});
				} catch {
					// Best-effort tracking ping — never block the user's pick on it.
				}
				return { ok: true };
			}),
	}),
});
