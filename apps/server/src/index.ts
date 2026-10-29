import { requireForm, requireWorkspace } from "@StryveForms/api/lib/access";
import {
	assetKey,
	canonicalFileName,
	submissionFileKey,
} from "@StryveForms/api/lib/files";
import { verifySignedPath } from "@StryveForms/api/lib/signing";
import { appRouter } from "@StryveForms/api/routers/index";
import { submissionFilters } from "@StryveForms/api/routers/submission";
import { ensureCliOAuthClient } from "@StryveForms/api/services/agent/cli-client";
import { buildMcpServerFactory } from "@StryveForms/api/services/agent/mcp-server";
import { resolveAgentSettings } from "@StryveForms/api/services/agent/settings";
import {
	isPersonalApiToken,
	resolveBearerSession,
	verifyApiToken,
} from "@StryveForms/api/services/agent/tokens";
import { decryptApiKey } from "@StryveForms/api/services/ai/crypto";
import {
	buildTextAdapter,
	isAiProvider,
} from "@StryveForms/api/services/ai/providers";
import { buildSystemPrompt } from "@StryveForms/api/services/ai/system-prompt";
import { buildAgentTools } from "@StryveForms/api/services/ai/tools";
import {
	decryptDestinationSecret,
	openDestination,
} from "@StryveForms/api/services/backup/destinations";
import {
	inspectInstanceBackup,
	newUploadKey,
	restoreInstanceArchive,
	uploadStorageKey,
	writeInstanceArchive,
} from "@StryveForms/api/services/backup/index";
import { runScheduledBackup } from "@StryveForms/api/services/backup/instance-jobs";
import {
	BackupJobReporter,
	createBackupJob,
	failBackupJob,
	finishBackupJob,
	getBackupJob,
	listBackupJobs,
} from "@StryveForms/api/services/backup/jobs";
import {
	getBackupSettings,
	startBackupScheduler,
} from "@StryveForms/api/services/backup/scheduler";
import { storageSource } from "@StryveForms/api/services/backup/streams";
import { exportSubmissionsCsv } from "@StryveForms/api/services/export";
import { failInterruptedJobs } from "@StryveForms/api/services/import/jobs";
import { getInstanceSettings } from "@StryveForms/api/services/instance";
import { startMaintenance } from "@StryveForms/api/services/maintenance";
import { renderTemplatePdfForSubmission } from "@StryveForms/api/services/pdf/generate";
import { pdfSourceKey } from "@StryveForms/api/services/pdf/keys";
import {
	type PdfPage,
	type PdfZone,
	renderFilenamePattern,
	sampleValueForField,
} from "@StryveForms/api/services/pdf/model";
import {
	inspectUploadedPdf,
	renderPdf,
} from "@StryveForms/api/services/pdf/render";
import {
	UploadError,
	uploadAsset,
	uploadSubmissionFile,
} from "@StryveForms/api/services/uploads";
import { mcpResource } from "@StryveForms/auth";
import { aiCredential, pdfTemplate } from "@StryveForms/db/schema/features";
import { form, formSubmission } from "@StryveForms/db/schema/forms";
import { SOCIAL_NETWORK_IDS } from "@StryveForms/emails/social";
import {
	getCachedSocialIconPng,
	SOCIAL_ICON_STYLES,
} from "@StryveForms/emails/social-icon";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import { requireMcpAuth } from "@better-auth/mcp";
import { trpcServer } from "@hono/trpc-server";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { chat as runChat, toServerSentEventsResponse } from "@tanstack/ai";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { zipSync } from "fflate";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { stream } from "hono/streaming";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { rateLimit } from "./rate-limit";
import { auth, db, services } from "./services";

const app = new Hono();
const IMAGE_TYPES = /^(image|video|audio)\//;
const SAFE_INLINE =
	/^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|video\/|audio\/)/;

