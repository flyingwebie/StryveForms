import type {
	OpnformForm,
	OpnformFormSummary,
	OpnformIntegration,
	OpnformSubmission,
	OpnformWorkspace,
	OpnformWorkspaceUser,
	Paginated,
} from "./types";

const CLOUD_API = "https://api.opnform.com";
const CLOUD_HOSTS = new Set([
	"opnform.com",
	"www.opnform.com",
	"app.opnform.com",
]);
const MINUTE_MS = 60_000;
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 100;
const TRAILING_SLASHES = /\/+$/;

export class OpnformError extends Error {
	readonly status: number;

	constructor(message: string, status: number, options?: { cause?: unknown }) {
		super(message, options);
		this.status = status;
	}
}

/**
 * Keeps requests under OpnForm's rate limit (100 per minute by default).
 * A small burst is allowed so short tasks (like the import overview) are
 * quick; after that requests are spaced evenly.
 */
class RateLimiter {
	private readonly interval: number;
	private readonly capacity: number;
	private tokens: number;
	private updatedAt = Date.now();

	constructor(perMinute: number) {
		const rate = Math.max(1, perMinute);
		this.interval = MINUTE_MS / rate;
		this.capacity = Math.max(1, Math.floor(rate / 3));
		this.tokens = this.capacity;
	}

	async wait() {
		const now = Date.now();
		this.tokens = Math.min(
			this.capacity,
			this.tokens + (now - this.updatedAt) / this.interval
		);
		this.updatedAt = now;
		this.tokens -= 1;
		if (this.tokens < 0) {
			await Bun.sleep(-this.tokens * this.interval);
		}
	}
}

/** `https://opnform.com` → cloud API; strips trailing slashes. */
export function normalizeBaseUrl(input: string): string {
	const url = new URL(input.trim());
	if (CLOUD_HOSTS.has(url.hostname)) {
		return CLOUD_API;
	}
	return `${url.origin}${url.pathname}`.replace(TRAILING_SLASHES, "");
}

export interface OpnformClientOptions {
	baseUrl: string;
	fetch?: typeof fetch;
	requestsPerMinute?: number;
	token: string;
}

export class OpnformClient {
	readonly baseUrl: string;
	private readonly token: string;
	private readonly limiter: RateLimiter;
	private readonly fetchFn: typeof fetch;

	constructor({
		baseUrl,
		fetch: fetchFn,
		requestsPerMinute = 60,
		token,
	}: OpnformClientOptions) {
		this.baseUrl = baseUrl.replace(TRAILING_SLASHES, "");
		this.token = token;
		this.limiter = new RateLimiter(requestsPerMinute);
		this.fetchFn = fetchFn ?? fetch;
	}

	/**
	 * Tries the URL as given and with `/api` appended (self-hosted installs
	 * serve the API under /api) and returns a client for whichever works.
	 */
	static async connect(options: OpnformClientOptions): Promise<{
		client: OpnformClient;
		workspaces: OpnformWorkspace[];
	}> {
		const base = normalizeBaseUrl(options.baseUrl);
		const candidates =
			base.endsWith("/api") || base === CLOUD_API
				? [base]
				: [base, `${base}/api`];
		let lastError: unknown = null;
		for (const candidate of candidates) {
			const client = new OpnformClient({ ...options, baseUrl: candidate });
			try {
				// biome-ignore lint/performance/noAwaitInLoops: candidates are tried one after the other
				const workspaces = await client.listWorkspaces();
				return { client, workspaces };
			} catch (error) {
				lastError = error;
				if (
					error instanceof OpnformError &&
					(error.status === 401 || error.status === 403)
				) {
					throw error;
				}
			}
		}
		throw lastError instanceof Error
			? lastError
			: new OpnformError("Could not reach OpnForm", 0);
	}

