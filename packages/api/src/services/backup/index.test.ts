/**
 * End-to-end round-trip tests against a THROWAWAY database and storage
 * path — never the dev DB (see BACKUP_DESIGN.md "Test safety"). Run with:
 *
 *   docker exec StryveForms-postgres psql -U postgres -c 'CREATE DATABASE "StryveForms_bk_p";'
 *   DATABASE_URL=postgresql://postgres:password@localhost:5432/StryveForms_bk_p \
 *     bunx drizzle-kit push --force   (from packages/db)
 *
 * before `bun test` picks this file up. Skips itself (no failures) if that
 * database doesn't exist, so a normal `bun test` run elsewhere is unaffected.
 */
import { createDb } from "@StryveForms/db";
import { account, user } from "@StryveForms/db/schema/auth";
import { aiCredential } from "@StryveForms/db/schema/features";
import {
	folder,
	form,
	formIntegration,
	formStatistic,
	formSubmission,
	formVersion,
	formView,
	storedFile,
	template,
	workspace,
	workspaceInvite,
	workspaceMember,
} from "@StryveForms/db/schema/forms";
import type { Mailer } from "@StryveForms/emails/mailer";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import type { Services } from "../../context";
import { encryptApiKey } from "../ai/crypto";
import { createStorage } from "../storage";
import {
	BackupJobReporter,
	getBackupJob,
	inspectWorkspaceArchive,
	newUploadKey,
	restoreInstanceArchive,
	startWorkspaceExport,
	startWorkspaceImport,
	uploadKeyCreatedAt,
	uploadStorageKey,
	writeInstanceArchive,
} from "./index";
import { memorySink, sourceFromBytes } from "./streams";

const THROWAWAY_URL =
	"postgresql://postgres:password@localhost:5432/StryveForms_bk_p";
const STORAGE_PATH = "/tmp/sf-bk-p/storage";
const SIGNING_SECRET = "a-32-char-or-longer-test-secret!!";

let dbAvailable = true;
const db = createDb({ DATABASE_URL: THROWAWAY_URL });

beforeAll(async () => {
	try {
		await db.select().from(workspace).limit(1);
	} catch {
		dbAvailable = false;
	}
});

const services: Services = {
	config: {
		appName: "StryveForms Test",
		appUrl: "https://example.test",
		captcha: {},
		importRateLimitPerMinute: 60,
		serverUrl: "https://example.test",
		signingSecret: SIGNING_SECRET,
	},
	mailer: {
		logOnly: true,
		send: () => Promise.resolve({ messageId: "test" }),
	} satisfies Mailer,
	storage: createStorage({ STORAGE_DRIVER: "local", STORAGE_PATH }),
};

async function waitForJob(jobId: string) {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: polling a job's own status is inherently sequential
		const job = await getBackupJob(db, jobId);
		if (job && job.status !== "running" && job.status !== "pending") {
			return job;
		}
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error(`Job ${jobId} did not finish in time`);
}

const OWNER_ID = "test_owner_user";
const MEMBER_ID = "test_member_user";
const WORKSPACE_ID = "test_ws_1";
const FOLDER_ID = "test_folder_1";
const FORM_ID = "test_form_1";
const FORM_VERSION_ID = "test_formversion_1";
const SUBMISSION_ID = "test_submission_1";
const INTEGRATION_ID = "test_integration_1";
const TEMPLATE_ID = "test_template_1";
const FILE_ID = "test_file_1";
const AI_CREDENTIAL_ID = "test_ai_credential_1";
const WEBHOOK_SECRET = "s3cr3t-webhook-token-value";
const AI_KEY_PLAINTEXT = "sk-test-plaintext-ai-key";
const FILE_KEY = "assets/test_logo_abc123.png";
const FILE_BYTES = new Uint8Array([1, 2, 3, 4, 5]);

