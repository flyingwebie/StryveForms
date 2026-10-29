// biome-ignore-all lint/performance/noAwaitInLoops: imports run step by step to respect OpnForm's rate limit
import type { Database } from "@StryveForms/db";
import { user } from "@StryveForms/db/schema/auth";
import {
	form,
	formIntegration,
	formStatistic,
	formSubmission,
	workspace,
	workspaceMember,
} from "@StryveForms/db/schema/forms";
import {
	blockForField,
	isInputType,
	isLayoutType,
} from "@StryveForms/forms/blocks";
import {
	OpnformClient,
	OpnformError,
} from "@StryveForms/opnform-import/client";
import {
	findHostedAssets,
	type MappedFile,
	mapForm,
	mapIntegration,
	mapSubmission,
	replaceUrls,
	unsupportedIntegrationNote,
} from "@StryveForms/opnform-import/map";
import type {
	OpnformFormSummary,
	OpnformProperty,
	OpnformSubmission,
	OpnformWorkspace,
} from "@StryveForms/opnform-import/types";
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
	storeSubmissionFile,
} from "./jobs";
import {
	buildPreview,
	type FormPreview,
	type ImportPreview,
	mapConcurrent,
	type PreviewField,
} from "./preview";

const CONNECTION_TTL_MS = 2 * 60 * 60 * 1000;
const FILE_CONCURRENCY = 4;
const IMPORTED_STATS_DATE = "1970-01-01";
const ROLES = new Set(["admin", "user", "readonly"]);
const SLUG_SUFFIX = /-[a-z0-9]{6}$/i;

/* ------------------------------- Connections ----------------------------- */

interface Connection {
	baseUrl: string;
	createdAt: number;
	formsByWorkspace: Map<number, OpnformFormSummary[]>;
	token: string;
	userId: string;
	workspaces: OpnformWorkspace[];
}

/** Tokens are only kept in memory, never written to the database. */
const connections = new Map<string, Connection>();

function cleanupConnections() {
	const now = Date.now();
	for (const [id, c] of connections) {
		if (now - c.createdAt > CONNECTION_TTL_MS) {
			connections.delete(id);
		}
	}
}

export function getConnection(
	connectionId: string,
	userId: string
): Connection | null {
	cleanupConnections();
	const connection = connections.get(connectionId);
	return connection && connection.userId === userId ? connection : null;
}

function clientFor(connection: Connection, services: Services) {
	return new OpnformClient({
		baseUrl: connection.baseUrl,
		requestsPerMinute: services.config.importRateLimitPerMinute,
		token: connection.token,
	});
}

export async function connectOpnform(
	services: Services,
	userId: string,
	baseUrl: string,
	token: string
) {
	const { client, workspaces } = await OpnformClient.connect({
		baseUrl,
		requestsPerMinute: services.config.importRateLimitPerMinute,
		token,
	});
	const connectionId = newPublicId();
	connections.set(connectionId, {
		baseUrl: client.baseUrl,
		createdAt: Date.now(),
		formsByWorkspace: new Map(),
		token,
		userId,
		workspaces,
	});
	return { baseUrl: client.baseUrl, connectionId, workspaces };
}

export async function listSourceForms(
	db: Database,
	services: Services,
	connection: Connection,
	workspaceId: number
) {
	const forms = await clientFor(connection, services).listForms(workspaceId);
	connection.formsByWorkspace.set(workspaceId, forms);
	const imported = await new ImportMappings(
		db,
		connection.baseUrl,
		connection.userId
	).importedForms(forms.map((f) => String(f.id)));
	return forms.map((f) => ({
		createdAt: f.created_at,
		id: f.id,
		importedFormId: imported.get(String(f.id)) ?? null,
		slug: f.slug,
		submissionsCount: f.submissions_count ?? 0,
		title: f.title,
		viewsCount: f.views_count ?? 0,
		visibility: f.visibility,
	}));
}

/* ----------------------------------- Jobs -------------------------------- */

export interface ImportSelection {
	formIds: number[];
	sourceWorkspaceId: number;
	targetWorkspaceId: string | "new";
}