app.use(logger());
app.use(
	"/*",
	cors({
		origin: (origin) => origin,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

const MINUTE_MS = 60_000;
// Session checks happen on every page, so the auth limit is generous.
app.use("/api/auth/*", rateLimit({ limit: 300, windowMs: MINUTE_MS }));
app.use("/api/uploads", rateLimit({ limit: 30, windowMs: MINUTE_MS }));
app.use(
	"/api/pdf-templates/upload",
	rateLimit({ limit: 20, windowMs: MINUTE_MS })
);
app.use("/api/pdf/respond/*", rateLimit({ limit: 30, windowMs: MINUTE_MS }));
// Bulk renders up to 200 PDFs per call, so this stays tight.
app.use(
	"/api/pdf/:templateId/bulk",
	rateLimit({ limit: 10, windowMs: MINUTE_MS })
);
// One chat turn can span several tool calls plus a model round trip, so this
// is generous per user; it still caps a runaway client loop.
app.use("/api/ai/chat", rateLimit({ limit: 60, windowMs: MINUTE_MS }));

// tRPC batches several calls into one path (`/trpc/a,b`), so match by name.
const submitLimit = rateLimit({ limit: 60, windowMs: MINUTE_MS });
const importLimit = rateLimit({ limit: 120, windowMs: MINUTE_MS });
app.use("/trpc/*", (c, next) => {
	if (c.req.path.includes("public.submit")) {
		return submitLimit(c, next);
	}
	if (c.req.path.includes("importer.")) {
		return importLimit(c, next);
	}
	return next();
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
// RFC 8414 / RFC 9728 well-known documents must live at the true origin
// root (not under /api/auth) so MCP/OAuth clients can discover them from
// just the server's base URL. better-auth's handler recognizes these
// `/.well-known/*` paths itself; this just makes sure they reach it.
app.on(["GET"], "/.well-known/*", (c) => auth.handler(c.req.raw));

const BEARER_TOKEN = /^Bearer\s+(.+)$/i;

/**
 * A read-scoped personal API token (Settings → API tokens) may call any
 * tRPC *query* over Bearer auth, but never a *mutation* — tRPC-over-HTTP
 * sends queries as GET and mutations as POST, so this is a cheap, central
 * place to enforce it without touching every router. An OAuth access token
 * never reaches this path — see the comment on `/api/mcp` below.
 */
app.use("/trpc/*", async (c, next) => {
	if (c.req.method !== "POST") {
		return next();
	}
	const bearer = c.req.header("authorization")?.match(BEARER_TOKEN)?.[1];
	if (!(bearer && isPersonalApiToken(bearer))) {
		return next();
	}
	const verified = await verifyApiToken(db, bearer);
	if (verified && verified.scope !== "write") {
		return c.json({ message: "This personal API token is read-only." }, 403);
	}
	return next();
});

const MB = 1024 * 1024;
app.use(
	"/trpc/*",
	bodyLimit({
		maxSize: 5 * MB,
		onError: (c) => c.json({ message: "Request is too large" }, 413),
	})
);

app.use(
	"/trpc/*",
	trpcServer({
		endpoint: "/trpc",
		router: appRouter,
		// tRPC infers the context type from the router; the adapter only wants a plain record.
		createContext: (_opts, context) =>
			createContext({ context }) as unknown as Promise<Record<string, unknown>>,
	})
);

/* -------------------------------------------------------------------------- */
/*                                 MCP server                                 */
/* -------------------------------------------------------------------------- */

const MCP_RESOURCE = mcpResource(ENV);
// Fresh McpServer per request (MCP 2026-07-28 is a stateless protocol); the
// factory itself re-reads the instance's "allow write tools" toggle every
// call. createMcpHandler also serves legacy (2025-era) Streamable HTTP
// traffic by default, which is what Claude Code/Cursor/Claude Desktop speak
// today — do NOT pass `legacy: "reject"` here.
const mcpServerHandler = createMcpHandler(
	buildMcpServerFactory({ db, services })
);
// OAuth access tokens (from the authorize/consent flow, or the CLI's device
// login) are verified against this server's own JWKS and must carry the
// `aud` claim for MCP_RESOURCE. requireMcpAuth also produces the RFC 9728
// `WWW-Authenticate` 401 challenge an unauthenticated MCP client needs to
// start discovery.
const oauthMcpHandler = requireMcpAuth(
	auth,
	(request, claims) => {
		const scope = typeof claims.scope === "string" ? claims.scope : "";
		const scopes = scope.split(" ").filter(Boolean);
		const authInfo = {
			clientId: typeof claims.azp === "string" ? claims.azp : "oauth-client",
			extra: {
				scope: scopes.includes("mcp:write") ? "write" : "read",
				userId: typeof claims.sub === "string" ? claims.sub : "",
			},
			resource: new URL(MCP_RESOURCE),
			scopes,
			token: "",
		};
		return mcpServerHandler.fetch(request, { authInfo });
	},
	{ resource: MCP_RESOURCE }
);

app.use("/api/mcp", rateLimit({ limit: 120, windowMs: MINUTE_MS }));

/**
 * Streamable HTTP MCP endpoint. Personal API tokens (Settings → API
 * tokens, `sfpat_…`) are verified directly here; anything else (including
 * no token at all) goes through `requireMcpAuth`, which handles the full
 * OAuth 2.1 bearer-token verification and the discovery challenge.
 */
app.all("/api/mcp", async (c) => {
	const instanceSettings = await getInstanceSettings(db);
	if (!resolveAgentSettings(instanceSettings.agentSettings).mcpEnabled) {
		return c.notFound();
	}
	const bearer = c.req.header("authorization")?.match(BEARER_TOKEN)?.[1];
	if (bearer && isPersonalApiToken(bearer)) {
		if (!resolveAgentSettings(instanceSettings.agentSettings).allowApiTokens) {
			return c.json({ message: "Personal API tokens are disabled." }, 403);
		}
		const verified = await verifyApiToken(db, bearer);
		if (!verified) {
			return c.json({ message: "Invalid or expired token." }, 401);
		}
		const authInfo = {
			clientId: "personal-api-token",
			extra: { scope: verified.scope, userId: verified.userId },
			resource: new URL(MCP_RESOURCE),
			scopes:
				verified.scope === "write" ? ["mcp:read", "mcp:write"] : ["mcp:read"],
			token: bearer,
		};
		return mcpServerHandler.fetch(c.req.raw, { authInfo });
	}
	return oauthMcpHandler(c.req.raw);
});

/**
 * Signed CSV export used by the `export_submissions_csv_link` MCP/CLI tool —
 * same signed-URL pattern as a respondent's uploaded-file link
 * (lib/files.ts), so the link works without any session or token.
 */
app.get("/api/forms/:formId/export-signed.csv", async (c) => {
	const formId = c.req.param("formId");
	const path = `/api/forms/${formId}/export-signed.csv`;
	if (
		!verifySignedPath(
			services.config.signingSecret,
			path,
			c.req.query("expires"),
			c.req.query("signature")
		)
	) {
		return c.json({ message: "This link has expired" }, 403);
	}
	const [formRow] = await db
		.select()
		.from(form)
		.where(and(eq(form.id, formId), isNull(form.deletedAt)));
	if (!formRow) {
		return c.notFound();
	}
	const statusParam = c.req.query("status");
	const status =
		statusParam === "completed" || statusParam === "partial"
			? statusParam
			: undefined;
	const filename = `${formRow.slug}-submissions.csv`;
	c.header("Content-Type", "text/csv; charset=utf-8");
	c.header("Content-Disposition", `attachment; filename="${filename}"`);
	return stream(c, async (out) => {
		await out.write("﻿");
		for await (const chunk of exportSubmissionsCsv(
			db,
			services.config,
			formRow,
			{
				from: c.req.query("from") || undefined,
				search: c.req.query("search") || undefined,
				status,
				to: c.req.query("to") || undefined,
			}
		)) {
			await out.write(chunk);
		}
	});
});

function uploadErrorResponse(error: unknown) {
	if (error instanceof UploadError) {
		return Response.json({ message: error.message }, { status: error.status });
	}
	console.error("[upload]", error);
	return Response.json({ message: "Upload failed" }, { status: 500 });
}

/** Respondent file uploads (public, before the form is submitted). */
app.post("/api/uploads", async (c) => {
	const body = await c.req.parseBody();
	const { file, slug, fieldId } = body;
	if (
		!(file instanceof File) ||
		typeof slug !== "string" ||
		typeof fieldId !== "string"
	) {
		return c.json({ message: "Missing file" }, 400);
	}
	try {
		return c.json(
			await uploadSubmissionFile(db, services, { fieldId, file, slug })
		);
	} catch (error) {
		return uploadErrorResponse(error);
	}
});

/** Images and media used inside forms (editors only). */
app.post("/api/assets", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in to upload images" }, 401);
	}
	const body = await c.req.parseBody();
	const { file, workspaceId } = body;
	if (!(file instanceof File)) {
		return c.json({ message: "Missing file" }, 400);
	}
	try {
		return c.json(
			await uploadAsset(db, services, {
				file,
				workspaceId: typeof workspaceId === "string" ? workspaceId : null,
			})
		);
	} catch (error) {
		return uploadErrorResponse(error);
	}
});

app.get("/api/assets/:name", async (c) => {
	const blob = await services.storage.get(assetKey(c.req.param("name")));
	if (!blob) {
		return c.notFound();
	}
	const type = blob.type || "application/octet-stream";
	return new Response(blob, {
		headers: {
			"Cache-Control": "public, max-age=31536000, immutable",
			"Content-Type": IMAGE_TYPES.test(type)
				? type
				: "application/octet-stream",
			"X-Content-Type-Options": "nosniff",
		},
	});
});

const HEX_COLOR_PARAM = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const PNG_SUFFIX = /\.png$/i;

/**
 * Social link icon badges for emails (can't rely on SVG there). Rendered
 * on-demand as PNG and cached in-process; the URL is fully deterministic
 * from its params, so it's also safe to cache for a year at the edge/CDN.
 */
app.get("/api/email-assets/social-icon/:network", (c) => {
	const raw = c.req.param("network").replace(PNG_SUFFIX, "");
	if (
		!SOCIAL_NETWORK_IDS.includes(raw as (typeof SOCIAL_NETWORK_IDS)[number])
	) {
		return c.notFound();
	}
	const styleParam = c.req.query("style");
	const style = (SOCIAL_ICON_STYLES as readonly string[]).includes(
		styleParam ?? ""
	)
		? (styleParam as (typeof SOCIAL_ICON_STYLES)[number])
		: "brand";
	const sizeParam = Number(c.req.query("size"));
	const size = Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : 28;
	const colorParam = c.req.query("color");
	const color =
		colorParam && HEX_COLOR_PARAM.test(colorParam) ? colorParam : undefined;

	const png = getCachedSocialIconPng(
		raw as (typeof SOCIAL_NETWORK_IDS)[number],
		style,
		size,
		color
	);
	return new Response(png, {
		headers: {
			"Cache-Control": "public, max-age=31536000, immutable",
			"Content-Type": "image/png",
		},
	});
});

/** Respondent files. Links are signed and expire. */
app.get("/api/files/:formId/:name", async (c) => {
	const formId = c.req.param("formId");
	const name = c.req.param("name");
	const path = `/api/files/${encodeURIComponent(formId)}/${encodeURIComponent(name)}`;
	if (
		!verifySignedPath(
			services.config.signingSecret,
			path,
			c.req.query("expires"),
			c.req.query("signature")
		)
	) {
		return c.json({ message: "This link has expired" }, 403);
	}
	const blob = await services.storage.get(submissionFileKey(formId, name));
	if (!blob) {
		return c.notFound();
	}
	const type = blob.type || "application/octet-stream";
	const inline = SAFE_INLINE.test(type);
	return new Response(blob, {
		headers: {
			"Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/"/g, "")}"`,
			"Content-Security-Policy":
				"default-src 'none'; img-src 'self'; media-src 'self'",
			"Content-Type": inline ? type : "application/octet-stream",
			"X-Content-Type-Options": "nosniff",
		},
	});
});

interface AiChatRequestBody {
	forwardedProps?: { formId?: string; workspaceId?: string };
	messages?: unknown[];
	threadId?: string;
}

/**
 * Streaming chat for the AI assistant. The client (`useChat` from
 * `@tanstack/ai-react`) posts the AG-UI "RunAgentInput" shape; we read
 * `threadId`/`messages` plus `forwardedProps.workspaceId`/`formId` (sent via
 * the connection adapter's `body` option) and stream back Server-Sent
 * Events. Tool calls the model makes (list_forms, create_form, …) run here,
 * scoped to the caller's own permissions in the workspace.
 */
app.post("/api/ai/chat", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	const body = (await c.req
		.json()
		.catch(() => null)) as AiChatRequestBody | null;
	const workspaceId = body?.forwardedProps?.workspaceId;
	const { threadId, messages } = body ?? {};
	if (!(workspaceId && threadId && Array.isArray(messages))) {
		return c.json(
			{ message: "Missing workspaceId, threadId, or messages" },
			400
		);
	}
	try {
		await requireWorkspace(
			db,
			workspaceId,
			session.user.id,
			"view",
			"use_ai_assistant"
		);
	} catch {
		return c.json({ message: "Workspace not found" }, 404);
	}

	const [credential] = await db
		.select()
		.from(aiCredential)
		.where(eq(aiCredential.workspaceId, workspaceId))
		.limit(1);
	if (!(credential && isAiProvider(credential.provider))) {
		return c.json(
			{
				message:
					"No AI provider is configured for this workspace yet. Add one in Settings → AI assistant.",
			},
			400
		);
	}
	let apiKey: string | null = null;
	if (credential.encryptedKey) {
		try {
			apiKey = decryptApiKey(
				services.config.signingSecret,
				credential.encryptedKey
			);
		} catch {
			return c.json(
				{
					message:
						"Couldn't decrypt the stored API key. Re-enter it in Settings → AI assistant.",
				},
				500
			);
		}
	}

	let adapter: ReturnType<typeof buildTextAdapter>;
	try {
		adapter = buildTextAdapter({
			apiKey,
			baseUrl: credential.baseUrl,
			model: credential.model,
			provider: credential.provider,
		});
	} catch (error) {
		return c.json(
			{
				message:
					error instanceof Error
						? error.message
						: "Couldn't set up the AI provider",
			},
			400
		);
	}

	// Pin the system prompt to the attached form, when the chat has one and
	// it's still in this workspace (it may have been deleted since).
	const formId = body?.forwardedProps?.formId ?? null;
	let formContext: {
		fieldsCount: number;
		formId: string;
		title: string;
	} | null = null;
	if (formId) {
		try {
			const { form: row } = await requireForm(db, formId, session.user.id);
			if (row.workspaceId === workspaceId) {
				formContext = {
					fieldsCount: (row.properties as unknown[]).length,
					formId: row.id,
					title: row.title,
				};
			}
		} catch {
			// Attached form no longer accessible; continue without that context.
		}
	}

	const tools = buildAgentTools({
		db,
		formId,
		services,
		userId: session.user.id,
		workspaceId,
	});

	const result = runChat({
		adapter,
		messages: messages as unknown as Parameters<typeof runChat>[0]["messages"],
		systemPrompts: [buildSystemPrompt({ formContext })],
		threadId,
		tools,
	});

	return toServerSentEventsResponse(result);
});

