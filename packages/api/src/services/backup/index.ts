// biome-ignore-all lint/performance/noBarrelFile: this file IS the public contract (CONTRACT.md) — Q and R import from here
/**
 * Public API for backup/export/import — see CONTRACT.md for the full
 * signatures Q and R build against. Implements workspace export/import for
 * real; the instance-scope functions (`writeInstanceArchive`,
 * `inspectInstanceBackup`, `restoreInstanceArchive`) are for R's
 * instance-jobs.ts to call from inside its own job/safety-backup flow.
 */
import type { Database } from "@StryveForms/db";
import {
	account,
	user as authUser,
	passkey,
	twoFactor,
} from "@StryveForms/db/schema/auth";
import { aiCredential, pdfTemplate } from "@StryveForms/db/schema/features";
import {
	folder,
	form,
	formIntegration,
	formStatistic,
	formSubmission,
	formVersion,
	formView,
	instanceSettings,
	storedFile,
	template,
	workspace,
	workspaceInvite,
	workspaceMember,
} from "@StryveForms/db/schema/forms";
import { emails } from "@StryveForms/emails/messages";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import rootPackage from "../../../../../package.json" with { type: "json" };
import type { Services } from "../../context";
import {
	assetKey,
	canonicalFileName,
	submissionFileKey,
} from "../../lib/files";
import { newId, newPublicId } from "../../lib/ids";
import { decryptApiKey, encryptApiKey } from "../ai/crypto";
import { emailBranding } from "../instance";
import { pdfSourceKey } from "../pdf/keys";
import {
	decryptSecretsMap,
	decryptStream,
	encryptSecretsMap,
	encryptStream,
	readContainerHeader,
} from "./crypto";
import {
	BackupJobReporter,
	createBackupJob,
	failBackupJob,
	finishBackupJob,
} from "./jobs";
import {
	ARCHIVE_FORMAT,
	type ArchiveManifest,
	CURRENT_FORMAT_VERSION,
	upgradeManifest,
} from "./manifest";
import { RemapTable, rewriteValueReferences } from "./rewrite";
import {
	resolveSecretRefs,
	sanitizeIntegrationFields,
	sanitizeWorkspaceSettings,
} from "./secrets";
import type { ArchiveSink, ArchiveSource } from "./streams";
import { storageSink, storageSource } from "./streams";
import {
	readEntryBytes,
	readJsonlEntry,
	readZipEntries,
	ZipBuilder,
} from "./zip";

export {
	MIN_PASSPHRASE_LENGTH,
	TruncatedContainerError,
	WrongPassphraseError,
} from "./crypto";
export {
	BackupJobCancelled,
	type BackupJobKind,
	BackupJobReporter,
	type BackupJobStatus,
	type BackupJobTrigger,
	type BackupProgress,
	cancelBackupJob,
	createBackupJob,
	failBackupJob,
	failInterruptedBackupJobs,
	finishBackupJob,
	getBackupJob,
	listBackupJobs,
} from "./jobs";
export type { ArchiveSink, ArchiveSource } from "./streams";

const EXPORT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const randomSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

async function withUniqueSuffix(
	desired: string,
	exists: (candidate: string) => Promise<boolean>
): Promise<string> {
	if (!(await exists(desired))) {
		return desired;
	}
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const candidate = `${desired}-${randomSuffix()}`;
		// biome-ignore lint/performance/noAwaitInLoops: a short bounded retry, not a hot loop
		if (!(await exists(candidate))) {
			return candidate;
		}
	}
	return `${desired}-${randomSuffix()}${randomSuffix()}`;
}

/** "1 form", "3 forms". */
function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function appVersion(): string {
	return rootPackage.version ?? "0.0.0";
}

/** Upload ids are `<base36 ms timestamp>-<uuid>` (see `newUploadKey`). */
const UPLOAD_KEY = /^[a-z0-9]{1,12}-[0-9a-f-]{36}$/;

/** A new id for `POST /api/backups/upload`. The timestamp lets maintenance purge abandoned uploads. */
export function newUploadKey(): string {
	return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}

/** When an upload was made, read from its id (null for a malformed id). */
export function uploadKeyCreatedAt(uploadKey: string): Date | null {
	if (!UPLOAD_KEY.test(uploadKey)) {
		return null;
	}
	const ms = Number.parseInt(uploadKey.split("-")[0] ?? "", 36);
	return Number.isFinite(ms) ? new Date(ms) : null;
}

/**
 * `POST /api/backups/upload` returns a bare id; the storage key always lives
 * under `tmp/backups/`. The id is validated strictly so a crafted value like
 * `../../exports/<job>.stryve.zip` can't point at someone else's file.
 */
export function uploadStorageKey(uploadKey: string): string {
	if (!UPLOAD_KEY.test(uploadKey)) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid upload" });
	}
	return `tmp/backups/${uploadKey}`;
}

/** Runs a background job's body, recording success/failure on the `backup_job` row (mirrors services/import/jobs.ts `runJob`). */
function runInBackground(
	db: Database,
	jobId: string,
	reporter: BackupJobReporter,
	body: () => Promise<void>
) {
	const execute = async () => {
		try {
			await body();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			reporter.add("error", message);
			try {
				await failBackupJob(db, jobId, message);
			} catch (innerError) {
				console.error("[backup] failed to record job failure", innerError);
			}
		}
	};
	execute().catch((error: unknown) => console.error("[backup]", error));
}

/* -------------------------------------------------------------------------- */
/*                            Workspace export (write)                        */
/* -------------------------------------------------------------------------- */

export interface StartWorkspaceExportInput {
	includeUploads: boolean;
	passphrase?: string;
	trigger?: "manual" | "cli";
	userId: string;
	workspaceId: string;
}