export interface ImportOptions {
	files: boolean;
	integrations: boolean;
	keepSlugs: boolean;
	submissions: boolean;
}

interface RunContext {
	client: OpnformClient;
	connection: Connection;
	db: Database;
	mappings: ImportMappings;
	options: ImportOptions;
	reporter: JobReporter;
	services: Services;
	sourceHost: string;
	userId: string;
}

/* ------------------------------- Workspaces ------------------------------ */

async function resolveWorkspace(
	ctx: RunContext,
	selection: ImportSelection,
	source: OpnformWorkspace | undefined
) {
	if (selection.targetWorkspaceId !== "new") {
		await requireWorkspace(
			ctx.db,
			selection.targetWorkspaceId,
			ctx.userId,
			"edit",
			"import_data"
		);
		return selection.targetWorkspaceId;
	}
	const existing = await ctx.mappings.get(
		"workspace",
		String(selection.sourceWorkspaceId)
	);
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
	await ctx.db.insert(workspace).values({
		icon: source?.icon ?? "📝",
		id,
		legacyOpnformId: selection.sourceWorkspaceId,
		maxFileSize: Math.max(10, Math.round(Number(source?.max_file_size ?? 50))),
		name: source?.name ?? "Imported workspace",
	});
	await ctx.db
		.insert(workspaceMember)
		.values({ role: "admin", userId: ctx.userId, workspaceId: id });
	await ctx.mappings.set("workspace", String(selection.sourceWorkspaceId), id);
	ctx.reporter.add(
		"info",
		`Created workspace “${source?.name ?? "Imported workspace"}”`
	);
	return id;
}

async function importMembers(
	ctx: RunContext,
	sourceWorkspaceId: number,
	workspaceId: string
) {
	try {
		const members = await ctx.client.listWorkspaceUsers(sourceWorkspaceId);
		const emailsList = members.map((m) => m.email.toLowerCase());
		const existing = emailsList.length
			? await ctx.db
					.select({ email: user.email, id: user.id })
					.from(user)
					.where(inArray(user.email, emailsList))
			: [];
		const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u.id]));
		const missing: string[] = [];
		for (const member of members) {
			const userId = byEmail.get(member.email.toLowerCase());
			if (!userId) {
				missing.push(member.email);
				continue;
			}
			const role = ROLES.has(member.pivot?.role ?? "")
				? member.pivot?.role
				: "user";
			await ctx.db
				.insert(workspaceMember)
				.values({
					role: role as "admin" | "user" | "readonly",
					userId,
					workspaceId,
				})
				.onConflictDoNothing();
		}
		if (missing.length > 0) {
			ctx.reporter.add(
				"warn",
				`${missing.length} member(s) don't have a StryveForms account yet: ${missing.join(", ")}. Invite them from Settings → Members.`
			);
		}
	} catch (error) {
		ctx.reporter.add(
			"warn",
			`Couldn't read workspace members: ${(error as Error).message}`
		);
	}
}

/* ---------------------------------- Forms -------------------------------- */

async function copyAssets(
	ctx: RunContext,
	value: unknown,
	workspaceId: string
) {
	const isHosted = (url: string) => {
		try {
			const { hostname, pathname } = new URL(url);
			return hostname === ctx.sourceHost || pathname.includes("/forms/assets/");
		} catch {
			return false;
		}
	};
	const replacements = new Map<string, string>();
	for (const url of findHostedAssets(value, isHosted)) {
		try {
			const copied = await copyAsset(
				ctx.db,
				ctx.services,
				workspaceId,
				url,
				(u) => ctx.client.download(u)
			);
			replacements.set(url, copied);
		} catch (error) {
			ctx.reporter.add(
				"warn",
				`Couldn't copy image ${url}: ${(error as Error).message}`
			);
		}
	}
	return replacements;
}

async function slugFor(ctx: RunContext, legacySlug: string) {
	if (ctx.options.keepSlugs) {
		const [taken] = await ctx.db
			.select({ id: form.id })
			.from(form)
			.where(eq(form.slug, legacySlug));
		if (!taken) {
			return legacySlug;
		}
	}
	return formSlug(legacySlug.replace(SLUG_SUFFIX, ""));
}