/** Permission errors become a 403 with the reason; anything else is a 404. */
function forbiddenOrNotFound(c: Context, error: unknown) {
	if (error instanceof TRPCError && error.code === "FORBIDDEN") {
		return c.json({ message: error.message }, 403);
	}
	return c.notFound();
}

/** CSV export of a form's submissions. */
app.get("/api/forms/:formId/export.csv", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	let formRow: Awaited<ReturnType<typeof requireForm>>["form"];
	try {
		({ form: formRow } = await requireForm(
			db,
			c.req.param("formId"),
			session.user.id,
			"view",
			"manage_submissions"
		));
	} catch (error) {
		return forbiddenOrNotFound(c, error);
	}
	const ids = c.req.query("ids")?.split(",").filter(Boolean);
	const columns = c.req.query("columns")?.split(",").filter(Boolean);
	const statusParam = c.req.query("status");
	const status =
		statusParam === "completed" || statusParam === "partial"
			? statusParam
			: undefined;
	// Mirrors the submissions table's active search, date range, and sort,
	// so "Export" always downloads exactly what's on screen.
	const search = c.req.query("search") || undefined;
	const from = c.req.query("from") || undefined;
	const to = c.req.query("to") || undefined;
	const sortBy = c.req.query("sortBy") || undefined;
	const sortDirParam = c.req.query("sortDir");
	const sortDir =
		sortDirParam === "asc" || sortDirParam === "desc"
			? sortDirParam
			: undefined;
	const filename = `${formRow.slug}-submissions.csv`;
	c.header("Content-Type", "text/csv; charset=utf-8");
	c.header("Content-Disposition", `attachment; filename="${filename}"`);
	return stream(c, async (out) => {
		await out.write("﻿");
		for await (const chunk of exportSubmissionsCsv(
			db,
			services.config,
			formRow,
			{ columns, from, ids, search, sortBy, sortDir, status, to }
		)) {
			await out.write(chunk);
		}
	});
});

