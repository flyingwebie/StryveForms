/**
 * Instance-wide backups: destinations, schedule, full backup and restore.
 * Instance admins only. See /tmp/sf-scripts/BACKUP_DESIGN.md "Full instance
 * backup" / "Full restore" / "Scheduled backups".
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { newId } from "../lib/ids";
import {
	decryptDestinationSecret,
	encryptDestinationSecret,
	maskSecret,
	openDestination,
	S3_PRESET_IDS,
	S3_PRESETS,
	serverDestinationDraft,
} from "../services/backup/destinations";
import {
	inspectInstanceBackup,
	restoreInstanceArchive,
	uploadStorageKey,
	writeInstanceArchive,
} from "../services/backup/index";
import {
	type ArchiveBackend,
	RestoreConfirmationError,
	runInstanceBackup,
	runInstanceRestore,
} from "../services/backup/instance-jobs";
import {
	cancelBackupJob,
	getBackupJob,
	listBackupJobs,
} from "../services/backup/jobs";
import {
	backupScheduleSchema,
	type StoredDestinationConfig as DestinationConfigValue,
	getBackupSettings,
	updateBackupSettings,
} from "../services/backup/scheduler";
import { storageSource } from "../services/backup/streams";

const MIN_PASSPHRASE_LENGTH = 12;
const passphraseSchema = z
	.string()
	.min(
		MIN_PASSPHRASE_LENGTH,
		`Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`
	);

const archive: ArchiveBackend = {
	inspectInstanceBackup,
	restoreInstanceArchive,
	writeInstanceArchive,
};

/** Only instance administrators. Mirrors routers/instance.ts's own (unexported) `adminProcedure`. */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (!(ctx.session.user as { isAdmin?: boolean }).isAdmin) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Only administrators can do this",
		});
	}
	return next();
});

/* -------------------------------------------------------------------------- */
/*                                Destinations                                */
/* -------------------------------------------------------------------------- */

/** A destination as sent to the browser: the secret is masked, never the real ciphertext. */
interface ClientDestination {
	accessKeyId?: string;
	bucket?: string;
	endpoint?: string;
	id: string;
	kind: "s3" | "server";
	label: string;
	pathStyle?: boolean;
	prefix: string;
	preset?: string;
	region?: string;
	secretMasked?: string;
}

function toClientDestination(
	stored: DestinationConfigValue,
	instanceSecret: string
): ClientDestination {
	if (stored.kind === "server") {
		return {
			id: stored.id,
			kind: "server",
			label: stored.label,
			prefix: stored.prefix,
		};
	}
	let secretMasked = "••••";
	try {
		secretMasked = maskSecret(
			decryptDestinationSecret(instanceSecret, stored.secretAccessKeyEncrypted)
		);
	} catch {
		secretMasked = "(unreadable — re-enter the secret key)";
	}
	return {
		accessKeyId: stored.accessKeyId,
		bucket: stored.bucket,
		endpoint: stored.endpoint,
		id: stored.id,
		kind: "s3",
		label: stored.label,
		pathStyle: stored.pathStyle,
		prefix: stored.prefix,
		preset: stored.preset,
		region: stored.region,
		secretMasked,
	};
}

const serverDestinationInput = z.object({
	id: z.string().optional(),
	kind: z.literal("server"),
	label: z.string().min(1),
	prefix: z.string().default("backups/"),
});

const s3DestinationInput = z.object({
	accessKeyId: z.string().min(1),
	bucket: z.string().min(1),
	endpoint: z.string().min(1),
	id: z.string().optional(),
	kind: z.literal("s3"),
	label: z.string().min(1),
	pathStyle: z.boolean(),
	prefix: z.string().default("backups/"),
	preset: z.enum(S3_PRESET_IDS),
	region: z.string().min(1),
	/** Plaintext from the form. Empty string on an update means "keep the existing secret". */
	secretAccessKey: z.string(),
});

const destinationInput = z.discriminatedUnion("kind", [
	serverDestinationInput,
	s3DestinationInput,
]);