async function importForm(
	ctx: RunContext,
	sourceFormId: number,
	workspaceId: string
) {
	const source = await ctx.client.getForm(sourceFormId);
	ctx.reporter.progress.currentForm = source.title;
	const mapped = mapForm(source);
	const replacements = await copyAssets(ctx, mapped.settings, workspaceId);
	const settings = replaceUrls(mapped.settings, replacements);
	const removed = replaceUrls(
		(source.removed_properties ?? []) as unknown[],
		replacements
	);
	const passwordHash = mapped.password
		? await Bun.password.hash(mapped.password)
		: null;
	const sequence = Number(
		(source as { auto_increment_sequence?: unknown }).auto_increment_sequence ??
			0
	);
	const columns = {
		...toFormColumns(settings),
		autoIncrementSequence: Number.isFinite(sequence) ? sequence : 0,
		legacyOpnformId: mapped.legacyId,
		passwordHash,
		removedProperties: removed,
	};

	const existingId = await ctx.mappings.get("form", String(sourceFormId));
	const [existing] = existingId
		? await ctx.db
				.select({ id: form.id })
				.from(form)
				.where(eq(form.id, existingId))
		: [];
	let formId: string;
	if (existing) {
		formId = existing.id;
		await ctx.db
			.update(form)
			.set({ ...columns, deletedAt: null, workspaceId })
			.where(eq(form.id, formId));
		ctx.reporter.add("info", `Updated “${source.title}”`);
	} else {
		formId = newId();
		const slug = await slugFor(ctx, mapped.legacySlug);
		await ctx.db.insert(form).values({
			...columns,
			creatorId: ctx.userId,
			id: formId,
			legacySlug: slug === mapped.legacySlug ? null : mapped.legacySlug,
			slug,
			title: settings.title,
			workspaceId,
		});
		await ctx.mappings.set("form", String(sourceFormId), formId);
		ctx.reporter.add("info", `Imported “${source.title}” → /forms/${slug}`);
	}
	await ctx.db
		.insert(formStatistic)
		.values({
			data: { views: mapped.viewsCount },
			date: IMPORTED_STATS_DATE,
			formId,
		})
		.onConflictDoUpdate({
			set: { data: { views: mapped.viewsCount } },
			target: [formStatistic.formId, formStatistic.date],
		});
	return {
		formId,
		properties: [
			...source.properties,
			...((source.removed_properties ?? []) as OpnformProperty[]),
		],
		source,
	};
}

/* ------------------------------- Submissions ----------------------------- */

function storeFile(
	ctx: RunContext,
	formId: string,
	submissionId: string,
	file: MappedFile,
	url: string
) {
	return storeSubmissionFile(
		ctx.db,
		ctx.services,
		{
			formId,
			kind:
				file.fieldId && file.storedName.startsWith("sign_")
					? "signature"
					: "upload",
			originalName: file.originalName,
			storedName: file.storedName,
			submissionId,
		},
		() => ctx.client.download(url)
	);
}

async function importFiles(
	ctx: RunContext,
	sourceFormId: number,
	source: OpnformSubmission,
	formId: string,
	submissionId: string,
	files: MappedFile[]
) {
	let refreshed: Map<string, string> | null = null;
	const queue = [...files];
	const worker = async () => {
		for (let file = queue.shift(); file; file = queue.shift()) {
			try {
				await storeFile(
					ctx,
					formId,
					submissionId,
					file,
					refreshed?.get(file.originalName) ?? file.url
				);
			} catch (error) {
				// Signed links expire after ~10 minutes: fetch fresh ones once and retry.
				if (
					error instanceof OpnformError &&
					error.status === 403 &&
					!refreshed
				) {
					const fresh = mapSubmission(
						await ctx.client.getSubmission(sourceFormId, source.id),
						[]
					);
					refreshed = new Map(
						Object.values(fresh.data)
							.flat()
							.filter((v): v is { file_name: string; file_url: string } =>
								Boolean(v && typeof v === "object" && "file_url" in v)
							)
							.map((v) => [v.file_name, v.file_url])
					);
					queue.push(file);
					continue;
				}
				ctx.reporter.add(
					"warn",
					`Couldn't copy file ${file.originalName}: ${(error as Error).message}`
				);
			}
			ctx.reporter.progress.files.done += 1;
		}
	};
	ctx.reporter.progress.files.total += files.length;
	await Promise.all(Array.from({ length: FILE_CONCURRENCY }, worker));
}