const PDF_MAX_BYTES = 20 * MB;
const PDF_MAGIC = "%PDF";

/** Uploads a base PDF for a "from an upload" PDF template; returns its storage key and page sizes. */
app.post("/api/pdf-templates/upload", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	const body = await c.req.parseBody();
	const { file, formId } = body;
	if (!(file instanceof File) || typeof formId !== "string") {
		return c.json({ message: "Missing file" }, 400);
	}
	try {
		await requireForm(
			db,
			formId,
			session.user.id,
			"edit",
			"manage_pdf_templates"
		);
	} catch {
		return c.json({ message: "Form not found" }, 404);
	}
	if (file.size > PDF_MAX_BYTES) {
		return c.json({ message: "The PDF must be 20 MB or smaller" }, 413);
	}
	const bytes = new Uint8Array(await file.arrayBuffer());
	const header = new TextDecoder().decode(bytes.slice(0, 4));
	if (header !== PDF_MAGIC) {
		return c.json({ message: "Please upload a PDF file" }, 400);
	}
	let pages: { height: number; width: number }[];
	try {
		pages = await inspectUploadedPdf(bytes);
	} catch {
		return c.json({ message: "This PDF couldn't be read" }, 400);
	}
	const name = canonicalFileName(file.name || "template.pdf");
	const key = pdfSourceKey(formId, name);
	await services.storage.put(key, bytes, "application/pdf");
	return c.json({
		// `size`/`orientation` are cosmetic for an uploaded PDF (actual zone math
		// uses the PDF's own page dimensions); pick the closer label for display.
		pages: pages.map((p) => ({
			height: p.height,
			orientation: p.width > p.height ? "landscape" : "portrait",
			size: Math.max(p.width, p.height) > 820 ? "A4" : "Letter",
			width: p.width,
		})),
		sourceFileKey: key,
	});
});