export const backupAdminRouter = router({
	backupNow: adminProcedure
		.input(
			z.object({
				destinationId: z.string(),
				passphrase: passphraseSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const settings = await getBackupSettings(ctx.db);
			const passphrase = resolvePassphrase(
				ctx.services.config.signingSecret,
				settings.passphraseEncrypted,
				input.passphrase
			);
			return runInstanceBackup(ctx.db, ctx.services, archive, {
				destinationId: input.destinationId,
				passphrase,
				trigger: "manual",
				userId: ctx.session.user.id,
			});
		}),

	cancel: adminProcedure
		.input(z.object({ id: z.string() }))
		.mutation(({ ctx, input }) => cancelBackupJob(ctx.db, input.id)),

	destinations: router({
		create: adminProcedure
			.input(destinationInput)
			.mutation(async ({ ctx, input }) => {
				const settings = await getBackupSettings(ctx.db);
				const id = input.id ?? newId();
				const stored: DestinationConfigValue =
					input.kind === "server"
						? { id, kind: "server", label: input.label, prefix: input.prefix }
						: {
								accessKeyId: input.accessKeyId,
								bucket: input.bucket,
								endpoint: input.endpoint,
								id,
								kind: "s3",
								label: input.label,
								pathStyle: input.pathStyle,
								prefix: input.prefix,
								preset: input.preset,
								region: input.region,
								secretAccessKeyEncrypted: encryptDestinationSecret(
									ctx.services.config.signingSecret,
									input.secretAccessKey
								),
							};
				const next = await updateBackupSettings(ctx.db, {
					destinations: [
						...settings.destinations.filter((d) => d.id !== id),
						stored,
					],
				});
				return next.destinations.map((d) =>
					toClientDestination(d, ctx.services.config.signingSecret)
				);
			}),

		delete: adminProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ ctx, input }) => {
				const settings = await getBackupSettings(ctx.db);
				const next = await updateBackupSettings(ctx.db, {
					destinations: settings.destinations.filter((d) => d.id !== input.id),
					schedule:
						settings.schedule.destinationId === input.id
							? { ...settings.schedule, destinationId: null }
							: settings.schedule,
				});
				return next.destinations.map((d) =>
					toClientDestination(d, ctx.services.config.signingSecret)
				);
			}),

		list: adminProcedure.query(async ({ ctx }) => {
			const settings = await getBackupSettings(ctx.db);
			return settings.destinations.map((d) =>
				toClientDestination(d, ctx.services.config.signingSecret)
			);
		}),

		presets: adminProcedure.query(() => S3_PRESETS),

		serverDraft: adminProcedure.query(() => serverDestinationDraft(newId())),

		test: adminProcedure
			.input(
				z.union([
					z.object({ id: z.string() }),
					z.object({ draft: destinationInput }),
				])
			)
			.mutation(async ({ ctx, input }) => {
				let config: DestinationConfigValue;
				if ("id" in input) {
					const settings = await getBackupSettings(ctx.db);
					const found = settings.destinations.find((d) => d.id === input.id);
					if (!found) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: "Destination not found",
						});
					}
					config = found;
				} else {
					const { draft } = input;
					config =
						draft.kind === "server"
							? {
									id: draft.id ?? "draft",
									kind: "server",
									label: draft.label,
									prefix: draft.prefix,
								}
							: {
									accessKeyId: draft.accessKeyId,
									bucket: draft.bucket,
									endpoint: draft.endpoint,
									id: draft.id ?? "draft",
									kind: "s3",
									label: draft.label,
									pathStyle: draft.pathStyle,
									prefix: draft.prefix,
									preset: draft.preset,
									region: draft.region,
									secretAccessKeyEncrypted: encryptDestinationSecret(
										ctx.services.config.signingSecret,
										draft.secretAccessKey
									),
								};
				}
				const opened = openDestination(config, {
					instanceSecret: ctx.services.config.signingSecret,
					storage: ctx.services.storage,
				});
				return opened.test();
			}),

		update: adminProcedure
			.input(destinationInput.and(z.object({ id: z.string() })))
			.mutation(async ({ ctx, input }) => {
				const settings = await getBackupSettings(ctx.db);
				const existing = settings.destinations.find((d) => d.id === input.id);
				if (!existing) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Destination not found",
					});
				}
				const stored: DestinationConfigValue =
					input.kind === "server"
						? {
								id: input.id,
								kind: "server",
								label: input.label,
								prefix: input.prefix,
							}
						: {
								accessKeyId: input.accessKeyId,
								bucket: input.bucket,
								endpoint: input.endpoint,
								id: input.id,
								kind: "s3",
								label: input.label,
								pathStyle: input.pathStyle,
								prefix: input.prefix,
								preset: input.preset,
								region: input.region,
								secretAccessKeyEncrypted: resolveUpdatedSecret(
									ctx.services.config.signingSecret,
									input.secretAccessKey,
									existing
								),
							};
				const next = await updateBackupSettings(ctx.db, {
					destinations: settings.destinations.map((d) =>
						d.id === input.id ? stored : d
					),
				});
				return next.destinations.map((d) =>
					toClientDestination(d, ctx.services.config.signingSecret)
				);
			}),
	}),

	inspect: adminProcedure
		.input(z.object({ passphrase: passphraseSchema, uploadKey: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const source = await storageSource(
				ctx.services.storage,
				uploadStorageKey(input.uploadKey)
			);
			return inspectInstanceBackup(ctx.db, ctx.services, {
				passphrase: input.passphrase,
				source,
			});
		}),

	job: adminProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) => getBackupJob(ctx.db, input.id)),

	jobs: adminProcedure
		.input(
			z
				.object({
					kind: z.enum(["instance_backup", "instance_restore"]).optional(),
				})
				.optional()
		)
		.query(({ ctx, input }) => listBackupJobs(ctx.db, { kind: input?.kind })),

	passphrase: router({
		set: adminProcedure
			.input(z.object({ passphrase: passphraseSchema }))
			.mutation(async ({ ctx, input }) => {
				await updateBackupSettings(ctx.db, {
					passphraseEncrypted: encryptDestinationSecret(
						ctx.services.config.signingSecret,
						input.passphrase
					),
				});
				return { set: true };
			}),

		status: adminProcedure.query(async ({ ctx }) => {
			const settings = await getBackupSettings(ctx.db);
			return { isSet: Boolean(settings.passphraseEncrypted) };
		}),
	}),

	restore: adminProcedure
		.input(
			z.object({
				confirmInstanceName: z.string(),
				passphrase: passphraseSchema,
				safetyDestinationId: z.string().nullable(),
				uploadKey: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const source = await storageSource(
				ctx.services.storage,
				uploadStorageKey(input.uploadKey)
			);
			try {
				return await runInstanceRestore(ctx.db, ctx.services, archive, {
					confirmInstanceName: input.confirmInstanceName,
					passphrase: input.passphrase,
					safetyDestinationId: input.safetyDestinationId,
					source,
					userId: ctx.session.user.id,
				});
			} catch (error) {
				if (error instanceof RestoreConfirmationError) {
					// biome-ignore lint/style/useErrorCause: TRPCError's own `cause` option carries it
					throw new TRPCError({
						cause: error,
						code: "BAD_REQUEST",
						message: error.message,
					});
				}
				throw error;
			}
		}),

	schedule: router({
		get: adminProcedure.query(async ({ ctx }) => {
			const settings = await getBackupSettings(ctx.db);
			return settings;
		}),

		set: adminProcedure
			.input(
				z.object({
					retention: z.object({ keepLast: z.number().int().min(1).max(365) }),
					schedule: backupScheduleSchema,
				})
			)
			.mutation(({ ctx, input }) =>
				updateBackupSettings(ctx.db, {
					retention: input.retention,
					schedule: input.schedule,
				})
			),
	}),
});

/** The passphrase to use for a backup: given explicitly, or the stored unattended one, decrypted. */
function resolvePassphrase(
	instanceSecret: string,
	storedEncrypted: string | null,
	given: string | undefined
): string {
	if (given) {
		return given;
	}
	if (!storedEncrypted) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"No passphrase was given, and no unattended backup passphrase is set yet (Admin → Backups → set one first).",
		});
	}
	return decryptDestinationSecret(instanceSecret, storedEncrypted);
}

/** On update: a non-empty secret field re-encrypts it; an empty one keeps the existing secret as-is. */
function resolveUpdatedSecret(
	instanceSecret: string,
	given: string,
	existing: DestinationConfigValue
): string {
	if (given.length > 0) {
		return encryptDestinationSecret(instanceSecret, given);
	}
	if (existing.kind === "s3") {
		return existing.secretAccessKeyEncrypted;
	}
	return "";
}