/** Collects every row this workspace export needs, once, up front (small enough to hold in memory — only the FILE bytes stream). */
async function gatherWorkspaceRows(db: Database, workspaceId: string) {
	const [workspaceRow] = await db
		.select()
		.from(workspace)
		.where(eq(workspace.id, workspaceId));
	if (!workspaceRow) {
		throw new Error("Workspace not found");
	}
	const folders = await db
		.select()
		.from(folder)
		.where(eq(folder.workspaceId, workspaceId));
	const forms = await db
		.select()
		.from(form)
		.where(and(eq(form.workspaceId, workspaceId), isNull(form.deletedAt)));
	const formIds = forms.map((f) => f.id);
	const versions = formIds.length
		? await db
				.select()
				.from(formVersion)
				.where(inArray(formVersion.formId, formIds))
		: [];
	const submissions = formIds.length
		? await db
				.select()
				.from(formSubmission)
				.where(inArray(formSubmission.formId, formIds))
		: [];
	// View counts: raw views plus daily rollups (imported OpnForm stats live there).
	const views = formIds.length
		? await db
				.select({
					createdAt: formView.createdAt,
					formId: formView.formId,
					meta: formView.meta,
				})
				.from(formView)
				.where(inArray(formView.formId, formIds))
		: [];
	const statistics = formIds.length
		? await db
				.select({
					data: formStatistic.data,
					date: formStatistic.date,
					formId: formStatistic.formId,
				})
				.from(formStatistic)
				.where(inArray(formStatistic.formId, formIds))
		: [];
	const integrations = formIds.length
		? await db
				.select()
				.from(formIntegration)
				.where(
					and(
						inArray(formIntegration.formId, formIds),
						isNull(formIntegration.deletedAt)
					)
				)
		: [];
	const pdfTemplates = formIds.length
		? await db
				.select()
				.from(pdfTemplate)
				.where(inArray(pdfTemplate.formId, formIds))
		: [];
	const templates = await db
		.select()
		.from(template)
		.where(eq(template.workspaceId, workspaceId));
	// A storedFile row is either workspace-scoped (brand/option assets) or
	// form-scoped (submission uploads/signatures) — union both sets.
	const assetFiles = await db
		.select()
		.from(storedFile)
		.where(eq(storedFile.workspaceId, workspaceId));
	const formScopedFiles = formIds.length
		? await db
				.select()
				.from(storedFile)
				.where(inArray(storedFile.formId, formIds))
		: [];
	const fileById = new Map<string, (typeof assetFiles)[number]>();
	for (const f of [...assetFiles, ...formScopedFiles]) {
		fileById.set(f.id, f);
	}
	const members = await db
		.select({ email: authUser.email, role: workspaceMember.role })
		.from(workspaceMember)
		.innerJoin(authUser, eq(authUser.id, workspaceMember.userId))
		.where(eq(workspaceMember.workspaceId, workspaceId));
	const invites = await db
		.select({ email: workspaceInvite.email, role: workspaceInvite.role })
		.from(workspaceInvite)
		.where(
			and(
				eq(workspaceInvite.workspaceId, workspaceId),
				eq(workspaceInvite.status, "pending")
			)
		);
	const [credential] = await db
		.select()
		.from(aiCredential)
		.where(eq(aiCredential.workspaceId, workspaceId));
	return {
		credential: credential ?? null,
		files: Array.from(fileById.values()),
		folders,
		forms,
		integrations,
		invites,
		members,
		pdfTemplates,
		statistics,
		submissions,
		templates,
		versions,
		views,
		workspaceRow,
	};
}

type WorkspaceRows = Awaited<ReturnType<typeof gatherWorkspaceRows>>;

function sanitizeAiCredential(
	credential: WorkspaceRows["credential"],
	includeSecrets: boolean,
	services: Services,
	onSecret: (ref: string, value: string) => void
): Record<string, unknown> | null {
	if (!credential) {
		return null;
	}
	let plaintext: string | null = null;
	if (credential.encryptedKey) {
		try {
			plaintext = decryptApiKey(
				services.config.signingSecret,
				credential.encryptedKey
			);
		} catch {
			plaintext = null;
		}
	}
	const ref = `aiCredential:${credential.id}:key`;
	let key: string | { secretRef: string };
	if (!plaintext) {
		key = "";
	} else if (includeSecrets) {
		onSecret(ref, plaintext);
		key = { secretRef: ref };
	} else {
		key = "";
	}
	return {
		baseUrl: credential.baseUrl,
		hadSecret: Boolean(plaintext),
		id: credential.id,
		key,
		model: credential.model,
		provider: credential.provider,
	};
}

/** Builds the `data/*.jsonl` row payloads (secrets blanked/ref'd) and the secrets map to write to `secrets.enc`. */
function sanitizeWorkspaceRows(
	rows: WorkspaceRows,
	includeSecrets: boolean,
	services: Services
) {
	const secrets = new Map<string, string>();
	const onSecret = (ref: string, value: string) => secrets.set(ref, value);

	const workspaceSanitized = sanitizeWorkspaceSettings(
		rows.workspaceRow.id,
		rows.workspaceRow.settings as Record<string, unknown>,
		{ includeSecrets, onSecret }
	);
	const workspaceOut = {
		...rows.workspaceRow,
		settings: workspaceSanitized.settings,
	};

	const integrationsOut = rows.integrations.map((row) => {
		const sanitized = sanitizeIntegrationFields(
			row.id,
			row.data as Record<string, unknown>,
			row.settings as Record<string, unknown>,
			{ includeSecrets, onSecret }
		);
		return {
			...row,
			data: sanitized.data,
			hadSecret: sanitized.hadSecret,
			settings: sanitized.settings,
		};
	});

	const credentialOut = sanitizeAiCredential(
		rows.credential,
		includeSecrets,
		services,
		onSecret
	);

	return { credentialOut, integrationsOut, secrets, workspaceOut };
}