/** Builds the field values a PDF template renders with: real answers, or sample data for a data-less preview. */
async function pdfRenderValues(
	formRow: Awaited<ReturnType<typeof requireForm>>["form"],
	submissionId: string | undefined
) {
	const fields = answerFields(
		formRow.properties as FormField[],
		formRow.removedProperties as FormField[]
	);
	if (!submissionId) {
		const values: Record<string, unknown> = {};
		for (const field of fields) {
			values[field.id] = sampleValueForField(field);
		}
		return {
			fields,
			meta: { createdAt: new Date(), publicId: "SAMPLE-0000" },
			values,
		};
	}
	const [submission] = await db
		.select()
		.from(formSubmission)
		.where(
			and(
				eq(formSubmission.formId, formRow.id),
				eq(formSubmission.id, submissionId)
			)
		);
	if (!submission) {
		return null;
	}
	return {
		fields,
		meta: { createdAt: submission.createdAt, publicId: submission.publicId },
		values: submission.data as Record<string, unknown>,
	};
}

function pdfResponse(bytes: Uint8Array, filename: string, inline: boolean) {
	return new Response(bytes, {
		headers: {
			"Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename.replace(/"/g, "")}"`,
			"Content-Type": "application/pdf",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

/** The raw uploaded base PDF (no zones drawn), for the editor's page background. */
app.get("/api/pdf/:templateId/source", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	const [template] = await db
		.select()
		.from(pdfTemplate)
		.where(eq(pdfTemplate.id, c.req.param("templateId")));
	if (!template?.sourceFileKey) {
		return c.notFound();
	}
	try {
		await requireForm(db, template.formId, session.user.id);
	} catch {
		return c.notFound();
	}
	const blob = await services.storage.get(template.sourceFileKey);
	if (!blob) {
		return c.notFound();
	}
	return new Response(blob, {
		headers: {
			"Cache-Control": "private, max-age=60",
			"Content-Type": "application/pdf",
			"X-Content-Type-Options": "nosniff",
		},
	});
});

/** Owner preview: renders with a chosen submission, or sample data when none is given. */
app.get("/api/pdf/:templateId/preview", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	const [template] = await db
		.select()
		.from(pdfTemplate)
		.where(eq(pdfTemplate.id, c.req.param("templateId")));
	if (!template) {
		return c.notFound();
	}
	let formRow: Awaited<ReturnType<typeof requireForm>>["form"];
	try {
		({ form: formRow } = await requireForm(
			db,
			template.formId,
			session.user.id
		));
	} catch {
		return c.notFound();
	}
	const rendered = await pdfRenderValues(formRow, c.req.query("submissionId"));
	if (!rendered) {
		return c.json({ message: "Submission not found" }, 404);
	}
	const bytes = await renderPdf({
		fields: rendered.fields,
		form: { id: formRow.id, title: formRow.title },
		pages: template.pages as PdfPage[],
		services,
		sourceFileKey: template.sourceFileKey,
		submissionMeta: rendered.meta,
		values: rendered.values,
		zones: template.zones as PdfZone[],
	});
	return pdfResponse(bytes, `${template.name}-preview.pdf`, true);
});