async function seedWorkspace() {
	await db.insert(user).values([
		{ email: "owner@example.test", id: OWNER_ID, name: "Owner" },
		{ email: "member@example.test", id: MEMBER_ID, name: "Member" },
	]);
	await db.insert(workspace).values({
		brand: {
			logoUrl: `https://example.test/api/assets/${FILE_KEY.split("/")[1]}`,
		},
		id: WORKSPACE_ID,
		name: "Acme Backup Test",
		settings: {
			smtp: { host: "smtp.example.test", password: "smtp-secret-pw" },
		},
	});
	await db
		.insert(workspaceMember)
		.values({ role: "admin", userId: MEMBER_ID, workspaceId: WORKSPACE_ID });
	await db.insert(workspaceInvite).values({
		email: "invitee@example.test",
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		id: "test_invite_1",
		role: "user",
		status: "pending",
		token: "test-invite-token",
		workspaceId: WORKSPACE_ID,
	});
	await db
		.insert(folder)
		.values({ id: FOLDER_ID, name: "Test folder", workspaceId: WORKSPACE_ID });
	await db.insert(form).values({
		coverPicture: `https://example.test/api/assets/${FILE_KEY.split("/")[1]}`,
		folderId: FOLDER_ID,
		id: FORM_ID,
		properties: [{ id: "f1", name: "Name", type: "text" }],
		slug: "acme-roundtrip-form",
		title: "Round-trip form",
		workspaceId: WORKSPACE_ID,
	});
	await db.insert(formVersion).values({
		formId: FORM_ID,
		id: FORM_VERSION_ID,
		snapshot: { title: "Round-trip form v1" },
		userId: MEMBER_ID,
	});
	await db.insert(formView).values([{ formId: FORM_ID }, { formId: FORM_ID }]);
	await db
		.insert(formStatistic)
		.values({ data: { views: 5 }, date: "2026-10-01", formId: FORM_ID });
	await db.insert(formSubmission).values({
		data: { f1: "hello world" },
		formId: FORM_ID,
		id: SUBMISSION_ID,
		publicId: "test-public-id-1",
	});
	await db.insert(formIntegration).values({
		data: {
			webhook_secret: WEBHOOK_SECRET,
			webhook_url: "https://hooks.example.test/abc",
		},
		formId: FORM_ID,
		id: INTEGRATION_ID,
		integrationId: "webhook",
		settings: { auth_token: "bearer-secret-value", auth_type: "bearer" },
	});
	await db.insert(template).values({
		id: TEMPLATE_ID,
		name: "Test template",
		slug: "acme-roundtrip-template",
		structure: { title: "Template body" },
		workspaceId: WORKSPACE_ID,
	});
	await services.storage.put(FILE_KEY, FILE_BYTES, "image/png");
	await db.insert(storedFile).values({
		id: FILE_ID,
		key: FILE_KEY,
		kind: "asset",
		originalName: "logo.png",
		size: FILE_BYTES.length,
		workspaceId: WORKSPACE_ID,
	});
	await db.insert(aiCredential).values({
		encryptedKey: encryptApiKey(SIGNING_SECRET, AI_KEY_PLAINTEXT),
		id: AI_CREDENTIAL_ID,
		model: "gpt-test",
		provider: "openai",
		workspaceId: WORKSPACE_ID,
	});
}

async function cleanupWorkspace() {
	await db
		.delete(workspaceInvite)
		.where(eq(workspaceInvite.workspaceId, WORKSPACE_ID));
	await db
		.delete(workspaceMember)
		.where(eq(workspaceMember.workspaceId, WORKSPACE_ID));
	await db
		.delete(aiCredential)
		.where(eq(aiCredential.workspaceId, WORKSPACE_ID));
	await db.delete(storedFile).where(eq(storedFile.workspaceId, WORKSPACE_ID));
	await db.delete(template).where(eq(template.workspaceId, WORKSPACE_ID));
	await db.delete(formIntegration).where(eq(formIntegration.formId, FORM_ID));
	await db.delete(formSubmission).where(eq(formSubmission.formId, FORM_ID));
	await db.delete(formVersion).where(eq(formVersion.formId, FORM_ID));
	await db.delete(form).where(eq(form.workspaceId, WORKSPACE_ID));
	await db.delete(folder).where(eq(folder.workspaceId, WORKSPACE_ID));
	await db.delete(workspace).where(eq(workspace.id, WORKSPACE_ID));
	await db.delete(account).where(eq(account.userId, OWNER_ID));
	await db.delete(user).where(eq(user.id, OWNER_ID));
	await db.delete(user).where(eq(user.id, MEMBER_ID));
}