async function streamFilesIntoArchive(
	services: Services,
	builder: ZipBuilder,
	reporter: BackupJobReporter,
	files: { key: string }[],
	pdfTemplates: { id: string; sourceFileKey: string | null }[]
) {
	let done = 0;
	for (const f of files) {
		reporter.checkCancelled();
		// biome-ignore lint/performance/noAwaitInLoops: files are streamed into the archive one at a time, in order
		const stream = await services.storage.getStream(f.key);
		if (stream) {
			await builder.addStream(`files/${f.key}`, stream);
		}
		done += 1;
		reporter.entityProgress("files", done, files.length);
		await reporter.flush();
	}
	for (const t of pdfTemplates) {
		if (!t.sourceFileKey) {
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: files are streamed into the archive one at a time, in order
		const stream = await services.storage.getStream(t.sourceFileKey);
		if (stream) {
			await builder.addStream(`files/pdf-source/${t.id}`, stream);
		}
	}
}

async function runWorkspaceExport(
	db: Database,
	services: Services,
	jobId: string,
	reporter: BackupJobReporter,
	input: StartWorkspaceExportInput
) {
	const includeSecrets = Boolean(input.passphrase);
	reporter.add("info", "Reading workspace data");
	const rows = await gatherWorkspaceRows(db, input.workspaceId);
	const files = input.includeUploads
		? rows.files
		: rows.files.filter((f) => f.kind === "asset");
	const sanitized = sanitizeWorkspaceRows(rows, includeSecrets, services);

	const manifest: ArchiveManifest = {
		appVersion: appVersion(),
		counts: {
			files: files.length,
			folders: rows.folders.length,
			forms: rows.forms.length,
			integrations: rows.integrations.length,
			pdfTemplates: rows.pdfTemplates.length,
			submissions: rows.submissions.length,
			templates: rows.templates.length,
		},
		createdAt: new Date().toISOString(),
		customDomains: rows.workspaceRow.customDomains as string[],
		encryption: { includesSecrets: includeSecrets },
		format: ARCHIVE_FORMAT,
		formatVersion: CURRENT_FORMAT_VERSION,
		includesSecrets: includeSecrets,
		includesUploads: input.includeUploads,
		members: [
			...rows.members.map((m) => ({ ...m, invited: false })),
			...rows.invites.map((i) => ({ ...i, invited: true })),
		],
		scope: "workspace",
		source: {
			instanceName: services.config.appName,
			url: services.config.appUrl,
		},
		workspaces: [{ id: rows.workspaceRow.id, name: rows.workspaceRow.name }],
	};

	const fileKey = `exports/${jobId}.stryve.zip`;
	const sink = storageSink(services.storage, fileKey);
	const builder = new ZipBuilder(sink);
	try {
		reporter.add("info", "Writing archive");
		await builder.addBytes(
			"manifest.json",
			new TextEncoder().encode(JSON.stringify(manifest))
		);
		await builder.addJsonl("data/workspace.jsonl", [sanitized.workspaceOut]);
		await builder.addJsonl("data/folder.jsonl", rows.folders);
		await builder.addJsonl("data/form.jsonl", rows.forms);
		reporter.entityProgress("forms", rows.forms.length, rows.forms.length);
		await builder.addJsonl("data/formVersion.jsonl", rows.versions);
		await builder.addJsonl("data/formView.jsonl", rows.views);
		await builder.addJsonl("data/formStatistic.jsonl", rows.statistics);
		await builder.addJsonl("data/formSubmission.jsonl", rows.submissions);
		reporter.entityProgress(
			"submissions",
			rows.submissions.length,
			rows.submissions.length
		);
		await builder.addJsonl(
			"data/formIntegration.jsonl",
			sanitized.integrationsOut
		);
		await builder.addJsonl("data/pdfTemplate.jsonl", rows.pdfTemplates);
		await builder.addJsonl("data/template.jsonl", rows.templates);
		await builder.addJsonl(
			"data/aiCredential.jsonl",
			sanitized.credentialOut ? [sanitized.credentialOut] : []
		);
		await builder.addJsonl("data/storedFile.jsonl", files);
		await builder.addJsonl("data/workspaceMember.jsonl", rows.members);
		await builder.addJsonl("data/workspaceInvite.jsonl", rows.invites);
		if (includeSecrets && input.passphrase) {
			const secretsBytes = await encryptSecretsMap(
				input.passphrase,
				Object.fromEntries(sanitized.secrets)
			);
			await builder.addBytes("secrets.enc", secretsBytes);
		}
		reporter.add("info", `Streaming ${plural(files.length, "file")}`);
		await streamFilesIntoArchive(
			services,
			builder,
			reporter,
			files,
			rows.pdfTemplates
		);
		await builder.finish();
		await sink.close();
	} catch (error) {
		await sink.abort(error);
		throw error;
	}

	const sizeBytes = await services.storage.size(fileKey);
	await finishBackupJob(db, jobId, {
		expiresAt: new Date(Date.now() + EXPORT_EXPIRY_MS),
		fileKey,
		fileName: `${rows.workspaceRow.name.replace(/[^\w.-]+/g, "_")}.stryve.zip`,
		result: { counts: manifest.counts, includesSecrets: includeSecrets },
		sizeBytes,
	});
	await sendExportReadyEmail(db, services, {
		jobId,
		sizeBytes,
		status: "completed",
		userId: input.userId,
		workspaceName: rows.workspaceRow.name,
	});
}

/** Emails the job owner once their export is ready (or failed) to download. */
async function sendExportReadyEmail(
	db: Database,
	services: Services,
	input: {
		error?: string | null;
		jobId?: string;
		sizeBytes?: number | null;
		status: "completed" | "failed";
		userId: string;
		workspaceName: string;
	}
) {
	const [owner] = await db
		.select({ email: authUser.email })
		.from(authUser)
		.where(eq(authUser.id, input.userId));
	if (!owner) {
		return;
	}
	await services.mailer.send({
		react: emails.exportReady({
			branding: await emailBranding(db, services.config),
			downloadUrl: input.jobId
				? `${services.config.appUrl}/api/backups/jobs/${input.jobId}/download`
				: services.config.appUrl,
			error: input.error,
			expiresIn: "in 7 days",
			sizeLabel: input.sizeBytes ? formatByteSize(input.sizeBytes) : "—",
			status: input.status,
			workspaceName: input.workspaceName,
		}),
		subject:
			input.status === "completed"
				? `Your export of "${input.workspaceName}" is ready`
				: `Your export of "${input.workspaceName}" failed`,
		to: owner.email,
	});
}

const BYTE_UNITS = ["B", "KB", "MB", "GB"];

function formatByteSize(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${BYTE_UNITS[unit]}`;
}

export async function startWorkspaceExport(
	db: Database,
	services: Services,
	input: StartWorkspaceExportInput
): Promise<{ jobId: string }> {
	const { id: jobId } = await createBackupJob(db, {
		kind: "workspace_export",
		options: {
			includeSecrets: Boolean(input.passphrase),
			includeUploads: input.includeUploads,
		},
		trigger: input.trigger ?? "manual",
		userId: input.userId,
		workspaceId: input.workspaceId,
	});
	const reporter = new BackupJobReporter(db, jobId);
	runInBackground(db, jobId, reporter, () =>
		runWorkspaceExport(db, services, jobId, reporter, input)
	);
	return { jobId };
}

/* -------------------------------------------------------------------------- */
/*                          Workspace import (inspect)                        */
/* -------------------------------------------------------------------------- */

export interface InspectWorkspaceArchiveInput {
	passphrase?: string;
	uploadKey: string;
	userId: string;
}

export interface WorkspaceArchiveOverview {
	counts: Record<string, number>;
	customDomains: string[];
	includesSecrets: boolean;
	manifest: ArchiveManifest;
	members: {
		email: string;
		hasAccount: boolean;
		invited: boolean;
		role: string;
	}[];
	passphraseOk?: boolean;
	sizeBytes: number;
	slugChanges: { from: string; to: string }[];
	warnings: string[];
}

interface ScanResult {
	formSlugs: string[];
	hadSecretCount: number;
	manifest: ArchiveManifest | null;
	secretsBytes: Uint8Array | null;
}

/** Streams through just enough of a workspace archive to build the import preview (stops once the (always-last) `files/` entries start). */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one flat switch over entry names, each branch trivial
async function scanWorkspaceArchive(
	source: ArchiveSource
): Promise<ScanResult> {
	const result: ScanResult = {
		formSlugs: [],
		hadSecretCount: 0,
		manifest: null,
		secretsBytes: null,
	};
	for await (const entry of readZipEntries(source)) {
		if (entry.name === "manifest.json") {
			result.manifest = upgradeManifest(
				JSON.parse(new TextDecoder().decode(await readEntryBytes(entry))),
				appVersion()
			);
		} else if (entry.name === "secrets.enc") {
			result.secretsBytes = await readEntryBytes(entry);
		} else if (entry.name === "data/form.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				result.formSlugs.push((row as { slug: string }).slug);
			}
		} else if (entry.name === "data/formIntegration.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				if ((row as { hadSecret?: boolean }).hadSecret) {
					result.hadSecretCount += 1;
				}
			}
		} else if (entry.name.startsWith("files/")) {
			// Our own writer always emits `files/*` last — nothing else to learn.
			await entry.stream.cancel().catch(() => undefined);
			break;
		} else {
			await entry.stream.cancel().catch(() => undefined);
		}
	}
	return result;
}

export async function inspectWorkspaceArchive(
	db: Database,
	services: Services,
	input: InspectWorkspaceArchiveInput
): Promise<WorkspaceArchiveOverview> {
	const source = await storageSource(
		services.storage,
		uploadStorageKey(input.uploadKey)
	);
	const scan = await scanWorkspaceArchive(source);
	if (!scan.manifest) {
		throw new Error("This file doesn't look like a StryveForms archive.");
	}
	const { manifest } = scan;

	let passphraseOk: boolean | undefined;
	if (scan.secretsBytes && input.passphrase) {
		try {
			await decryptSecretsMap(input.passphrase, scan.secretsBytes);
			passphraseOk = true;
		} catch {
			passphraseOk = false;
		}
	}

	const existingSlugs = scan.formSlugs.length
		? await db
				.select({ slug: form.slug })
				.from(form)
				.where(inArray(form.slug, scan.formSlugs))
		: [];
	const taken = new Set(existingSlugs.map((r) => r.slug));
	const slugChanges = scan.formSlugs
		.filter((slug) => taken.has(slug))
		.map((slug) => ({ from: slug, to: `${slug}-${randomSuffix()}` }));

	const memberEmails = (manifest.members ?? []).map((m) => m.email);
	const existingUsers = memberEmails.length
		? await db
				.select({ email: authUser.email })
				.from(authUser)
				.where(inArray(authUser.email, memberEmails))
		: [];
	const existingEmails = new Set(existingUsers.map((u) => u.email));
	const members = (manifest.members ?? []).map((m) => ({
		...m,
		hasAccount: existingEmails.has(m.email),
	}));

	const warnings: string[] = [];
	if (scan.hadSecretCount > 0 && !(manifest.includesSecrets && passphraseOk)) {
		warnings.push(
			`${plural(scan.hadSecretCount, "integration")} will need reconnecting after import, because secrets aren't included.`
		);
	}
	if ((manifest.customDomains ?? []).length > 0) {
		warnings.push(
			`Custom domains aren't carried over. Set up ${manifest.customDomains?.join(", ")} again after import.`
		);
	}
	if (slugChanges.length > 0) {
		warnings.push(
			`${plural(slugChanges.length, "form link")} will change, because the current one is already taken here.`
		);
	}

	return {
		counts: manifest.counts,
		customDomains: manifest.customDomains ?? [],
		includesSecrets: manifest.includesSecrets,
		manifest,
		members,
		passphraseOk,
		sizeBytes:
			(await services.storage.size(uploadStorageKey(input.uploadKey))) ?? 0,
		slugChanges,
		warnings,
	};
}

/* -------------------------------------------------------------------------- */
/*                           Workspace import (apply)                         */
/* -------------------------------------------------------------------------- */

export interface StartWorkspaceImportInput {
	members: { email: string; role: "admin" | "user" | "readonly" }[];
	passphrase?: string;
	sendInvites: boolean;
	uploadKey: string;
	userId: string;
}

type Row = Record<string, unknown>;

interface ReadArchiveResult {
	credentialRows: Row[];
	fileRows: {
		formId: string | null;
		id: string;
		key: string;
		kind: "asset" | "signature" | "upload";
		mimeType: string | null;
		originalName: string;
		size: number;
		submissionId: string | null;
		workspaceId: string | null;
	}[];
	folderRows: Row[];
	formRows: Row[];
	integrationRows: Row[];
	manifest: ArchiveManifest;
	pdfTemplateRows: Row[];
	secretsBytes: Uint8Array | null;
	statisticRows: Row[];
	submissionRows: Row[];
	templateRows: Row[];
	versionRows: Row[];
	viewRows: Row[];
	workspaceRow: Row | null;
}

/** First pass: reads every `data/*.jsonl` entry into memory and assigns new ids via `remap`. `files/*` entries are skipped here (copied in the dedicated pass below). */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one flat switch over entry names, each branch trivial
async function readWorkspaceArchiveMetadata(
	source: ArchiveSource,
	remap: RemapTable
): Promise<ReadArchiveResult> {
	const result: ReadArchiveResult = {
		credentialRows: [],
		fileRows: [],
		folderRows: [],
		formRows: [],
		integrationRows: [],
		manifest: null as unknown as ArchiveManifest,
		pdfTemplateRows: [],
		secretsBytes: null,
		submissionRows: [],
		templateRows: [],
		statisticRows: [],
		versionRows: [],
		viewRows: [],
		workspaceRow: null,
	};
	for await (const entry of readZipEntries(source)) {
		if (entry.name.startsWith("files/")) {
			await entry.stream.cancel().catch(() => undefined);
			continue;
		}
		if (entry.name === "manifest.json") {
			result.manifest = upgradeManifest(
				JSON.parse(new TextDecoder().decode(await readEntryBytes(entry))),
				appVersion()
			);
		} else if (entry.name === "secrets.enc") {
			result.secretsBytes = await readEntryBytes(entry);
		} else if (entry.name === "data/workspace.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				result.workspaceRow = row as Row;
			}
		} else if (entry.name === "data/folder.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				remap.set("folder", (row as { id: string }).id, newId());
				result.folderRows.push(row as Row);
			}
		} else if (entry.name === "data/form.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				remap.set("form", (row as { id: string }).id, newId());
				result.formRows.push(row as Row);
			}
		} else if (entry.name === "data/formVersion.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				result.versionRows.push(row as Row);
			}
		} else if (entry.name === "data/formView.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				result.viewRows.push(row as Row);
			}
		} else if (entry.name === "data/formStatistic.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				result.statisticRows.push(row as Row);
			}
		} else if (entry.name === "data/formSubmission.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				remap.set("submission", (row as { id: string }).id, newId());
				result.submissionRows.push(row as Row);
			}
		} else if (entry.name === "data/formIntegration.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				result.integrationRows.push(row as Row);
			}
		} else if (entry.name === "data/pdfTemplate.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				remap.set("pdfTemplate", (row as { id: string }).id, newId());
				result.pdfTemplateRows.push(row as Row);
			}
		} else if (entry.name === "data/template.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				result.templateRows.push(row as Row);
			}
		} else if (entry.name === "data/aiCredential.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				result.credentialRows.push(row as Row);
			}
		} else if (entry.name === "data/storedFile.jsonl") {
			for await (const row of readJsonlEntry(entry)) {
				const r = row as {
					formId: string | null;
					id: string;
					key: string;
					kind: "asset" | "signature" | "upload";
					mimeType: string | null;
					originalName: string;
					size: number;
					submissionId: string | null;
					workspaceId: string | null;
				};
				remap.set("storedFile", r.id, newId());
				result.fileRows.push(r);
			}
		} else {
			await entry.stream.cancel().catch(() => undefined);
		}
	}
	return result;
}