/** Owner download for one submission. */
app.get("/api/pdf/:templateId/download", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	const submissionId = c.req.query("submissionId");
	if (!submissionId) {
		return c.json({ message: "A submission id is required" }, 400);
	}
	const [template] = await db
		.select()
		.from(pdfTemplate)
		.where(eq(pdfTemplate.id, c.req.param("templateId")));
	if (!template) {
		return c.notFound();
	}
	let formRow: Awaited<ReturnType<typeof requireForm>>["form"];
	try {
		({ form: formRow } = await requireForm(
			db,
			template.formId,
			session.user.id
		));
	} catch {
		return c.notFound();
	}
	const rendered = await pdfRenderValues(formRow, submissionId);
	if (!rendered) {
		return c.json({ message: "Submission not found" }, 404);
	}
	const bytes = await renderPdf({
		fields: rendered.fields,
		form: { id: formRow.id, title: formRow.title },
		pages: template.pages as PdfPage[],
		services,
		sourceFileKey: template.sourceFileKey,
		submissionMeta: rendered.meta,
		values: rendered.values,
		zones: template.zones as PdfZone[],
	});
	const filename = renderFilenamePattern(template.filenamePattern, {
		date: rendered.meta.createdAt.toISOString().slice(0, 10),
		formTitle: formRow.title,
		submissionId: rendered.meta.publicId,
		templateName: template.name,
	});
	return pdfResponse(bytes, filename, false);
});

const BULK_ZIP_MAX = 200;
const UNSAFE_ZIP_CHARS = /[^a-zA-Z0-9\-_. ]+/g;
const PDF_EXT = /\.pdf$/i;

function sanitizeZipEntryName(name: string): string {
	return name.replace(UNSAFE_ZIP_CHARS, "_");
}

interface BulkPdfRequestBody {
	filters?: {
		from?: string;
		search?: string;
		status?: "all" | "completed" | "partial";
		to?: string;
	};
	ids?: string[];
}

/**
 * Bulk download: a ZIP with one PDF per submission — either the given
 * submission ids, or every submission matching the given filters (used for
 * "download all matching" from the submissions table). Capped so one request
 * can't render an unbounded number of PDFs.
 */
app.post("/api/pdf/:templateId/bulk", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	const [template] = await db
		.select()
		.from(pdfTemplate)
		.where(eq(pdfTemplate.id, c.req.param("templateId")));
	if (!template) {
		return c.notFound();
	}
	let formRow: Awaited<ReturnType<typeof requireForm>>["form"];
	try {
		({ form: formRow } = await requireForm(
			db,
			template.formId,
			session.user.id,
			"view",
			"manage_submissions"
		));
	} catch (error) {
		return forbiddenOrNotFound(c, error);
	}

	const body = (await c.req
		.json()
		.catch(() => null)) as BulkPdfRequestBody | null;
	const ids = Array.isArray(body?.ids)
		? body.ids.filter((id): id is string => typeof id === "string")
		: [];
	if (ids.length > BULK_ZIP_MAX) {
		return c.json(
			{ message: `Too many submissions selected (max ${BULK_ZIP_MAX}).` },
			400
		);
	}

	let submissions: (typeof formSubmission.$inferSelect)[];
	if (ids.length > 0) {
		submissions = await db
			.select()
			.from(formSubmission)
			.where(
				and(
					eq(formSubmission.formId, formRow.id),
					inArray(formSubmission.id, ids)
				)
			);
	} else {
		const where = submissionFilters({
			formId: formRow.id,
			from: body?.filters?.from,
			search: body?.filters?.search,
			status: body?.filters?.status ?? "all",
			to: body?.filters?.to,
		});
		submissions = await db
			.select()
			.from(formSubmission)
			.where(where)
			.orderBy(desc(formSubmission.createdAt))
			.limit(BULK_ZIP_MAX + 1);
	}

	if (submissions.length === 0) {
		return c.json({ message: "No matching submissions" }, 404);
	}
	if (submissions.length > BULK_ZIP_MAX) {
		return c.json(
			{
				message: `Too many submissions (max ${BULK_ZIP_MAX}). Narrow your filters or selection.`,
			},
			400
		);
	}

	const rendered = await Promise.all(
		submissions.map((submission) =>
			renderTemplatePdfForSubmission(services, template, formRow, submission)
		)
	);

	const used = new Map<string, number>();
	const files: Record<string, Uint8Array> = {};
	for (const { bytes, filename } of rendered) {
		const safe = sanitizeZipEntryName(filename) || "document.pdf";
		const seen = used.get(safe) ?? 0;
		used.set(safe, seen + 1);
		const entryName =
			seen === 0 ? safe : safe.replace(PDF_EXT, ` (${seen + 1}).pdf`);
		files[entryName] = bytes;
	}

	const zipBytes = zipSync(files);
	const zipName = `${sanitizeZipEntryName(template.name) || "pdfs"}-${submissions.length}.zip`;
	return new Response(zipBytes, {
		headers: {
			"Content-Disposition": `attachment; filename="${zipName}"`,
			"Content-Type": "application/zip",
			"X-Content-Type-Options": "nosniff",
		},
	});
});

