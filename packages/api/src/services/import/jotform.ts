// biome-ignore-all lint/performance/noAwaitInLoops: imports run step by step to stay within JotForm's limits
/**
 * Imports forms, submissions, uploaded files, email notifications and webhooks
 * from a JotForm account using the account owner's API key.
 */
import type { Database } from "@StryveForms/db";
import {
	form,
	formIntegration,
	formSubmission,
	workspace,
	workspaceMember,
} from "@StryveForms/db/schema/forms";
import type { FormField } from "@StryveForms/forms/types";
import {
	JotformClient,
	type JotformConnectOptions,
} from "@StryveForms/jotform-import/client";
import {
	mapForm,
	mapIntegrations,
	mapSubmission,
} from "@StryveForms/jotform-import/map";
import type {
	JotformFormSummary,
	JotformProperties,
	JotformQuestion,
	JotformRegion,
	JotformSubmission,
	JotformUser,
} from "@StryveForms/jotform-import/types";
import { eq, inArray } from "drizzle-orm";

import type { Services } from "../../context";
import { requireWorkspace } from "../../lib/access";
import { formSlug, newId, newPublicId } from "../../lib/ids";
import { toFormColumns } from "../../lib/serialize";
import {
	copyAsset,
	createJob,
	ImportCancelled,
	ImportMappings,
	JobReporter,
	runJob,
	runPool,
	storeSubmissionFile,
} from "./jobs";
import {
	buildPreview,
	type FormPreview,
	type ImportPreview,
	mapConcurrent,
	type PreviewIntegration,
} from "./preview";

const CONNECTION_TTL_MS = 2 * 60 * 60 * 1000;
const FILE_CONCURRENCY = 4;
const PREVIEW_CONCURRENCY = 4;
const SUBMISSION_PAGE = 1000;
const IMG_SRC = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
const NEW_WORKSPACE_NAME = "JotForm";

/* ------------------------------- Connections ----------------------------- */

interface Connection {
	apiKey: string;
	baseUrl: string;
	createdAt: number;
	forms: JotformFormSummary[];
	region: JotformRegion | "enterprise";
	user: JotformUser;
	userId: string;
}

/** API keys are only kept in memory, never written to the database. */
const connections = new Map<string, Connection>();

function cleanupConnections() {
	const now = Date.now();
	for (const [id, c] of connections) {
		if (now - c.createdAt > CONNECTION_TTL_MS) {
			connections.delete(id);
		}
	}
}

export function getJotformConnection(
	connectionId: string,
	userId: string
): Connection | null {
	cleanupConnections();
	const connection = connections.get(connectionId);
	return connection && connection.userId === userId ? connection : null;
}

function clientFor(connection: Connection) {
	return new JotformClient({
		apiKey: connection.apiKey,
		baseUrl: connection.baseUrl,
	});
}

function mappingsFor(db: Database, connection: Connection) {
	return new ImportMappings(db, connection.baseUrl, connection.userId);
}

function accountKey(connection: Connection) {
	return `account:${connection.user.username}`;
}

export async function connectJotform(
	db: Database,
	userId: string,
	options: Pick<JotformConnectOptions, "apiKey" | "endpoint">
) {
	const { client, region, user } = await JotformClient.connect(options);
	const forms = await client.listForms();
	const connectionId = newPublicId();
	const connection: Connection = {
		apiKey: options.apiKey,
		baseUrl: client.baseUrl,
		createdAt: Date.now(),
		forms,
		region,
		user,
		userId,
	};
	connections.set(connectionId, connection);
	return {
		account: {
			email: user.email,
			name: user.name || user.username,
			region,
			username: user.username,
		},
		apiCallsLeft: client.limitLeft,
		connectionId,
		forms: await describeForms(db, connection),
	};
}

async function describeForms(db: Database, connection: Connection) {
	const imported = await mappingsFor(db, connection).importedForms(
		connection.forms.map((f) => f.id)
	);
	return connection.forms.map((f) => ({
		createdAt: f.created_at,
		id: f.id,
		importedFormId: imported.get(f.id) ?? null,
		lastSubmission: f.last_submission ?? null,
		status: f.status,
		submissionsCount: Number(f.count ?? 0),
		title: f.title,
		updatedAt: f.updated_at ?? null,
	}));
}