/** Copies a finished export's bytes to where an uploaded file would live, simulating download+re-upload. */
async function copyExportToUpload(fileKey: string, uploadKey: string) {
	const stream = await services.storage.getStream(fileKey);
	if (!stream) {
		throw new Error("export file missing");
	}
	await services.storage.putStream(`tmp/backups/${uploadKey}`, stream);
}

describe("upload keys", () => {
	test("accepts fresh keys and reads their timestamp", () => {
		const key = newUploadKey();
		expect(uploadStorageKey(key)).toBe(`tmp/backups/${key}`);
		const age = Date.now() - (uploadKeyCreatedAt(key)?.getTime() ?? 0);
		expect(age).toBeLessThan(5000);
	});

	test("rejects keys that try to escape tmp/backups", () => {
		expect(() => uploadStorageKey("../../exports/abc.stryve.zip")).toThrow();
		expect(() => uploadStorageKey("x/../../y")).toThrow();
		expect(uploadKeyCreatedAt("not-a-key")).toBeNull();
	});
});

describe("workspace export/import round-trip (throwaway DB)", () => {
	beforeAll(async () => {
		if (!dbAvailable) {
			return;
		}
		await cleanupWorkspace().catch(() => undefined);
		await seedWorkspace();
	});

	afterAll(async () => {
		if (!dbAvailable) {
			return;
		}
		await cleanupWorkspace().catch(() => undefined);
	});

	test("export with secrets, then import into a new workspace", async () => {
		if (!dbAvailable) {
			console.warn(
				"[skip] StryveForms_bk_p throwaway database not reachable — see file header"
			);
			return;
		}

		const passphrase = "a-strong-test-passphrase-123";
		const { jobId: exportJobId } = await startWorkspaceExport(db, services, {
			includeUploads: true,
			passphrase,
			trigger: "manual",
			userId: MEMBER_ID,
			workspaceId: WORKSPACE_ID,
		});
		const exportJob = await waitForJob(exportJobId);
		expect(exportJob.status).toBe("completed");
		expect(exportJob.fileKey).toBeTruthy();
		const exportResult = exportJob.result as { counts: Record<string, number> };
		expect(exportResult.counts.forms).toBe(1);
		expect(exportResult.counts.submissions).toBe(1);

		const uploadKey = newUploadKey();
		await copyExportToUpload(exportJob.fileKey as string, uploadKey);

		const overview = await inspectWorkspaceArchive(db, services, {
			passphrase,
			uploadKey,
			userId: OWNER_ID,
		});
		expect(overview.passphraseOk).toBe(true);
		expect(overview.counts.forms).toBe(1);
		const memberEmails = overview.members.map((m) => m.email).sort();
		expect(memberEmails).toEqual([
			"invitee@example.test",
			"member@example.test",
		]);
		const member = overview.members.find(
			(m) => m.email === "member@example.test"
		);
		expect(member?.hasAccount).toBe(true);
		const invite = overview.members.find(
			(m) => m.email === "invitee@example.test"
		);
		expect(invite?.hasAccount).toBe(false);
		// The source form's slug is still taken (it's the same DB) — the
		// preview must flag that it will change.
		expect(overview.slugChanges).toHaveLength(1);
		expect(overview.slugChanges[0]?.from).toBe("acme-roundtrip-form");

		const { jobId: importJobId } = await startWorkspaceImport(db, services, {
			members: [{ email: "member@example.test", role: "admin" }],
			passphrase,
			sendInvites: false,
			uploadKey,
			userId: OWNER_ID,
		});
		const importJob = await waitForJob(importJobId);
		expect(importJob.status).toBe("completed");
		const importResult = importJob.result as {
			membersAdded: number;
			membersInvited: number;
			workspaceId: string;
		};
		expect(importResult.membersAdded).toBe(1);
		const newWorkspaceId = importResult.workspaceId;
		expect(newWorkspaceId).not.toBe(WORKSPACE_ID);

		const [newWorkspace] = await db
			.select()
			.from(workspace)
			.where(eq(workspace.id, newWorkspaceId));
		expect(newWorkspace?.name).toBe("Acme Backup Test");
		// The SMTP password secret was included (passphrase given) and restored.
		const newSettings = newWorkspace?.settings as {
			smtp?: { password?: string };
		};
		expect(newSettings.smtp?.password).toBe("smtp-secret-pw");

		const [newForm] = await db
			.select()
			.from(form)
			.where(eq(form.workspaceId, newWorkspaceId));
		expect(newForm).toBeTruthy();
		expect(newForm?.id).not.toBe(FORM_ID);
		// Slug changed because the original is still taken in this same DB.
		expect(newForm?.slug).not.toBe("acme-roundtrip-form");
		expect(newForm?.slug?.startsWith("acme-roundtrip-form-")).toBe(true);
		// The cover picture URL referenced the old asset file name — it must
		// have been rewritten to point at the newly copied file.
		expect(newForm?.coverPicture).not.toContain(FILE_KEY.split("/")[1]);

		// View counts came along: 2 raw views + a daily rollup of 5.
		const newViews = await db
			.select()
			.from(formView)
			.where(eq(formView.formId, newForm?.id as string));
		expect(newViews).toHaveLength(2);
		const [newStat] = await db
			.select()
			.from(formStatistic)
			.where(eq(formStatistic.formId, newForm?.id as string));
		expect(newStat?.data.views).toBe(5);

		const [newSubmission] = await db
			.select()
			.from(formSubmission)
			.where(eq(formSubmission.formId, newForm?.id as string));
		expect((newSubmission?.data as { f1: string } | undefined)?.f1).toBe(
			"hello world"
		);
		expect(newSubmission?.publicId).not.toBe("test-public-id-1");

		const [newIntegration] = await db
			.select()
			.from(formIntegration)
			.where(eq(formIntegration.formId, newForm?.id as string));
		expect(newIntegration?.data).toMatchObject({
			webhook_secret: WEBHOOK_SECRET,
		});
		expect(
			(newIntegration?.settings as { auth_token?: string } | undefined)
				?.auth_token
		).toBe("bearer-secret-value");
		expect(
			(newIntegration?.settings as { needsReconnect?: boolean } | undefined)
				?.needsReconnect
		).toBe(false);
		expect(newIntegration?.status).toBe("active");

		const [newFile] = await db
			.select()
			.from(storedFile)
			.where(eq(storedFile.workspaceId, newWorkspaceId));
		expect(newFile).toBeTruthy();
		expect(newFile?.key).not.toBe(FILE_KEY);
		const copiedBytes = await services.storage.get(newFile?.key as string);
		expect(await copiedBytes?.bytes()).toEqual(FILE_BYTES);

		const [newCredential] = await db
			.select()
			.from(aiCredential)
			.where(eq(aiCredential.workspaceId, newWorkspaceId));
		expect(newCredential).toBeTruthy();

		const [newTemplate] = await db
			.select()
			.from(template)
			.where(eq(template.workspaceId, newWorkspaceId));
		expect(newTemplate?.slug).not.toBe("acme-roundtrip-template");

		const newMember = await db
			.select()
			.from(workspaceMember)
			.where(eq(workspaceMember.workspaceId, newWorkspaceId));
		// The importer (admin) + the one ticked member.
		expect(newMember).toHaveLength(2);

		// Clean up the imported copy so repeat runs stay idempotent.
		await db
			.delete(workspaceMember)
			.where(eq(workspaceMember.workspaceId, newWorkspaceId));
		await db
			.delete(aiCredential)
			.where(eq(aiCredential.workspaceId, newWorkspaceId));
		await db
			.delete(storedFile)
			.where(eq(storedFile.workspaceId, newWorkspaceId));
		await db.delete(template).where(eq(template.workspaceId, newWorkspaceId));
		await db
			.delete(formIntegration)
			.where(eq(formIntegration.formId, newForm?.id as string));
		await db
			.delete(formSubmission)
			.where(eq(formSubmission.formId, newForm?.id as string));
		await db
			.delete(formVersion)
			.where(eq(formVersion.formId, newForm?.id as string));
		await db.delete(form).where(eq(form.workspaceId, newWorkspaceId));
		await db.delete(folder).where(eq(folder.workspaceId, newWorkspaceId));
		await db.delete(workspace).where(eq(workspace.id, newWorkspaceId));
	}, 30_000);

	test("export without secrets leaves the imported integration needing reconnection", async () => {
		if (!dbAvailable) {
			return;
		}
		const { jobId: exportJobId } = await startWorkspaceExport(db, services, {
			includeUploads: false,
			trigger: "manual",
			userId: MEMBER_ID,
			workspaceId: WORKSPACE_ID,
		});
		const exportJob = await waitForJob(exportJobId);
		expect(exportJob.status).toBe("completed");

		const uploadKey = newUploadKey();
		await copyExportToUpload(exportJob.fileKey as string, uploadKey);

		const { jobId: importJobId } = await startWorkspaceImport(db, services, {
			members: [],
			sendInvites: false,
			uploadKey,
			userId: OWNER_ID,
		});
		const importJob = await waitForJob(importJobId);
		expect(importJob.status).toBe("completed");
		const { workspaceId: newWorkspaceId } = importJob.result as {
			workspaceId: string;
		};

		const [newForm] = await db
			.select()
			.from(form)
			.where(eq(form.workspaceId, newWorkspaceId));
		const [newIntegration] = await db
			.select()
			.from(formIntegration)
			.where(eq(formIntegration.formId, newForm?.id as string));
		expect(newIntegration?.status).toBe("inactive");
		expect(
			(newIntegration?.settings as { needsReconnect?: boolean } | undefined)
				?.needsReconnect
		).toBe(true);
		expect(newIntegration?.data).toMatchObject({ webhook_secret: "" });

		await db
			.delete(formIntegration)
			.where(eq(formIntegration.formId, newForm?.id as string));
		await db
			.delete(formSubmission)
			.where(eq(formSubmission.formId, newForm?.id as string));
		await db
			.delete(formVersion)
			.where(eq(formVersion.formId, newForm?.id as string));
		await db
			.delete(storedFile)
			.where(eq(storedFile.workspaceId, newWorkspaceId));
		await db.delete(template).where(eq(template.workspaceId, newWorkspaceId));
		await db
			.delete(aiCredential)
			.where(eq(aiCredential.workspaceId, newWorkspaceId));
		await db.delete(form).where(eq(form.workspaceId, newWorkspaceId));
		await db.delete(folder).where(eq(folder.workspaceId, newWorkspaceId));
		await db
			.delete(workspaceMember)
			.where(eq(workspaceMember.workspaceId, newWorkspaceId));
		await db.delete(workspace).where(eq(workspace.id, newWorkspaceId));
	}, 30_000);
});