/** Respondent download after submitting, when the form enables it. The submission's public id is the capability. */
app.get("/api/pdf/respond/:formId/:submissionPublicId", async (c) => {
	const formId = c.req.param("formId");
	const [formRow] = await db
		.select()
		.from(form)
		.where(and(eq(form.id, formId), isNull(form.deletedAt)));
	if (!formRow?.pdfDownloadEnabled) {
		return c.notFound();
	}
	// "First enabled" = oldest, matching the order templates are listed in on the PDF templates tab.
	const [template] = await db
		.select()
		.from(pdfTemplate)
		.where(and(eq(pdfTemplate.formId, formId), eq(pdfTemplate.enabled, true)))
		.orderBy(asc(pdfTemplate.createdAt))
		.limit(1);
	if (!template) {
		return c.notFound();
	}
	const [submission] = await db
		.select()
		.from(formSubmission)
		.where(
			and(
				eq(formSubmission.formId, formId),
				eq(formSubmission.publicId, c.req.param("submissionPublicId"))
			)
		);
	if (!submission) {
		return c.notFound();
	}
	const fields = answerFields(
		formRow.properties as FormField[],
		formRow.removedProperties as FormField[]
	);
	const bytes = await renderPdf({
		fields,
		form: { id: formRow.id, title: formRow.title },
		pages: template.pages as PdfPage[],
		services,
		sourceFileKey: template.sourceFileKey,
		submissionMeta: {
			createdAt: submission.createdAt,
			publicId: submission.publicId,
		},
		values: submission.data as Record<string, unknown>,
		zones: template.zones as PdfZone[],
	});
	const filename = renderFilenamePattern(template.filenamePattern, {
		date: submission.createdAt.toISOString().slice(0, 10),
		formTitle: formRow.title,
		submissionId: submission.publicId,
		templateName: template.name,
	});
	return pdfResponse(bytes, filename, false);
});

/**
 * Fresh-instance restore, offered by /setup before any admin account exists.
 * Both routes work ONLY while setup isn't completed — once it is, a restore
 * must go through the authenticated Admin → Backups → Restore flow instead.
 */
async function setupNotCompleted(): Promise<boolean> {
	const settings = await getInstanceSettings(db);
	return settings.setupCompletedAt === null;
}

const SETUP_RESTORE_MAX_BYTES = 20 * 1024 * 1024 * 1024; // 20 GiB
// Same id shape as services/backup/index.ts's (private) UPLOAD_KEY, so
// uploadKeyCreatedAt() (maintenance.ts) can age these out too; never build a
// storage key from a raw client-supplied string (path traversal).
const SETUP_RESTORE_KEY = /^[a-z0-9]{1,12}-[0-9a-f-]{36}$/;

function setupRestoreKey(uploadKey: string): string {
	if (!SETUP_RESTORE_KEY.test(uploadKey)) {
		throw new Error("Invalid upload");
	}
	return `tmp/setup-restore/${uploadKey}`;
}

// Pre-setup routes are public, so keep uploads modest and one restore at a time.
app.use(
	"/api/setup/restore-upload",
	rateLimit({ limit: 5, windowMs: MINUTE_MS })
);
let setupRestoreRunning = false;

app.post("/api/setup/restore-upload", async (c) => {
	if (!(await setupNotCompleted())) {
		return c.json({ message: "Setup has already been completed." }, 403);
	}
	const { body } = c.req.raw;
	if (!body) {
		return c.json({ message: "Missing file body" }, 400);
	}
	const contentLength = Number(c.req.header("content-length") ?? "0");
	if (contentLength > SETUP_RESTORE_MAX_BYTES) {
		return c.json({ message: "That file is too large" }, 413);
	}
	const uploadKey = newUploadKey();
	const key = setupRestoreKey(uploadKey);
	await services.storage.putStream(key, body);
	const sizeBytes = await services.storage.size(key);
	return c.json({ sizeBytes: sizeBytes ?? 0, uploadKey });
});

interface SetupRestoreBody {
	passphrase?: string;
	uploadKey?: string;
}

app.post("/api/setup/restore", async (c) => {
	if (!(await setupNotCompleted())) {
		return c.json({ message: "Setup has already been completed." }, 403);
	}
	const body = (await c.req
		.json()
		.catch(() => null)) as SetupRestoreBody | null;
	if (!(body?.uploadKey && body.passphrase)) {
		return c.json({ message: "Missing uploadKey or passphrase" }, 400);
	}
	if (setupRestoreRunning) {
		return c.json({ message: "A restore is already running." }, 409);
	}
	setupRestoreRunning = true;
	try {
		return await runSetupRestore(c, body.uploadKey, body.passphrase);
	} finally {
		setupRestoreRunning = false;
	}
});

async function runSetupRestore(
	c: Context,
	uploadKey: string,
	passphrase: string
) {
	const { id: jobId } = await createBackupJob(db, {
		kind: "instance_restore",
		trigger: "manual",
		userId: null,
	});
	const reporter = new BackupJobReporter(db, jobId);
	try {
		const source = await storageSource(
			services.storage,
			setupRestoreKey(uploadKey)
		);
		const { manifest } = await restoreInstanceArchive(db, services, {
			passphrase,
			reporter,
			source,
		});
		await reporter.flush(true);
		await finishBackupJob(db, jobId, {
			result: { manifest: manifest as unknown as Record<string, unknown> },
		});
		return c.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await reporter.flush(true).catch(() => undefined);
		await failBackupJob(db, jobId, message);
		return c.json({ message }, 400);
	}
}