/* -------------------------------- Selection ------------------------------ */

export interface JotformImportOptions {
	files: boolean;
	integrations: boolean;
	submissions: boolean;
}

export interface JotformSelection {
	formIds: string[];
	options: JotformImportOptions;
	targetWorkspaceId: string | "new";
}

function selectedForms(connection: Connection, formIds: string[]) {
	const byId = new Map(connection.forms.map((f) => [f.id, f]));
	return formIds.map((id) => {
		const summary = byId.get(id);
		if (!summary) {
			throw new Error(
				"A selected form isn't in this JotForm account. Connect again."
			);
		}
		return summary;
	});
}

async function targetWorkspaceName(
	db: Database,
	connection: Connection,
	targetWorkspaceId: string | "new"
) {
	const id =
		targetWorkspaceId === "new"
			? await mappingsFor(db, connection).get(
					"workspace",
					accountKey(connection)
				)
			: targetWorkspaceId;
	if (id) {
		const [row] = await db
			.select({ name: workspace.name })
			.from(workspace)
			.where(eq(workspace.id, id));
		if (row) {
			return row.name;
		}
	}
	return `New workspace “${NEW_WORKSPACE_NAME}”`;
}

/* --------------------------------- Preview ------------------------------- */

function integrationName(id: string, note: string | null): string {
	if (id === "webhook") {
		return "Webhook";
	}
	return note ? "Autoresponder" : "Email notification";
}

/** Reads one form's questions, files and webhooks for the overview. */
async function previewForm(
	client: JotformClient,
	summary: JotformFormSummary,
	options: JotformImportOptions,
	target: Pick<FormPreview, "action" | "importedFormId" | "targetWorkspace">
): Promise<FormPreview> {
	const withFiles = options.submissions && options.files;
	const result: FormPreview = {
		...target,
		fields: [],
		files: withFiles ? 0 : null,
		filesSize: null,
		integrations: [],
		sourceId: summary.id,
		submissions: options.submissions ? Number(summary.count ?? 0) : 0,
		title: summary.title,
		warnings: [],
	};
	try {
		const [questions, properties, files, webhooks] = await Promise.all([
			client.getQuestions(summary.id),
			client.getProperties(summary.id),
			withFiles ? client.listFiles(summary.id) : Promise.resolve([]),
			options.integrations
				? client.listWebhooks(summary.id)
				: Promise.resolve([]),
		]);
		const mapped = mapForm(summary, questions, properties);
		result.fields = mapped.fields.map((f) => ({ ...f, id: f.qid }));
		result.warnings = mapped.warnings.filter(
			(w) => !(options.integrations && w.startsWith("Email notifications"))
		);
		if (withFiles) {
			result.files = files.length;
			result.filesSize = files.reduce((n, f) => n + (Number(f.size) || 0), 0);
		}
		if (options.integrations) {
			result.integrations = mapIntegrations(
				properties,
				questions,
				webhooks
			).map(
				(i): PreviewIntegration => ({
					id: i.key,
					name: integrationName(i.integrationId, i.note),
					note: i.note ?? undefined,
					supported: true,
				})
			);
		}
	} catch (error) {
		result.error = (error as Error).message;
	}
	return result;
}