async function upsertSubmission(
	ctx: RunContext,
	formId: string,
	sourceFormId: number,
	source: OpnformSubmission,
	properties: OpnformProperty[]
) {
	const mapped = mapSubmission(source, properties);
	const mappingKey = `${sourceFormId}:${source.id}`;
	const existingId = await ctx.mappings.get("submission", mappingKey);
	let submissionId: string;
	if (existingId) {
		submissionId = existingId;
		await ctx.db
			.update(formSubmission)
			.set({
				completionTime: mapped.completionTime,
				data: mapped.data,
				meta: mapped.meta,
				status: mapped.status,
			})
			.where(eq(formSubmission.id, existingId));
	} else {
		submissionId = newId();
		const [taken] = mapped.publicId
			? await ctx.db
					.select({ id: formSubmission.id })
					.from(formSubmission)
					.where(eq(formSubmission.publicId, mapped.publicId))
			: [];
		await ctx.db.insert(formSubmission).values({
			completionTime: mapped.completionTime,
			createdAt: mapped.createdAt,
			data: mapped.data,
			formId,
			id: submissionId,
			legacyOpnformId: mapped.legacyId,
			meta: mapped.meta,
			// Keep OpnForm's id so old "edit your submission" links still work.
			publicId: mapped.publicId && !taken ? mapped.publicId : newPublicId(),
			status: mapped.status,
			updatedAt: mapped.createdAt,
		});
		await ctx.mappings.set("submission", mappingKey, submissionId);
	}
	if (ctx.options.files && mapped.files.length > 0) {
		await importFiles(
			ctx,
			sourceFormId,
			source,
			formId,
			submissionId,
			mapped.files
		);
	}
}