/* -------------------------------------------------------------------------- */
/*              Workspace export/import + instance backup upload              */
/* -------------------------------------------------------------------------- */

const BACKUP_MAX_UPLOAD_BYTES = (ENV.BACKUP_MAX_UPLOAD_MB ?? 20_480) * MB;

app.use("/api/backups/upload", rateLimit({ limit: 10, windowMs: MINUTE_MS }));
app.use(
	"/api/backups/upload",
	bodyLimit({
		maxSize: BACKUP_MAX_UPLOAD_BYTES,
		onError: (c) => c.json({ message: "That file is too large" }, 413),
	})
);

/**
 * Authenticated upload for a workspace export/import `.stryve.zip`, or an
 * instance `.stryve-backup` (Admin → Backups → Restore). Streamed straight
 * into storage — never buffered, never routed through tRPC. Both
 * routers/backup.ts and routers/backup-admin.ts build the real storage key
 * themselves, as `tmp/backups/<uploadKey>`.
 */
app.post("/api/backups/upload", async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	const { body } = c.req.raw;
	if (!body) {
		return c.json({ message: "Missing file body" }, 400);
	}
	const uploadKey = newUploadKey();
	const key = uploadStorageKey(uploadKey);
	await services.storage.putStream(key, body);
	const sizeBytes = (await services.storage.size(key)) ?? 0;
	return c.json({ sizeBytes, uploadKey });
});

/**
 * Streams a finished export/backup file for download. Allowed for the
 * job's own owner; instance backup/restore jobs are also allowed for any
 * instance admin (a scheduled run has no personal owner at all). Accepts
 * either a cookie session or a personal API token (`Authorization: Bearer
 * sfpat_…`), so `stryveforms export`/`backup` (apps/cli) can download
 * without a browser session.
 */
app.get("/api/backups/jobs/:id/download", async (c) => {
	const bearer = await resolveBearerSession(
		db,
		c.req.header("authorization") ?? null
	);
	const session =
		bearer?.session ??
		(await auth.api.getSession({ headers: c.req.raw.headers }));
	if (!session) {
		return c.json({ message: "Sign in required" }, 401);
	}
	const job = await getBackupJob(db, c.req.param("id"));
	if (!job?.fileKey) {
		return c.notFound();
	}
	const isInstanceJob =
		job.kind === "instance_backup" || job.kind === "instance_restore";
	const isAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);
	if (!(job.userId === session.user.id || (isInstanceJob && isAdmin))) {
		return c.json({ message: "You can't download this file" }, 403);
	}
	// An instance backup's file lives wherever its destination put it
	// (services/backup/destinations.ts), not necessarily in this instance's
	// own `services.storage` — `job.fileKey` is relative to that destination,
	// so it's opened the same way the backup was written. Everything else
	// (workspace exports/imports) has no destination and lives directly in
	// `services.storage` at `job.fileKey`.
	const fileStream = job.destinationId
		? await (async () => {
				const settings = await getBackupSettings(db);
				const destination = settings.destinations.find(
					(d) => d.id === job.destinationId
				);
				if (!destination) {
					return null;
				}
				const opened = openDestination(destination, {
					instanceSecret: services.config.signingSecret,
					storage: services.storage,
				});
				try {
					return opened.source(job.fileKey as string);
				} catch {
					return null;
				}
			})()
		: await services.storage.getStream(job.fileKey);
	if (!fileStream) {
		return c.notFound();
	}
	const filename = (job.fileName ?? "backup").replace(/"/g, "");
	return new Response(fileStream, {
		headers: {
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Type": "application/octet-stream",
			"X-Content-Type-Options": "nosniff",
		},
	});
});

app.get("/", (c) => c.text("OK"));

if (ENV.NODE_ENV !== "test") {
	startMaintenance(db, services);
	failInterruptedJobs(db).catch((error: unknown) =>
		console.error("[import]", error)
	);
	// Idempotent: registers the public "StryveForms CLI" OAuth client once,
	// so `stryveforms login` can run the device flow without a client secret.
	ensureCliOAuthClient(db, MCP_RESOURCE).catch((error: unknown) =>
		console.error("[cli-oauth-client]", error)
	);
	// Checks once a minute whether a scheduled full-instance backup is due
	// (see services/backup/scheduler.ts); a Postgres advisory lock keeps two
	// replicas from running the same one twice.
	startBackupScheduler({
		getLastRunAt: async () => {
			const jobs = await listBackupJobs(db, { kind: "instance_backup" });
			const lastScheduled = jobs.find(
				(job) => job.trigger === "scheduled" && job.finishedAt
			);
			return lastScheduled?.finishedAt ?? null;
		},
		getSettings: () => getBackupSettings(db),
		pool: db.$client,
		runScheduledBackup: runScheduledBackup(
			db,
			services,
			{ inspectInstanceBackup, restoreInstanceArchive, writeInstanceArchive },
			(encrypted) =>
				decryptDestinationSecret(services.config.signingSecret, encrypted)
		),
	});
}

export default app;