/** What an import of these forms will do, without changing anything. */
export async function previewJotformImport(
	db: Database,
	connection: Connection,
	selection: JotformSelection
): Promise<ImportPreview> {
	const client = clientFor(connection);
	const { options } = selection;
	const forms = selectedForms(connection, selection.formIds);
	const [imported, workspaceName] = await Promise.all([
		mappingsFor(db, connection).importedForms(selection.formIds),
		targetWorkspaceName(db, connection, selection.targetWorkspaceId),
	]);

	const previews = await mapConcurrent(forms, PREVIEW_CONCURRENCY, (summary) =>
		previewForm(client, summary, options, {
			action: imported.has(summary.id) ? "update" : "create",
			importedFormId: imported.get(summary.id) ?? null,
			targetWorkspace: workspaceName,
		})
	);

	const needed = forms.reduce((n, f) => {
		const perForm = 2 + (options.integrations ? 1 : 0);
		const pages = options.submissions
			? Math.max(1, Math.ceil(Number(f.count ?? 0) / SUBMISSION_PAGE))
			: 0;
		return n + perForm + pages;
	}, 0);
	const fileCount = previews.reduce((n, p) => n + (p.files ?? 0), 0);
	const submissionCount = previews.reduce((n, p) => n + p.submissions, 0);
	const notes = [
		"JotForm's design can't be copied, so imported forms use your workspace brand (Settings → Brand). You can change it per form afterwards.",
		"Form links change: JotForm links keep pointing to JotForm. Share the new StryveForms links once you're ready.",
	];
	if (client.limitLeft !== null && needed > client.limitLeft) {
		notes.unshift(
			`This import needs about ${needed} JotForm API calls but your account has ${client.limitLeft} left today. Import fewer forms now and the rest tomorrow — the limit resets at midnight US Eastern time.`
		);
	}
	return buildPreview("jotform", previews, {
		apiUsage: { needed, remaining: client.limitLeft },
		estimatedSeconds:
			needed * 0.8 + fileCount / FILE_CONCURRENCY + submissionCount * 0.01,
		notes,
	});
}

/* ---------------------------------- Import ------------------------------- */

interface RunContext {
	client: JotformClient;
	connection: Connection;
	db: Database;
	mappings: ImportMappings;
	options: JotformImportOptions;
	reporter: JobReporter;
	services: Services;
	userId: string;
}

async function resolveWorkspace(ctx: RunContext, target: string | "new") {
	if (target !== "new") {
		await requireWorkspace(ctx.db, target, ctx.userId, "edit", "import_data");
		return target;
	}
	const key = accountKey(ctx.connection);
	const existing = await ctx.mappings.get("workspace", key);
	if (existing) {
		const [row] = await ctx.db
			.select({ id: workspace.id })
			.from(workspace)
			.where(eq(workspace.id, existing));
		if (row) {
			return row.id;
		}
	}
	const id = newId();
	await ctx.db
		.insert(workspace)
		.values({ icon: "📋", id, name: NEW_WORKSPACE_NAME });
	await ctx.db
		.insert(workspaceMember)
		.values({ role: "admin", userId: ctx.userId, workspaceId: id });
	await ctx.mappings.set("workspace", key, id);
	ctx.reporter.add("info", `Created workspace “${NEW_WORKSPACE_NAME}”`);
	return id;
}

function isJotformHosted(url: string) {
	try {
		return new URL(url).hostname.includes("jotfor");
	} catch {
		return false;
	}
}

/** Copies images used in image and text blocks into StryveForms storage. */
async function copyImages(
	ctx: RunContext,
	fields: FormField[],
	workspaceId: string
) {
	const urls = new Set<string>();
	for (const field of fields) {
		if (typeof field.image_block === "string") {
			urls.add(field.image_block);
		}
		if (typeof field.content === "string") {
			for (const match of field.content.matchAll(IMG_SRC)) {
				if (match[1]) {
					urls.add(match[1]);
				}
			}
		}
	}
	const replacements = new Map<string, string>();
	for (const url of urls) {
		if (!isJotformHosted(url)) {
			continue;
		}
		try {
			replacements.set(
				url,
				await copyAsset(ctx.db, ctx.services, workspaceId, url, (u) =>
					ctx.client.download(u)
				)
			);
		} catch (error) {
			ctx.reporter.add(
				"warn",
				`Couldn't copy image ${url}: ${(error as Error).message}`
			);
		}
	}
	if (replacements.size === 0) {
		return fields;
	}
	const swap = (text: string) => {
		let out = text;
		for (const [from, to] of replacements) {
			out = out.split(from).join(to);
		}
		return out;
	};
	return fields.map((field) => ({
		...field,
		...(typeof field.content === "string"
			? { content: swap(field.content) }
			: {}),
		...(typeof field.image_block === "string"
			? { image_block: swap(field.image_block) }
			: {}),
	}));
}

