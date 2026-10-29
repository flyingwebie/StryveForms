/**
 * The overview shown before an import starts: what will be created or updated,
 * how much data will be copied and what needs attention.
 */

export type PreviewFieldStatus = "ok" | "converted" | "skipped";

export interface PreviewField {
	id: string;
	label: string;
	note?: string;
	sourceType: string;
	status: PreviewFieldStatus;
	targetType: string | null;
}

export interface PreviewIntegration {
	id: string;
	/** e.g. "Email notification", "Webhook", "Google Sheets". */
	name: string;
	note?: string;
	supported: boolean;
}

export interface FormPreview {
	/** "create": new form. "update": imported before, it's refreshed. */
	action: "create" | "update";
	/** Set when the form couldn't be analysed (it can still be imported). */
	error?: string;
	fields: PreviewField[];
	/** Number of uploaded files, when the source can tell. */
	files: number | null;
	/** Total size of uploaded files in bytes, when known. */
	filesSize: number | null;
	importedFormId: string | null;
	integrations: PreviewIntegration[];
	sourceId: string;
	submissions: number;
	/** Name of the StryveForms workspace it lands in. */
	targetWorkspace: string;
	title: string;
	warnings: string[];
}

export interface ImportPreview {
	/** JotForm's daily API limit. Null for sources without one. */
	apiUsage: { needed: number; remaining: number | null } | null;
	/** Rough duration in seconds. */
	estimatedSeconds: number;
	forms: FormPreview[];
	/** Notes about the whole import (members, links, design…). */
	notes: string[];
	source: "opnform" | "jotform";
	totals: {
		converted: number;
		create: number;
		fields: number;
		files: number | null;
		filesSize: number | null;
		forms: number;
		integrations: number;
		skipped: number;
		submissions: number;
		unsupportedIntegrations: number;
		update: number;
		warnings: number;
	};
}

function sumKnown(values: (number | null)[]): number | null {
	const known = values.filter((v): v is number => v !== null);
	return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

export function buildPreview(
	source: ImportPreview["source"],
	forms: FormPreview[],
	extra: {
		apiUsage?: ImportPreview["apiUsage"];
		estimatedSeconds: number;
		notes?: string[];
	}
): ImportPreview {
	const fields = forms.flatMap((f) => f.fields);
	const integrations = forms.flatMap((f) => f.integrations);
	return {
		apiUsage: extra.apiUsage ?? null,
		estimatedSeconds: Math.max(5, Math.round(extra.estimatedSeconds)),
		forms,
		notes: extra.notes ?? [],
		source,
		totals: {
			converted: fields.filter((f) => f.status === "converted").length,
			create: forms.filter((f) => f.action === "create").length,
			fields: fields.length,
			files: sumKnown(forms.map((f) => f.files)),
			filesSize: sumKnown(forms.map((f) => f.filesSize)),
			forms: forms.length,
			integrations: integrations.filter((i) => i.supported).length,
			skipped: fields.filter((f) => f.status === "skipped").length,
			submissions: forms.reduce((n, f) => n + f.submissions, 0),
			unsupportedIntegrations: integrations.filter((i) => !i.supported).length,
			update: forms.filter((f) => f.action === "update").length,
			warnings: forms.reduce(
				(n, f) => n + f.warnings.length + (f.error ? 1 : 0),
				0
			),
		},
	};
}

/** Runs `task` for each item with a few in flight at once, keeping order. */
export async function mapConcurrent<T, R>(
	items: T[],
	concurrency: number,
	task: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const index = next;
			next += 1;
			// biome-ignore lint/performance/noAwaitInLoops: each worker takes one item at a time
			results[index] = await task(items[index] as T);
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, worker)
	);
	return results;
}

/* ------------------------------ Analysis tasks --------------------------- */

/*
 * Analysing many forms takes minutes (JotForm allows only a few API calls at a
 * time), longer than a proxy keeps a request open. So the analysis runs in the
 * background and the browser polls for progress and the result.
 */

const TASK_TTL_MS = 30 * 60 * 1000;
const MAX_LOG_ENTRIES = 500;

export interface PreviewLogEntry {
	at: string;
	level: "info" | "warn" | "error";
	message: string;
}

export class PreviewCancelled extends Error {
	constructor() {
		super("Analysis cancelled");
	}
}

/** Collects progress and log lines while forms are analysed. */
export class PreviewReporter {
	private readonly controller = new AbortController();
	done = 0;
	readonly log: PreviewLogEntry[] = [];
	total: number;

	constructor(total: number) {
		this.total = total;
	}

	add(level: PreviewLogEntry["level"], message: string) {
		this.log.push({ at: new Date().toISOString(), level, message });
		if (this.log.length > MAX_LOG_ENTRIES) {
			this.log.splice(0, this.log.length - MAX_LOG_ENTRIES);
		}
	}

	formDone(form: FormPreview) {
		this.done += 1;
		if (form.error) {
			this.add("warn", `Couldn't analyse “${form.title}”: ${form.error}`);
			return;
		}
		const parts = [`${form.fields.length} fields`];
		if (form.submissions > 0) {
			parts.push(`${form.submissions.toLocaleString("en")} submissions`);
		}
		if (form.files) {
			parts.push(`${form.files.toLocaleString("en")} files`);
		}
		this.add("info", `Analysed “${form.title}” (${parts.join(", ")})`);
	}

	cancel() {
		this.controller.abort();
	}

	throwIfCancelled() {
		if (this.controller.signal.aborted) {
			throw new PreviewCancelled();
		}
	}
}

interface PreviewTask {
	createdAt: number;
	error: string | null;
	reporter: PreviewReporter;
	result: ImportPreview | null;
	status: "running" | "done" | "failed" | "cancelled";
	userId: string;
}

const tasks = new Map<string, PreviewTask>();

function cleanupTasks() {
	const now = Date.now();
	for (const [id, task] of tasks) {
		if (now - task.createdAt > TASK_TTL_MS) {
			tasks.delete(id);
		}
	}
}

/** Starts an analysis in the background and returns its id right away. */
export function startPreviewTask(
	userId: string,
	total: number,
	run: (reporter: PreviewReporter) => Promise<ImportPreview>
): string {
	cleanupTasks();
	const id = crypto.randomUUID();
	const task: PreviewTask = {
		createdAt: Date.now(),
		error: null,
		reporter: new PreviewReporter(total),
		result: null,
		status: "running",
		userId,
	};
	tasks.set(id, task);
	run(task.reporter)
		.then((result) => {
			if (task.status !== "running") {
				return;
			}
			task.result = result;
			task.status = "done";
			task.reporter.add("info", "Analysis complete");
		})
		.catch((error: unknown) => {
			if (task.status !== "running") {
				return;
			}
			if (error instanceof PreviewCancelled) {
				task.status = "cancelled";
				return;
			}
			task.status = "failed";
			task.error = (error as Error).message || "The analysis failed.";
			task.reporter.add("error", task.error);
		});
	return id;
}

export function getPreviewTask(id: string, userId: string) {
	const task = tasks.get(id);
	if (!task || task.userId !== userId) {
		return null;
	}
	return {
		done: task.reporter.done,
		error: task.error,
		log: task.reporter.log,
		result: task.result,
		status: task.status,
		total: task.reporter.total,
	};
}

export function cancelPreviewTask(id: string, userId: string) {
	const task = tasks.get(id);
	if (!task || task.userId !== userId) {
		return false;
	}
	task.reporter.cancel();
	if (task.status === "running") {
		task.status = "cancelled";
	}
	return true;
}