/** Computes each `storedFile` row's new storage key (needs the form id remap already built). */
function planNewFileKeys(
	fileRows: ReadArchiveResult["fileRows"],
	remap: RemapTable
): Map<string, string> {
	const newKeyByOldKey = new Map<string, string>();
	for (const r of fileRows) {
		const base = canonicalFileName(r.originalName || "file");
		const newKey =
			r.kind === "asset"
				? assetKey(base)
				: submissionFileKey(remap.getOrSame("form", r.formId ?? ""), base);
		newKeyByOldKey.set(r.key, newKey);
	}
	return newKeyByOldKey;
}

/** Second pass: streams every `files/*` entry straight into its planned new storage key. */
async function copyWorkspaceArchiveFiles(
	source: ArchiveSource,
	services: Services,
	reporter: BackupJobReporter,
	newKeyByOldKey: Map<string, string>,
	pdfTemplateRows: Row[],
	remap: RemapTable,
	fileCount: number
): Promise<{ pdfSourceKeyByOldKey: Map<string, string> }> {
	const pdfSourceKeyByOldKey = new Map<string, string>();
	let copied = 0;
	for await (const entry of readZipEntries(source)) {
		reporter.checkCancelled();
		if (entry.name.startsWith("files/pdf-source/")) {
			const oldTemplateId = entry.name.slice("files/pdf-source/".length);
			const newTemplateId = remap.getOrSame("pdfTemplate", oldTemplateId);
			const oldRow = pdfTemplateRows.find(
				(t) => (t as { id: string }).id === oldTemplateId
			) as { sourceFileKey?: string | null } | undefined;
			const base = canonicalFileName(
				oldRow?.sourceFileKey?.split("/").pop() ?? "template.pdf"
			);
			const newKey = pdfSourceKey(newTemplateId, base);
			await services.storage.putStream(newKey, entry.stream);
			if (oldRow?.sourceFileKey) {
				pdfSourceKeyByOldKey.set(oldRow.sourceFileKey, newKey);
			}
		} else if (entry.name.startsWith("files/")) {
			const oldKey = entry.name.slice("files/".length);
			const newKey = newKeyByOldKey.get(oldKey);
			if (newKey) {
				await services.storage.putStream(newKey, entry.stream);
			} else {
				await entry.stream.cancel().catch(() => undefined);
			}
			copied += 1;
			reporter.entityProgress("files", copied, fileCount);
		} else {
			await entry.stream.cancel().catch(() => undefined);
		}
	}
	return { pdfSourceKeyByOldKey };
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface ImportContext {
	importerId: string;
	keyRefMap: Map<string, string>;
	newWorkspaceId: string;
	/** Integrations created switched off because their secret wasn't restored. */
	reconnectCount: number;
	remap: RemapTable;
	secrets: Map<string, string> | null;
	/** Form links that actually changed during this import (old → new). */
	slugChanges: { from: string; to: string }[];
}

function rewriteRow<T>(ctx: ImportContext, value: T): T {
	return rewriteValueReferences(
		resolveSecretRefs(value, ctx.secrets),
		ctx.keyRefMap
	);
}

async function insertFolders(
	tx: Tx,
	rows: Row[],
	remap: RemapTable,
	workspaceId: string
) {
	for (const row of rows) {
		const r = row as {
			color: string | null;
			icon: string | null;
			id: string;
			kind: "form" | "template";
			name: string;
			parentId: string | null;
			position: number;
		};
		// biome-ignore lint/performance/noAwaitInLoops: folders are few; inserted in archive order
		await tx.insert(folder).values({
			color: r.color,
			icon: r.icon,
			id: remap.getOrSame("folder", r.id),
			kind: r.kind,
			name: r.name,
			parentId: r.parentId ? remap.getOrSame("folder", r.parentId) : null,
			position: r.position,
			workspaceId,
		});
	}
}

async function insertForms(tx: Tx, rows: Row[], ctx: ImportContext) {
	for (const row of rows) {
		const r = row as Row & {
			folderId: string | null;
			id: string;
			slug: string;
		};
		const newFormId = ctx.remap.getOrSame("form", r.id);
		// biome-ignore lint/performance/noAwaitInLoops: forms are inserted in archive order, one at a time (slug uniqueness depends on prior inserts)
		const slug = await withUniqueSuffix(r.slug, async (candidate) => {
			const [existing] = await tx
				.select({ id: form.id })
				.from(form)
				.where(eq(form.slug, candidate))
				.limit(1);
			return Boolean(existing);
		});
		if (slug !== r.slug) {
			ctx.slugChanges.push({ from: r.slug, to: slug });
		}
		const {
			id: _id,
			folderId,
			workspaceId: _ws,
			creatorId: _creator,
			...rest
		} = r;
		await tx.insert(form).values({
			...(rewriteRow(ctx, rest) as typeof form.$inferInsert),
			creatorId: ctx.importerId,
			customDomain: null,
			folderId: folderId
				? ctx.remap.getOrSame("folder", folderId as string)
				: null,
			id: newFormId,
			slug,
			workspaceId: ctx.newWorkspaceId,
		});
	}
}

async function insertFormVersions(tx: Tx, rows: Row[], ctx: ImportContext) {
	for (const row of rows) {
		const r = row as { formId: string; snapshot: unknown };
		// biome-ignore lint/performance/noAwaitInLoops: inserted in archive order
		await tx.insert(formVersion).values({
			formId: ctx.remap.getOrSame("form", r.formId),
			id: newId(),
			snapshot: rewriteRow(ctx, r.snapshot) as Record<string, unknown>,
			userId: ctx.importerId,
		});
	}
}

const INSERT_BATCH = 500;

/** Copies raw views and daily rollups onto the imported forms (serial ids are re-assigned). */
async function insertFormStats(
	tx: Tx,
	views: Row[],
	statistics: Row[],
	ctx: ImportContext
) {
	const viewValues = views.map((row) => {
		const r = row as { createdAt: string; formId: string; meta: unknown };
		return {
			createdAt: new Date(r.createdAt),
			formId: ctx.remap.getOrSame("form", r.formId),
			meta: (r.meta ?? null) as Record<string, unknown> | null,
		};
	});
	for (let i = 0; i < viewValues.length; i += INSERT_BATCH) {
		// biome-ignore lint/performance/noAwaitInLoops: batched inserts inside one transaction
		await tx.insert(formView).values(viewValues.slice(i, i + INSERT_BATCH));
	}
	const statValues = statistics.map((row) => {
		const r = row as {
			data?: { views?: number };
			date: string;
			formId: string;
		};
		return {
			data: r.data ?? {},
			date: r.date,
			formId: ctx.remap.getOrSame("form", r.formId),
		};
	});
	for (let i = 0; i < statValues.length; i += INSERT_BATCH) {
		// biome-ignore lint/performance/noAwaitInLoops: batched inserts inside one transaction
		await tx
			.insert(formStatistic)
			.values(statValues.slice(i, i + INSERT_BATCH))
			.onConflictDoNothing();
	}
}

async function insertSubmissions(
	tx: Tx,
	rows: Row[],
	ctx: ImportContext,
	reporter: BackupJobReporter
) {
	let done = 0;
	for (const row of rows) {
		const {
			id,
			formId,
			publicId: _publicId,
			...rest
		} = row as Row & {
			formId: string;
			id: string;
		};
		// biome-ignore lint/performance/noAwaitInLoops: inserted in archive order
		await tx.insert(formSubmission).values({
			...(rewriteRow(ctx, rest) as typeof formSubmission.$inferInsert),
			formId: ctx.remap.getOrSame("form", formId),
			id: ctx.remap.getOrSame("submission", id),
			publicId: newPublicId(),
		});
		done += 1;
		reporter.entityProgress("submissions", done, rows.length);
	}
}

async function insertIntegrations(tx: Tx, rows: Row[], ctx: ImportContext) {
	for (const row of rows) {
		const r = row as Row & {
			data: Record<string, unknown>;
			formId: string;
			hadSecret?: boolean;
			integrationId: string;
			logic: Record<string, unknown> | null;
			settings?: Record<string, unknown>;
			status?: "active" | "inactive";
		};
		const restoredSecret = r.hadSecret ? Boolean(ctx.secrets) : true;
		const data = rewriteRow(ctx, r.data);
		const settings = {
			...(rewriteRow(ctx, r.settings ?? {}) as Record<string, unknown>),
			needsReconnect: !restoredSecret,
		};
		if (!restoredSecret) {
			ctx.reconnectCount += 1;
		}
		// biome-ignore lint/performance/noAwaitInLoops: inserted in archive order
		await tx.insert(formIntegration).values({
			data,
			formId: ctx.remap.getOrSame("form", r.formId),
			id: newId(),
			integrationId: r.integrationId,
			logic: r.logic ?? null,
			settings,
			status: restoredSecret ? (r.status ?? "active") : "inactive",
		});
	}
}

async function insertPdfTemplates(
	tx: Tx,
	rows: Row[],
	ctx: ImportContext,
	pdfSourceKeyByOldKey: Map<string, string>
) {
	for (const row of rows) {
		const r = row as Row & {
			formId: string;
			id: string;
			sourceFileKey?: string | null;
		};
		// biome-ignore lint/performance/noAwaitInLoops: inserted in archive order
		await tx.insert(pdfTemplate).values({
			...(rewriteRow(ctx, r) as typeof pdfTemplate.$inferInsert),
			creatorId: ctx.importerId,
			formId: ctx.remap.getOrSame("form", r.formId),
			id: ctx.remap.getOrSame("pdfTemplate", r.id),
			sourceFileKey: r.sourceFileKey
				? (pdfSourceKeyByOldKey.get(r.sourceFileKey) ?? null)
				: null,
		});
	}
}

async function insertTemplates(tx: Tx, rows: Row[], ctx: ImportContext) {
	for (const row of rows) {
		const r = row as Row & { folderId: string | null; slug: string };
		// biome-ignore lint/performance/noAwaitInLoops: slug uniqueness depends on prior inserts
		const slug = await withUniqueSuffix(r.slug, async (candidate) => {
			const [existing] = await tx
				.select({ id: template.id })
				.from(template)
				.where(eq(template.slug, candidate))
				.limit(1);
			return Boolean(existing);
		});
		const { id: _id, workspaceId: _ws, creatorId: _creator, ...rest } = r;
		await tx.insert(template).values({
			...(rewriteRow(ctx, rest) as typeof template.$inferInsert),
			creatorId: ctx.importerId,
			folderId: r.folderId ? ctx.remap.getOrSame("folder", r.folderId) : null,
			id: newId(),
			slug,
			workspaceId: ctx.newWorkspaceId,
		});
	}
}

/** Inserts the `storedFile` DB rows for files already copied to their new storage keys (`newKeyByOldKey`). */
async function insertStoredFiles(
	tx: Tx,
	rows: ReadArchiveResult["fileRows"],
	ctx: ImportContext,
	newKeyByOldKey: Map<string, string>
) {
	for (const r of rows) {
		const newKey = newKeyByOldKey.get(r.key);
		if (!newKey) {
			continue;
		}
		// biome-ignore lint/performance/noAwaitInLoops: inserted in archive order
		await tx.insert(storedFile).values({
			formId: r.formId ? ctx.remap.getOrSame("form", r.formId) : null,
			id: ctx.remap.getOrSame("storedFile", r.id),
			key: newKey,
			kind: r.kind,
			mimeType: r.mimeType,
			originalName: r.originalName,
			size: r.size,
			submissionId: r.submissionId
				? ctx.remap.getOrSame("submission", r.submissionId)
				: null,
			workspaceId: r.workspaceId ? ctx.newWorkspaceId : null,
		});
	}
}

async function insertAiCredential(
	tx: Tx,
	rows: Row[],
	ctx: ImportContext,
	services: Services
) {
	for (const row of rows) {
		const r = row as {
			baseUrl: string | null;
			key: unknown;
			model: string;
			provider: string;
		};
		const resolvedKey = resolveSecretRefs(r.key, ctx.secrets);
		if (typeof resolvedKey === "string" && resolvedKey.length > 0) {
			// biome-ignore lint/performance/noAwaitInLoops: at most one row
			await tx.insert(aiCredential).values({
				baseUrl: r.baseUrl,
				createdBy: ctx.importerId,
				encryptedKey: encryptApiKey(services.config.signingSecret, resolvedKey),
				id: newId(),
				model: r.model,
				provider: r.provider,
				workspaceId: ctx.newWorkspaceId,
			});
		}
	}
}

async function runWorkspaceImport(
	db: Database,
	services: Services,
	jobId: string,
	reporter: BackupJobReporter,
	input: StartWorkspaceImportInput
) {
	const remap = new RemapTable();
	reporter.add("info", "Reading archive");
	const metadata = await readWorkspaceArchiveMetadata(
		await storageSource(services.storage, uploadStorageKey(input.uploadKey)),
		remap
	);
	if (!metadata.manifest) {
		throw new Error("This file doesn't look like a StryveForms archive.");
	}
	if (metadata.manifest.scope !== "workspace") {
		throw new Error("This is an instance backup, not a workspace export.");
	}

	let secrets: Map<string, string> | null = null;
	if (metadata.secretsBytes && input.passphrase) {
		const decrypted = await decryptSecretsMap(
			input.passphrase,
			metadata.secretsBytes
		);
		secrets = new Map(Object.entries(decrypted));
	}

	const newWorkspaceId = newId();
	remap.set("workspace", metadata.workspaceRow?.id as string, newWorkspaceId);
	for (const row of metadata.folderRows) {
		const r = row as { id: string; parentId: string | null };
		if (r.parentId && !remap.get("folder", r.parentId)) {
			remap.set("folder", r.parentId, newId());
		}
	}

	reporter.add("info", "Copying files");
	const newKeyByOldKey = planNewFileKeys(metadata.fileRows, remap);
	const { pdfSourceKeyByOldKey } = await copyWorkspaceArchiveFiles(
		await storageSource(services.storage, uploadStorageKey(input.uploadKey)),
		services,
		reporter,
		newKeyByOldKey,
		metadata.pdfTemplateRows,
		remap,
		metadata.fileRows.length
	);

	const ctx: ImportContext = {
		importerId: input.userId,
		keyRefMap: newKeyByOldKey,
		newWorkspaceId,
		reconnectCount: 0,
		remap,
		secrets,
		slugChanges: [],
	};

	reporter.add("info", "Creating workspace");
	let newWorkspaceName = "Imported workspace";
	await db.transaction(async (tx) => {
		const oldWorkspace = metadata.workspaceRow as {
			brand?: unknown;
			customDomains?: string[];
			icon?: string | null;
			maxFileSize?: number;
			name: string;
			settings?: unknown;
		} | null;
		newWorkspaceName = oldWorkspace?.name ?? newWorkspaceName;
		await tx.insert(workspace).values({
			brand: rewriteRow(ctx, oldWorkspace?.brand ?? {}) as Record<
				string,
				unknown
			>,
			customDomains: oldWorkspace?.customDomains ?? [],
			icon: oldWorkspace?.icon ?? null,
			id: newWorkspaceId,
			maxFileSize: oldWorkspace?.maxFileSize ?? 50,
			name: oldWorkspace?.name ?? "Imported workspace",
			settings: rewriteRow(ctx, oldWorkspace?.settings ?? {}) as Record<
				string,
				unknown
			>,
		});
		await tx.insert(workspaceMember).values({
			role: "admin",
			userId: input.userId,
			workspaceId: newWorkspaceId,
		});

		await insertFolders(tx, metadata.folderRows, remap, newWorkspaceId);
		await insertForms(tx, metadata.formRows, ctx);
		await insertFormVersions(tx, metadata.versionRows, ctx);
		await insertFormStats(tx, metadata.viewRows, metadata.statisticRows, ctx);
		await insertSubmissions(tx, metadata.submissionRows, ctx, reporter);
		await insertIntegrations(tx, metadata.integrationRows, ctx);
		await insertPdfTemplates(
			tx,
			metadata.pdfTemplateRows,
			ctx,
			pdfSourceKeyByOldKey
		);
		await insertTemplates(tx, metadata.templateRows, ctx);
		await insertAiCredential(tx, metadata.credentialRows, ctx, services);
		await insertStoredFiles(tx, metadata.fileRows, ctx, newKeyByOldKey);
	});

	const importedMembers: { email: string; status: "added" | "invited" }[] = [];
	for (const member of input.members) {
		// biome-ignore lint/performance/noAwaitInLoops: members are a short, user-picked list
		const [existingUser] = await db
			.select({ id: authUser.id })
			.from(authUser)
			.where(eq(authUser.email, member.email))
			.limit(1);
		if (existingUser) {
			await db
				.insert(workspaceMember)
				.values({
					role: member.role,
					userId: existingUser.id,
					workspaceId: newWorkspaceId,
				})
				.onConflictDoNothing();
			importedMembers.push({ email: member.email, status: "added" });
		} else {
			const inviteToken = crypto.randomUUID();
			await db.insert(workspaceInvite).values({
				email: member.email,
				expiresAt: new Date(Date.now() + INVITE_EXPIRY_MS),
				id: newId(),
				invitedById: input.userId,
				role: member.role,
				status: "pending",
				token: inviteToken,
				workspaceId: newWorkspaceId,
			});
			importedMembers.push({ email: member.email, status: "invited" });
			if (input.sendInvites) {
				await sendImportInviteEmail(db, services, {
					email: member.email,
					inviteToken,
					workspaceName: newWorkspaceName,
				});
			}
		}
	}

	await finishBackupJob(db, jobId, {
		result: {
			membersAdded: importedMembers.filter((m) => m.status === "added").length,
			membersInvited: importedMembers.filter((m) => m.status === "invited")
				.length,
			reconnectCount: ctx.reconnectCount,
			slugChanges: ctx.slugChanges,
			workspaceId: newWorkspaceId,
			workspaceName: newWorkspaceName,
		},
	});
}

/** Emails a pending invite created during a workspace import, reusing the normal workspace-invite template. */
async function sendImportInviteEmail(
	db: Database,
	services: Services,
	input: { email: string; inviteToken: string; workspaceName: string }
) {
	const branding = await emailBranding(db, services.config);
	await services.mailer.send({
		react: emails.workspaceInvite({
			branding,
			inviteUrl: `${services.config.appUrl}/invites/${input.inviteToken}`,
			inviterName: null,
			workspaceName: input.workspaceName,
		}),
		subject: `You're invited to ${input.workspaceName} on ${branding.appName}`,
		to: input.email,
	});
}

export async function startWorkspaceImport(
	db: Database,
	services: Services,
	input: StartWorkspaceImportInput
): Promise<{ jobId: string }> {
	const { id: jobId } = await createBackupJob(db, {
		kind: "workspace_import",
		options: { sendInvites: input.sendInvites, uploadKey: input.uploadKey },
		userId: input.userId,
	});
	const reporter = new BackupJobReporter(db, jobId);
	runInBackground(db, jobId, reporter, () =>
		runWorkspaceImport(db, services, jobId, reporter, input)
	);
	return { jobId };
}

/* -------------------------------------------------------------------------- */
/*                    Instance backup/restore (for R's jobs)                  */
/* -------------------------------------------------------------------------- */

/** A bridge: writes form one side become readable on the other, without buffering the whole thing (bounded by the stream's own internal queue). */
function createPipe(): { sink: ArchiveSink; source: ArchiveSource } {
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	const source = new ReadableStream<Uint8Array>({
		start(c) {
			controller = c;
		},
	});
	let closed = false;
	const sink: ArchiveSink = {
		abort(reason?: unknown) {
			if (!closed) {
				closed = true;
				controller?.error(reason ?? new Error("pipe aborted"));
			}
			return Promise.resolve();
		},
		close() {
			if (!closed) {
				closed = true;
				controller?.close();
			}
			return Promise.resolve();
		},
		write(chunk: Uint8Array) {
			controller?.enqueue(chunk);
			return Promise.resolve();
		},
	};
	return { sink, source };
}

/** Pipes `stream` into `sink`, returning the total byte count written. */
async function pipeStreamToSink(
	stream: ArchiveSource,
	sink: ArchiveSink
): Promise<number> {
	const reader = stream.getReader();
	let total = 0;
	for (;;) {
		// biome-ignore lint/performance/noAwaitInLoops: a stream must be drained in order
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		total += value.length;
		await sink.write(value);
	}
	return total;
}

export interface WriteInstanceArchiveInput {
	passphrase: string;
	reporter: BackupJobReporter;
	sink: ArchiveSink;
}

/**
 * Writes the WHOLE instance (every workspace + users + instance settings)
 * as a `.stryve-backup` container into `sink`, streamed throughout (the
 * inner ZIP is piped straight into the outer AES-256-GCM container, which
 * is piped straight into `sink` — nothing sits fully in memory). Unlike a
 * workspace export, secrets are kept in plaintext inside the inner ZIP: the
 * outer container is the only protection needed, and it's mandatory here.
 */
export async function writeInstanceArchive(
	db: Database,
	services: Services,
	input: WriteInstanceArchiveInput
): Promise<{ manifest: ArchiveManifest; sizeBytes: number }> {
	const { reporter } = input;
	const workspaces = await db.select().from(workspace);
	const users = await db.select().from(authUser);
	const accounts = await db.select().from(account);
	// Auth plugin tables (instance-only — never part of a workspace export):
	// restoring the instance without these would leave a user's
	// `twoFactorEnabled`/passkey rows unreachable, or a 2FA secret with no
	// account behind it.
	const twoFactors = await db.select().from(twoFactor);
	const passkeys = await db.select().from(passkey);
	const members = await db.select().from(workspaceMember);
	const invites = await db.select().from(workspaceInvite);
	const settingsRows = await db.select().from(instanceSettings);
	const globalTemplates = await db
		.select()
		.from(template)
		.where(isNull(template.workspaceId));
	const credentials = await db.select().from(aiCredential);
	const allForms = await db.select().from(form).where(isNull(form.deletedAt));
	const allFolders = await db.select().from(folder);
	const allVersions = await db.select().from(formVersion);
	const allViews = await db.select().from(formView);
	const allStatistics = await db.select().from(formStatistic);
	const allSubmissions = await db.select().from(formSubmission);
	const allIntegrations = await db
		.select()
		.from(formIntegration)
		.where(isNull(formIntegration.deletedAt));
	const allPdfTemplates = await db.select().from(pdfTemplate);
	const allFiles = await db.select().from(storedFile);

	const manifest: ArchiveManifest = {
		appVersion: appVersion(),
		counts: {
			files: allFiles.length,
			folders: allFolders.length,
			forms: allForms.length,
			integrations: allIntegrations.length,
			submissions: allSubmissions.length,
			users: users.length,
			workspaces: workspaces.length,
		},
		createdAt: new Date().toISOString(),
		encryption: { includesSecrets: true },
		format: ARCHIVE_FORMAT,
		formatVersion: CURRENT_FORMAT_VERSION,
		includesSecrets: true,
		includesUploads: true,
		scope: "instance",
		source: {
			instanceName: services.config.appName,
			url: services.config.appUrl,
		},
		workspaces: workspaces.map((w) => ({ id: w.id, name: w.name })),
	};

	const pipe = createPipe();
	const builder = new ZipBuilder(pipe.sink);
	const encrypted = encryptStream(pipe.source, input.passphrase);
	// Start forwarding the encrypted output concurrently — this is what makes
	// the whole chain stream instead of buffering the inner ZIP in memory.
	const forwarding = pipeStreamToSink(encrypted, input.sink);

	await builder.addBytes(
		"manifest.json",
		new TextEncoder().encode(JSON.stringify(manifest))
	);
	await builder.addJsonl("data/instanceSettings.jsonl", settingsRows);
	await builder.addJsonl("data/user.jsonl", users);
	await builder.addJsonl("data/account.jsonl", accounts);
	await builder.addJsonl("data/twoFactor.jsonl", twoFactors);
	await builder.addJsonl("data/passkey.jsonl", passkeys);
	await builder.addJsonl("data/workspace.jsonl", workspaces);
	await builder.addJsonl("data/workspaceMember.jsonl", members);
	await builder.addJsonl("data/workspaceInvite.jsonl", invites);
	await builder.addJsonl("data/folder.jsonl", allFolders);
	await builder.addJsonl("data/form.jsonl", allForms);
	reporter.entityProgress("forms", allForms.length, allForms.length);
	await builder.addJsonl("data/formVersion.jsonl", allVersions);
	await builder.addJsonl("data/formView.jsonl", allViews);
	await builder.addJsonl("data/formStatistic.jsonl", allStatistics);
	await builder.addJsonl("data/formSubmission.jsonl", allSubmissions);
	reporter.entityProgress(
		"submissions",
		allSubmissions.length,
		allSubmissions.length
	);
	await builder.addJsonl("data/formIntegration.jsonl", allIntegrations);
	await builder.addJsonl("data/pdfTemplate.jsonl", allPdfTemplates);
	await builder.addJsonl("data/template.jsonl", globalTemplates);
	await builder.addJsonl("data/aiCredential.jsonl", credentials);
	await builder.addJsonl("data/storedFile.jsonl", allFiles);

	let doneFiles = 0;
	for (const f of allFiles) {
		reporter.checkCancelled();
		// biome-ignore lint/performance/noAwaitInLoops: files are streamed into the archive one at a time, in order
		const stream = await services.storage.getStream(f.key);
		if (stream) {
			await builder.addStream(`files/${f.key}`, stream);
		}
		doneFiles += 1;
		reporter.entityProgress("files", doneFiles, allFiles.length);
		await reporter.flush();
	}
	await builder.finish();
	await pipe.sink.close();
	const sizeBytes = await forwarding;
	await input.sink.close();

	return { manifest, sizeBytes };
}

export interface InspectInstanceBackupInput {
	passphrase: string;
	source: ArchiveSource;
}

export interface InstanceBackupOverview {
	manifest: ArchiveManifest;
}

/** Throws `WrongPassphraseError`/`TruncatedContainerError` (crypto.ts) on a bad passphrase or a cut-off file. */
export async function inspectInstanceBackup(
	_db: Database,
	_services: Services,
	input: InspectInstanceBackupInput
): Promise<InstanceBackupOverview> {
	const plain = decryptStream(input.source, input.passphrase);
	for await (const entry of readZipEntries(plain)) {
		if (entry.name === "manifest.json") {
			const manifest = upgradeManifest(
				JSON.parse(new TextDecoder().decode(await readEntryBytes(entry))),
				appVersion()
			);
			return { manifest };
		}
		await entry.stream.cancel().catch(() => undefined);
	}
	throw new Error("This backup file has no manifest.");
}

/** Cheap pre-check (no decryption): peeks the outer container's version before asking for a passphrase. */
export async function peekInstanceBackupContainer(source: ArchiveSource) {
	return await readContainerHeader(source);
}

export interface RestoreInstanceArchiveInput {
	passphrase: string;
	reporter: BackupJobReporter;
	source: ArchiveSource;
}

const RESTORE_TABLES = [
	{ key: "user", table: authUser },
	{ key: "account", table: account },
	{ key: "twoFactor", table: twoFactor },
	{ key: "passkey", table: passkey },
	{ key: "workspace", table: workspace },
	{ key: "workspaceMember", table: workspaceMember },
	{ key: "workspaceInvite", table: workspaceInvite },
	{ key: "folder", table: folder },
	{ key: "form", table: form },
	{ key: "formVersion", table: formVersion },
	{ key: "formView", table: formView },
	{ key: "formStatistic", table: formStatistic },
	{ key: "formSubmission", table: formSubmission },
	{ key: "formIntegration", table: formIntegration },
	{ key: "pdfTemplate", table: pdfTemplate },
	{ key: "template", table: template },
	{ key: "aiCredential", table: aiCredential },
	{ key: "storedFile", table: storedFile },
] as const;

const SERIAL_ID_TABLES = new Set(["formView", "formStatistic"]);

function withoutId(row: Row): Row {
	const { id: _id, ...rest } = row as Row & { id?: unknown };
	return rest as Row;
}

/**
 * Wipes and restores the whole instance from a `.stryve-backup` container.
 * Ids are kept as-is (no remapping — BACKUP_DESIGN.md "Full restore" says
 * ids stay the same after a restore). R's instance-jobs.ts owns the
 * confirmation step and the safety backup taken before calling this.
 */
export async function restoreInstanceArchive(
	db: Database,
	services: Services,
	input: RestoreInstanceArchiveInput
): Promise<{ manifest: ArchiveManifest }> {
	const plain = decryptStream(input.source, input.passphrase);
	let manifest: ArchiveManifest | null = null;
	const rows: Record<string, Row[]> = {};
	for await (const entry of readZipEntries(plain)) {
		input.reporter.checkCancelled();
		if (entry.name === "manifest.json") {
			manifest = upgradeManifest(
				JSON.parse(new TextDecoder().decode(await readEntryBytes(entry))),
				appVersion()
			);
		} else if (entry.name.startsWith("data/")) {
			const name = entry.name.slice("data/".length).replace(".jsonl", "");
			rows[name] = [];
			for await (const row of readJsonlEntry(entry)) {
				rows[name].push(row as Row);
			}
		} else if (entry.name.startsWith("files/")) {
			const key = entry.name.slice("files/".length);
			await services.storage.putStream(key, entry.stream);
		} else {
			await entry.stream.cancel().catch(() => undefined);
		}
	}
	if (manifest?.scope !== "instance") {
		throw new Error("This file isn't a full instance backup.");
	}

	await db.transaction(async (tx) => {
		// Wipe children before parents, then restore every table in the same
		// (parent-first) order, with its original id.
		for (const { table } of [...RESTORE_TABLES].reverse()) {
			// biome-ignore lint/performance/noAwaitInLoops: each table must be emptied before the next, in FK-safe order
			await tx.delete(table);
		}
		for (const { key, table } of RESTORE_TABLES) {
			const tableRows = (rows[key] ?? []).map((row) =>
				// Serial-id tables get fresh ids so their sequences stay in step.
				SERIAL_ID_TABLES.has(key) ? withoutId(row) : row
			);
			for (let i = 0; i < tableRows.length; i += INSERT_BATCH) {
				// biome-ignore lint/performance/noAwaitInLoops: restored in archive order inside one transaction
				await tx
					.insert(table)
					.values(tableRows.slice(i, i + INSERT_BATCH) as never);
			}
		}
		// biome-ignore lint/suspicious/noUnnecessaryConditions: tsc's noUncheckedIndexedAccess makes this genuinely `Row[] | undefined`
		const [settingsRow] = rows.instanceSettings ?? [];
		if (settingsRow) {
			await tx
				.update(instanceSettings)
				.set(settingsRow as Partial<typeof instanceSettings.$inferInsert>)
				.where(eq(instanceSettings.id, (settingsRow as { id: string }).id));
		}
	});

	return { manifest };
}