async function importForm(
	ctx: RunContext,
	summary: JotformFormSummary,
	workspaceId: string
) {
	ctx.reporter.progress.currentForm = summary.title;
	const [questions, properties] = await Promise.all([
		ctx.client.getQuestions(summary.id),
		ctx.client.getProperties(summary.id),
	]);
	const mapped = mapForm(summary, questions, properties);
	const fields = await copyImages(
		ctx,
		mapped.settings.properties as FormField[],
		workspaceId
	);
	const settings = {
		...mapped.settings,
		properties: fields as typeof mapped.settings.properties,
	};
	for (const warning of mapped.warnings) {
		if (
			!(ctx.options.integrations && warning.startsWith("Email notifications"))
		) {
			ctx.reporter.add("warn", `“${summary.title}”: ${warning}`);
		}
	}

	const existingId = await ctx.mappings.get("form", summary.id);
	const [existing] = existingId
		? await ctx.db
				.select({ id: form.id })
				.from(form)
				.where(eq(form.id, existingId))
		: [];
	const columns = toFormColumns(settings);
	let formId: string;
	if (existing) {
		formId = existing.id;
		// Keep the brand choices made in StryveForms since the first import.
		const { brandOverrides: _o, useWorkspaceBrand: _u, ...refreshed } = columns;
		await ctx.db
			.update(form)
			.set({ ...refreshed, deletedAt: null, workspaceId })
			.where(eq(form.id, formId));
		ctx.reporter.add("info", `Updated “${summary.title}”`);
	} else {
		formId = newId();
		const slug = formSlug(settings.title);
		await ctx.db.insert(form).values({
			...columns,
			creatorId: ctx.userId,
			id: formId,
			slug,
			title: settings.title,
			workspaceId,
		});
		await ctx.mappings.set("form", summary.id, formId);
		ctx.reporter.add("info", `Imported “${summary.title}” → /forms/${slug}`);
	}
	return { formId, properties, questions };
}

async function upsertSubmission(
	ctx: RunContext,
	formId: string,
	source: JotformSubmission,
	questions: JotformQuestion[],
	signatureFields: Set<string>
) {
	const mapped = mapSubmission(source, questions);
	const key = `${source.form_id}:${source.id}`;
	const existingId = await ctx.mappings.get("submission", key);
	let submissionId: string;
	if (existingId) {
		submissionId = existingId;
		await ctx.db
			.update(formSubmission)
			.set({
				data: mapped.data,
				meta: mapped.meta,
				updatedAt: mapped.updatedAt,
			})
			.where(eq(formSubmission.id, existingId));
	} else {
		submissionId = newId();
		await ctx.db.insert(formSubmission).values({
			createdAt: mapped.createdAt,
			data: mapped.data,
			formId,
			id: submissionId,
			meta: mapped.meta,
			publicId: newPublicId(),
			status: "completed",
			updatedAt: mapped.updatedAt,
		});
		await ctx.mappings.set("submission", key, submissionId);
	}
	if (!ctx.options.files || mapped.files.length === 0) {
		return;
	}
	ctx.reporter.progress.files.total += mapped.files.length;
	await runPool(mapped.files, FILE_CONCURRENCY, async (file) => {
		try {
			await storeSubmissionFile(
				ctx.db,
				ctx.services,
				{
					formId,
					kind: signatureFields.has(file.fieldId) ? "signature" : "upload",
					originalName: file.originalName,
					storedName: file.storedName,
					submissionId,
				},
				() => ctx.client.download(file.url)
			);
		} catch (error) {
			ctx.reporter.add(
				"warn",
				`Couldn't copy file ${file.originalName}: ${(error as Error).message}`
			);
		}
		ctx.reporter.progress.files.done += 1;
	});
}