describe("instance backup write/restore round-trip (throwaway DB ONLY)", () => {
	beforeAll(async () => {
		if (!dbAvailable) {
			return;
		}
		await cleanupWorkspace().catch(() => undefined);
		await seedWorkspace();
	});

	afterAll(async () => {
		if (!dbAvailable) {
			return;
		}
		await cleanupWorkspace().catch(() => undefined);
	});

	test("writeInstanceArchive -> restoreInstanceArchive preserves ids and data", async () => {
		if (!dbAvailable) {
			return;
		}
		const passphrase = "a-strong-instance-passphrase-1";
		const sink = memorySink();
		const { manifest, sizeBytes } = await writeInstanceArchive(db, services, {
			passphrase,
			reporter: new BackupJobReporter(db, "test-instance-backup-job"),
			sink,
		});
		expect(manifest.scope).toBe("instance");
		expect(sizeBytes).toBeGreaterThan(0);
		expect(sink.bytes().length).toBe(sizeBytes);

		const result = await restoreInstanceArchive(db, services, {
			passphrase,
			reporter: new BackupJobReporter(db, "test-instance-restore-job"),
			source: sourceFromBytes(sink.bytes()),
		});
		expect(result.manifest.scope).toBe("instance");

		// Ids are preserved on a full restore — the seeded rows must be back,
		// unchanged, under their original ids.
		const [restoredWorkspace] = await db
			.select()
			.from(workspace)
			.where(eq(workspace.id, WORKSPACE_ID));
		expect(restoredWorkspace?.name).toBe("Acme Backup Test");
		const [restoredForm] = await db
			.select()
			.from(form)
			.where(eq(form.id, FORM_ID));
		expect(restoredForm?.slug).toBe("acme-roundtrip-form");
		const [restoredUser] = await db
			.select()
			.from(user)
			.where(eq(user.id, OWNER_ID));
		expect(restoredUser?.email).toBe("owner@example.test");
	}, 30_000);
});
