/**
 * Create/update/delete for a form's integrations — the logic behind both
 * routers/integration.ts's `create`/`update`/`delete` procedures (the web
 * UI) and the agent tools (services/agent/tools.ts, via the MCP server and
 * the CLI). One place validates URLs via the SSRF guard and sanitizes
 * rich-text email bodies, so every caller gets the same safety checks.
 */
import type { Database } from "@StryveForms/db";
import { formIntegration } from "@StryveForms/db/schema/forms";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireForm } from "../../lib/access";
import { newId } from "../../lib/ids";
import { sanitizeRichText } from "../sanitize";
import { INTEGRATION_CATALOG } from "./handlers";
import { assertPublicUrl, UnsafeUrlError } from "./ssrf";

/** Data keys that hold a URL the server will POST/fetch to — always run through the SSRF guard. */
const URL_KEYS = ["webhook_url", "hook_url"] as const;

export const INTEGRATION_IDS = INTEGRATION_CATALOG.map((i) => i.id) as [
	string,
	...string[],
];

async function checkUrl(url: unknown) {
	if (typeof url !== "string" || url.length === 0) {
		return;
	}
	try {
		await assertPublicUrl(url);
	} catch (error) {
		const message =
			error instanceof UnsafeUrlError ? error.message : "Invalid URL";
		// biome-ignore lint/style/useErrorCause: TRPCError takes the cause in its options object
		throw new TRPCError({ cause: error, code: "BAD_REQUEST", message });
	}
}

/** Validates any webhook-shaped URL and sanitizes rich-text email content before it's stored. */
export async function cleanIntegrationData(
	data: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const clean = { ...data };
	await Promise.all(URL_KEYS.map((key) => checkUrl(clean[key])));
	if (typeof clean.email_content === "string") {
		clean.email_content = sanitizeRichText(clean.email_content);
	}
	return clean;
}

export interface CreateIntegrationInput {
	data?: Record<string, unknown>;
	integrationId: string;
	logic?: Record<string, unknown> | null;
	settings?: Record<string, unknown>;
	status?: "active" | "inactive";
}

export async function createFormIntegration(
	db: Database,
	formId: string,
	userId: string,
	input: CreateIntegrationInput
): Promise<{ id: string }> {
	await requireForm(db, formId, userId, "edit", "manage_integrations");
	const id = newId();
	await db.insert(formIntegration).values({
		data: await cleanIntegrationData(input.data ?? {}),
		formId,
		id,
		integrationId: input.integrationId,
		logic: input.logic ?? null,
		settings: input.settings ?? {},
		status: input.status ?? "active",
	});
	return { id };
}

export interface UpdateIntegrationInput {
	data?: Record<string, unknown>;
	integrationId?: string;
	logic?: Record<string, unknown> | null;
	settings?: Record<string, unknown>;
	status?: "active" | "inactive";
}

export async function updateFormIntegration(
	db: Database,
	formId: string,
	id: string,
	userId: string,
	patch: UpdateIntegrationInput
): Promise<{ ok: true }> {
	await requireForm(db, formId, userId, "edit", "manage_integrations");
	const { data, ...rest } = patch;
	await db
		.update(formIntegration)
		.set({
			...rest,
			...(data ? { data: await cleanIntegrationData(data) } : {}),
		})
		.where(and(eq(formIntegration.id, id), eq(formIntegration.formId, formId)));
	return { ok: true };
}

export async function deleteFormIntegration(
	db: Database,
	formId: string,
	id: string,
	userId: string
): Promise<{ ok: true }> {
	await requireForm(db, formId, userId, "edit", "manage_integrations");
	await db
		.update(formIntegration)
		.set({ deletedAt: new Date() })
		.where(and(eq(formIntegration.id, id), eq(formIntegration.formId, formId)));
	return { ok: true };
}

/** Loads one non-deleted integration row, scoped to the form, or throws NOT_FOUND. */
export async function getFormIntegrationRow(
	db: Database,
	formId: string,
	id: string,
	userId: string
) {
	await requireForm(db, formId, userId, "view");
	const [row] = await db
		.select()
		.from(formIntegration)
		.where(
			and(
				eq(formIntegration.id, id),
				eq(formIntegration.formId, formId),
				isNull(formIntegration.deletedAt)
			)
		)
		.limit(1);
	if (!row) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Integration not found",
		});
	}
	return row;
}