	private async request<T>(path: string, attempt = 0): Promise<T> {
		await this.limiter.wait();
		let response: Response;
		try {
			response = await this.fetchFn(`${this.baseUrl}${path}`, {
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${this.token}`,
				},
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			if (attempt < MAX_RETRIES) {
				await Bun.sleep(2 ** attempt * 1000);
				return this.request<T>(path, attempt + 1);
			}
			// biome-ignore lint/style/useErrorCause: the cause is passed in the options argument
			throw new OpnformError(`Network error: ${(error as Error).message}`, 0, {
				cause: error,
			});
		}
		if (response.status === 429 && attempt < MAX_RETRIES) {
			const retryAfter = Number(response.headers.get("retry-after") ?? "10");
			await Bun.sleep((Number.isFinite(retryAfter) ? retryAfter : 10) * 1000);
			return this.request<T>(path, attempt + 1);
		}
		if (response.status >= 500 && attempt < MAX_RETRIES) {
			await Bun.sleep(2 ** attempt * 1000);
			return this.request<T>(path, attempt + 1);
		}
		const isJson = response.headers.get("content-type")?.includes("json");
		if (!(response.ok && isJson)) {
			throw new OpnformError(
				describeStatus(response.status, path),
				response.status
			);
		}
		return (await response.json()) as T;
	}

	listWorkspaces() {
		return this.request<OpnformWorkspace[]>("/open/workspaces");
	}

	listWorkspaceUsers(workspaceId: number) {
		return this.request<OpnformWorkspaceUser[]>(
			`/open/workspaces/${workspaceId}/users`
		);
	}

	async listForms(workspaceId: number): Promise<OpnformFormSummary[]> {
		const forms: OpnformFormSummary[] = [];
		for (let page = 1; ; page += 1) {
			// biome-ignore lint/performance/noAwaitInLoops: pages are fetched in order
			const result = await this.request<Paginated<OpnformFormSummary>>(
				`/open/workspaces/${workspaceId}/forms?per_page=${PAGE_SIZE}&page=${page}`
			);
			forms.push(...result.data);
			if (result.meta.current_page >= result.meta.last_page) {
				return forms;
			}
		}
	}

	getForm(formId: number) {
		return this.request<OpnformForm>(`/open/forms/${formId}`);
	}

	/** Yields one page of submissions at a time (file links in it expire after ~10 minutes). */
	async *submissionPages(
		formId: number
	): AsyncGenerator<Paginated<OpnformSubmission>> {
		for (let page = 1; ; page += 1) {
			// biome-ignore lint/performance/noAwaitInLoops: pages are fetched in order
			const result = await this.request<Paginated<OpnformSubmission>>(
				`/open/forms/${formId}/submissions?per_page=${PAGE_SIZE}&page=${page}&status=all`
			);
			yield result;
			if (
				result.data.length === 0 ||
				result.meta.current_page >= result.meta.last_page
			) {
				return;
			}
		}
	}

	/** Re-fetches one submission to get fresh file links. */
	getSubmission(formId: number, submissionId: number) {
		return this.request<OpnformSubmission>(
			`/open/forms/${formId}/submissions/${submissionId}`
		);
	}

	listIntegrations(formId: number) {
		return this.request<OpnformIntegration[]>(
			`/open/forms/${formId}/integrations`
		);
	}

	/** Downloads a file (signed submission file link or public asset). */
	async download(url: string): Promise<Blob> {
		const response = await this.fetchFn(url, {
			signal: AbortSignal.timeout(120_000),
		});
		if (!response.ok) {
			throw new OpnformError(
				`Download failed (${response.status})`,
				response.status
			);
		}
		return response.blob();
	}
}

function describeStatus(status: number, path: string): string {
	if (status === 401) {
		return "OpnForm rejected the token. Check that it was copied correctly and hasn't been deleted.";
	}
	if (status === 403) {
		return "The token is missing a permission. It needs forms-read, workspaces-read, workspace-users-read and manage-integrations.";
	}
	if (status === 404) {
		return `Not found on OpnForm: ${path}. Check the address of your OpnForm instance.`;
	}
	return `OpnForm returned an error (${status}) for ${path}`;
}