async function importSubmissions(
	ctx: RunContext,
	sourceFormId: number,
	formId: string,
	properties: OpnformProperty[]
) {
	let first = true;
	for await (const page of ctx.client.submissionPages(sourceFormId)) {
		if (first) {
			ctx.reporter.progress.submissions.total += page.meta.total;
			first = false;
		}
		for (const submission of page.data) {
			ctx.reporter.checkCancelled();
			try {
				await upsertSubmission(
					ctx,
					formId,
					sourceFormId,
					submission,
					properties
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

/* ------------------------------ Integrations ----------------------------- */

async function importIntegrations(
	ctx: RunContext,
	sourceFormId: number,
	formId: string,
	title: string
) {
	let integrations: Awaited<ReturnType<OpnformClient["listIntegrations"]>>;
	try {
		integrations = await ctx.client.listIntegrations(sourceFormId);
	} catch (error) {
		ctx.reporter.add(
			"warn",
			`“${title}”: couldn't read integrations (${(error as Error).message})`
		);
		return;
	}
	for (const integration of integrations) {
		const mapped = mapIntegration(integration);
		if (!mapped) {
			ctx.reporter.add(
				"warn",
				`“${title}”: ${unsupportedIntegrationNote(integration)}`
			);
			continue;
		}
		const key = `${sourceFormId}:${integration.id}`;
		const existingId = await ctx.mappings.get("integration", key);
		const values = {
			data: mapped.data,
			integrationId: mapped.integrationId,
			logic: mapped.logic,
			status: mapped.status,
		};
		if (existingId) {
			await ctx.db
				.update(formIntegration)
				.set({ ...values, deletedAt: null })
				.where(eq(formIntegration.id, existingId));
		} else {
			const id = newId();
			await ctx.db
				.insert(formIntegration)
				.values({ ...values, formId, id, legacyOpnformId: integration.id });
			await ctx.mappings.set("integration", key, id);
		}
		if (mapped.note) {
			ctx.reporter.add("warn", `“${title}”: ${mapped.note}`);
		}
		ctx.reporter.progress.integrations.done += 1;
	}
}

/* ---------------------------------- Runner ------------------------------- */

async function runImport(ctx: RunContext, selections: ImportSelection[]) {
	const { reporter } = ctx;
	for (const selection of selections) {
		const source = ctx.connection.workspaces.find(
			(w) => w.id === selection.sourceWorkspaceId
		);
		const workspaceId = await resolveWorkspace(ctx, selection, source);
		await importMembers(ctx, selection.sourceWorkspaceId, workspaceId);
		for (const sourceFormId of selection.formIds) {
			reporter.checkCancelled();
			try {
				const {
					formId,
					properties,
					source: sourceForm,
				} = await importForm(ctx, sourceFormId, workspaceId);
				await reporter.flush(true);
				if (ctx.options.submissions) {
					await importSubmissions(ctx, sourceFormId, formId, properties);
				}
				if (ctx.options.integrations) {
					await importIntegrations(ctx, sourceFormId, formId, sourceForm.title);
				}
			} catch (error) {
				if (error instanceof ImportCancelled) {
					throw error;
				}
				reporter.add(
					"error",
					`Form #${sourceFormId}: ${(error as Error).message}`
				);
			}
			reporter.progress.forms.done += 1;
			await reporter.flush(true);
		}
	}
}

export async function startImport(
	db: Database,
	services: Services,
	connection: Connection,
	selections: ImportSelection[],
	options: ImportOptions
) {
	const jobId = newId();
	const reporter = new JobReporter(db, jobId);
	reporter.progress.forms.total = selections.reduce(
		(n, s) => n + s.formIds.length,
		0
	);
	await createJob(db, {
		options: { options, selections },
		reporter,
		source: "opnform",
		sourceUrl: connection.baseUrl,
		userId: connection.userId,
	});
	const ctx: RunContext = {
		client: clientFor(connection, services),
		connection,
		db,
		mappings: new ImportMappings(db, connection.baseUrl, connection.userId),
		options,
		reporter,
		services,
		sourceHost: new URL(connection.baseUrl).hostname,
		userId: connection.userId,
	};
	runJob(db, services, {
		reporter,
		run: () => runImport(ctx, selections),
		source: "opnform",
		userId: connection.userId,
	});
	return { jobId };
}

/* --------------------------------- Preview ------------------------------- */

const PREVIEW_CONCURRENCY = 4;
const SUBMISSION_PAGE = 100;
const FILE_FIELD_TYPES = new Set(["files", "signature"]);

function previewFields(properties: OpnformProperty[]): PreviewField[] {
	return properties.map((p) => {
		const label = (typeof p.name === "string" && p.name) || p.type;
		const known = isInputType(p.type) || isLayoutType(p.type);
		if (p.type === "payment") {
			return {
				id: p.id,
				label,
				note: "Payments aren't collected yet — the block shows a notice",
				sourceType: p.type,
				status: "converted",
				targetType: p.type,
			};
		}
		return known
			? {
					id: p.id,
					label,
					sourceType: blockForField(p)?.title ?? p.type,
					status: "ok",
					targetType: p.type,
				}
			: {
					id: p.id,
					label,
					note: "This block type isn't available yet; it's kept but not shown",
					sourceType: p.type,
					status: "converted",
					targetType: null,
				};
	});
}

async function targetNames(
	db: Database,
	connection: Connection,
	selections: ImportSelection[]
) {
	const mappings = new ImportMappings(
		db,
		connection.baseUrl,
		connection.userId
	);
	const ids = new Map<number, string | null>();
	for (const s of selections) {
		ids.set(
			s.sourceWorkspaceId,
			s.targetWorkspaceId === "new"
				? await mappings.get("workspace", String(s.sourceWorkspaceId))
				: s.targetWorkspaceId
		);
	}
	const known = [...ids.values()].filter((id): id is string => Boolean(id));
	const rows = known.length
		? await db
				.select({ id: workspace.id, name: workspace.name })
				.from(workspace)
				.where(inArray(workspace.id, known))
		: [];
	const names = new Map(rows.map((r) => [r.id, r.name]));
	return (sourceWorkspaceId: number) => {
		const id = ids.get(sourceWorkspaceId);
		if (id && names.has(id)) {
			return names.get(id) as string;
		}
		const source = connection.workspaces.find(
			(w) => w.id === sourceWorkspaceId
		);
		return `New workspace “${source?.name ?? "Imported workspace"}”`;
	};
}

async function previewOneForm(
	client: OpnformClient,
	formId: number,
	options: ImportOptions,
	base: FormPreview
): Promise<FormPreview> {
	const result = { ...base };
	try {
		const [source, integrations] = await Promise.all([
			client.getForm(formId),
			options.integrations
				? client.listIntegrations(formId)
				: Promise.resolve([]),
		]);
		result.fields = previewFields(source.properties ?? []);
		const fileFields = (source.properties ?? []).filter(
			(p) => FILE_FIELD_TYPES.has(p.type) || (p.type === "url" && p.file_upload)
		).length;
		if (options.submissions && options.files && fileFields > 0) {
			result.warnings.push(
				`Files from ${fileFields} upload field${fileFields === 1 ? "" : "s"} are copied with the submissions.`
			);
		}
		const raw = source as Record<string, unknown>;
		if (typeof raw.password === "string" && raw.password) {
			result.warnings.push("Password protection is kept.");
		}
		if (typeof raw.custom_domain === "string" && raw.custom_domain) {
			result.warnings.push(
				`The custom domain ${raw.custom_domain} isn't moved — add it again in StryveForms.`
			);
		}
		result.integrations = integrations.map((integration) => {
			const mapped = mapIntegration(integration);
			return mapped
				? {
						id: String(integration.id),
						name: integration.integration_id,
						note: mapped.note ?? undefined,
						supported: true,
					}
				: {
						id: String(integration.id),
						name: integration.integration_id,
						note: unsupportedIntegrationNote(integration),
						supported: false,
					};
		});
	} catch (error) {
		result.error = (error as Error).message;
	}
	return result;
}

/** What an import of these forms will do, without changing anything. */
export async function previewOpnformImport(
	db: Database,
	services: Services,
	connection: Connection,
	selections: ImportSelection[],
	options: ImportOptions
): Promise<ImportPreview> {
	const client = clientFor(connection, services);
	const nameFor = await targetNames(db, connection, selections);
	const items = selections.flatMap((s) =>
		s.formIds.map((formId) => ({
			formId,
			sourceWorkspaceId: s.sourceWorkspaceId,
		}))
	);
	const imported = await new ImportMappings(
		db,
		connection.baseUrl,
		connection.userId
	).importedForms(items.map((i) => String(i.formId)));
	const summaries = new Map(
		[...connection.formsByWorkspace.values()].flat().map((f) => [f.id, f])
	);
	const forms = await mapConcurrent(items, PREVIEW_CONCURRENCY, (item) => {
		const summary = summaries.get(item.formId);
		return previewOneForm(client, item.formId, options, {
			action: imported.has(String(item.formId)) ? "update" : "create",
			fields: [],
			files: null,
			filesSize: null,
			importedFormId: imported.get(String(item.formId)) ?? null,
			integrations: [],
			sourceId: String(item.formId),
			submissions: options.submissions ? (summary?.submissions_count ?? 0) : 0,
			targetWorkspace: nameFor(item.sourceWorkspaceId),
			title: summary?.title ?? `Form #${item.formId}`,
			warnings: [],
		});
	});

	const notes: string[] = [];
	if (options.keepSlugs) {
		notes.push(
			"Form links keep their OpnForm slugs when they're free, so /forms/<slug> links keep working once your domain points here."
		);
	}
	notes.push(
		"Workspace members who already have a StryveForms account are added automatically; others can be invited after the import."
	);
	const requests =
		forms.length * 2 +
		forms.reduce(
			(n, f) => n + Math.max(1, Math.ceil(f.submissions / SUBMISSION_PAGE)),
			0
		) +
		selections.length;
	const perMinute = Math.max(1, services.config.importRateLimitPerMinute);
	const submissionCount = forms.reduce((n, f) => n + f.submissions, 0);
	return buildPreview("opnform", forms, {
		estimatedSeconds: (requests / perMinute) * 60 + submissionCount * 0.01,
		notes,
	});
}