async function importSubmissions(
	ctx: RunContext,
	summary: JotformFormSummary,
	formId: string,
	questions: JotformQuestion[]
) {
	const signatureFields = new Set(
		questions
			.filter((q) => q.type === "control_signature")
			.map((q) => `jf_${q.qid}`)
	);
	ctx.reporter.progress.submissions.total += Number(summary.count ?? 0);
	for await (const page of ctx.client.submissionPages(summary.id)) {
		for (const submission of page) {
			ctx.reporter.checkCancelled();
			try {
				await upsertSubmission(
					ctx,
					formId,
					submission,
					questions,
					signatureFields
				);
			} catch (error) {
				ctx.reporter.add(
					"error",
					`Submission #${submission.id}: ${(error as Error).message}`
				);
			}
			ctx.reporter.progress.submissions.done += 1;
			await ctx.reporter.flush();
		}
	}
}

async function importIntegrations(
	ctx: RunContext,
	summary: JotformFormSummary,
	formId: string,
	questions: JotformQuestion[],
	properties: JotformProperties
) {
	let webhooks: string[] = [];
	try {
		webhooks = await ctx.client.listWebhooks(summary.id);
	} catch (error) {
		ctx.reporter.add(
			"warn",
			`“${summary.title}”: couldn't read webhooks (${(error as Error).message})`
		);
	}
	for (const integration of mapIntegrations(properties, questions, webhooks)) {
		const key = `${summary.id}:${integration.key}`;
		const values = {
			data: integration.data,
			integrationId: integration.integrationId,
			logic: null,
			status: integration.status,
		};
		const existingId = await ctx.mappings.get("integration", key);
		if (existingId) {
			await ctx.db
				.update(formIntegration)
				.set({ ...values, deletedAt: null })
				.where(eq(formIntegration.id, existingId));
		} else {
			const id = newId();
			await ctx.db.insert(formIntegration).values({ ...values, formId, id });
			await ctx.mappings.set("integration", key, id);
		}
		const { note } = integration;
		if (note !== null) {
			ctx.reporter.add("warn", `“${summary.title}”: ${note}`);
		}
		ctx.reporter.progress.integrations.done += 1;
	}
}

async function runImport(ctx: RunContext, selection: JotformSelection) {
	const { reporter } = ctx;
	const workspaceId = await resolveWorkspace(ctx, selection.targetWorkspaceId);
	for (const summary of selectedForms(ctx.connection, selection.formIds)) {
		reporter.checkCancelled();
		try {
			const { formId, properties, questions } = await importForm(
				ctx,
				summary,
				workspaceId
			);
			await reporter.flush(true);
			if (ctx.options.submissions) {
				await importSubmissions(ctx, summary, formId, questions);
			}
			if (ctx.options.integrations) {
				await importIntegrations(ctx, summary, formId, questions, properties);
			}
		} catch (error) {
			if (error instanceof ImportCancelled) {
				throw error;
			}
			reporter.add("error", `“${summary.title}”: ${(error as Error).message}`);
		}
		reporter.progress.forms.done += 1;
		await reporter.flush(true);
	}
}

export async function startJotformImport(
	db: Database,
	services: Services,
	connection: Connection,
	selection: JotformSelection
) {
	selectedForms(connection, selection.formIds);
	const reporter = new JobReporter(db, newId());
	reporter.progress.forms.total = selection.formIds.length;
	await createJob(db, {
		options: { ...selection, account: connection.user.username },
		reporter,
		source: "jotform",
		sourceUrl: connection.baseUrl,
		userId: connection.userId,
	});
	const ctx: RunContext = {
		client: clientFor(connection),
		connection,
		db,
		mappings: mappingsFor(db, connection),
		options: selection.options,
		reporter,
		services,
		userId: connection.userId,
	};
	runJob(db, services, {
		reporter,
		run: () => runImport(ctx, selection),
		source: "jotform",
		userId: connection.userId,
	});
	return { jobId: reporter.jobId };
}

/** Workspaces the user can import into (helps the UI label targets). */
export async function workspaceNames(db: Database, ids: string[]) {
	if (ids.length === 0) {
		return new Map<string, string>();
	}
	const rows = await db
		.select({ id: workspace.id, name: workspace.name })
		.from(workspace)
		.where(inArray(workspace.id, ids));
	return new Map(rows.map((r) => [r.id, r.name]));
}
