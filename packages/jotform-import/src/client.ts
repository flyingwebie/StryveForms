// biome-ignore-all lint/performance/noAwaitInLoops: JotForm is read page by page, one request at a time
import type {
	JotformEnvelope,
	JotformFile,
	JotformFormSummary,
	JotformProperties,
	JotformQuestion,
	JotformRegion,
	JotformSubmission,
	JotformUser,
} from "./types";

export const REGION_URLS: Record<JotformRegion, string> = {
	eu: "https://eu-api.jotform.com",
	hipaa: "https://hipaa-api.jotform.com",
	us: "https://api.jotform.com",
};

/** Order tried when the region is auto-detected. */
const AUTO_REGIONS: JotformRegion[] = ["us", "eu", "hipaa"];

/** JotForm's maximum page size. */
export const PAGE_SIZE = 1000;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const TRAILING_SLASHES = /\/+$/;
const API_SUFFIX = /\/api$/i;
const WHITESPACE = /\s/g;
const NOT_DELETED = JSON.stringify({ "status:ne": "DELETED" });

export class JotformError extends Error {
	readonly status: number;

	constructor(
		message: string,
		{ cause, status }: { cause?: unknown; status: number }
	) {
		super(message, { cause });
		this.status = status;
	}
}

/**
 * Enterprise accounts use their own domain: `https://forms.acme.com` →
 * `https://forms.acme.com/API`. Regional cloud URLs are kept as they are.
 */
export function normalizeApiUrl(input: string): string {
	const url = new URL(input.trim());
	const base = `${url.origin}${url.pathname}`.replace(TRAILING_SLASHES, "");
	if (Object.values(REGION_URLS).includes(url.origin)) {
		return url.origin;
	}
	return API_SUFFIX.test(base) ? base : `${base}/API`;
}

export interface JotformClientOptions {
	apiKey: string;
	baseUrl: string;
	fetch?: typeof fetch;
}

export interface JotformConnectOptions {
	apiKey: string;
	/** A region, or the API URL of an Enterprise account. */
	endpoint: JotformRegion | "auto" | { url: string };
	fetch?: typeof fetch;
}

export class JotformClient {
	readonly baseUrl: string;
	/** Daily API calls left, as last reported by JotForm. */
	limitLeft: number | null = null;
	private readonly apiKey: string;
	private readonly fetchFn: typeof fetch;

	constructor({ apiKey, baseUrl, fetch: fetchFn }: JotformClientOptions) {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl.replace(TRAILING_SLASHES, "");
		this.fetchFn = fetchFn ?? fetch;
	}

	/** Checks the key and finds the account's region. */
	static async connect(options: JotformConnectOptions): Promise<{
		client: JotformClient;
		region: JotformRegion | "enterprise";
		user: JotformUser;
	}> {
		const { endpoint } = options;
		let candidates: { region: JotformRegion | "enterprise"; url: string }[];
		if (endpoint === "auto") {
			candidates = AUTO_REGIONS.map((region) => ({
				region,
				url: REGION_URLS[region],
			}));
		} else if (typeof endpoint === "string") {
			candidates = [{ region: endpoint, url: REGION_URLS[endpoint] }];
		} else {
			candidates = [
				{ region: "enterprise", url: normalizeApiUrl(endpoint.url) },
			];
		}
		let lastError: unknown = null;
		for (const candidate of candidates) {
			const client = new JotformClient({
				apiKey: options.apiKey,
				baseUrl: candidate.url,
				fetch: options.fetch,
			});
			try {
				const user = await client.getUser();
				return { client, region: candidate.region, user };
			} catch (error) {
				lastError = error;
				const authError =
					error instanceof JotformError &&
					(error.status === 401 || error.status === 403);
				if (!authError) {
					throw error;
				}
			}
		}
		throw new JotformError(
			endpoint === "auto"
				? "JotForm didn't accept this API key in the US, EU or HIPAA region. Check the key, and that it has at least Read access."
				: "JotForm didn't accept this API key. Check the key and the region.",
			{ cause: lastError, status: 401 }
		);
	}

	private async request<T>(
		path: string,
		params: Record<string, string | number> = {},
		attempt = 0
	): Promise<JotformEnvelope<T>> {
		const url = new URL(`${this.baseUrl}${path}`);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, String(value));
		}
		let response: Response;
		try {
			response = await this.fetchFn(url, {
				headers: { Accept: "application/json", APIKEY: this.apiKey },
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			if (attempt < MAX_RETRIES) {
				await Bun.sleep(2 ** attempt * 1000);
				return this.request(path, params, attempt + 1);
			}
			throw new JotformError(
				`Couldn't reach JotForm: ${(error as Error).message}`,
				{ cause: error, status: 0 }
			);
		}
		if (response.status >= 500 && attempt < MAX_RETRIES) {
			await Bun.sleep(2 ** attempt * 1000);
			return this.request(path, params, attempt + 1);
		}
		let body: JotformEnvelope<T>;
		try {
			body = (await response.json()) as JotformEnvelope<T>;
		} catch (error) {
			throw new JotformError(
				`JotForm returned an unexpected response (${response.status}) for ${path}`,
				{ cause: error, status: response.status }
			);
		}
		const left = Number(body["limit-left"]);
		if (Number.isFinite(left)) {
			this.limitLeft = left;
		}
		const code = Number(body.responseCode);
		if (code !== 200) {
			throw new JotformError(describeError(code, body.message, path), {
				status: code,
			});
		}
		return body;
	}

	getUser(): Promise<JotformUser> {
		return this.request<JotformUser>("/user").then((r) => r.content);
	}

	/** All forms of the account except deleted ones. */
	async listForms(): Promise<JotformFormSummary[]> {
		const forms: JotformFormSummary[] = [];
		for (let offset = 0; ; offset += PAGE_SIZE) {
			const page = await this.request<JotformFormSummary[]>("/user/forms", {
				filter: NOT_DELETED,
				limit: PAGE_SIZE,
				offset,
				orderby: "created_at",
			});
			const items = Array.isArray(page.content) ? page.content : [];
			forms.push(...items.filter((f) => f.status !== "DELETED"));
			if (items.length < PAGE_SIZE) {
				return forms;
			}
		}
	}

	getForm(formId: string): Promise<JotformFormSummary> {
		return this.request<JotformFormSummary>(`/form/${formId}`).then(
			(r) => r.content
		);
	}

	/** Questions in form order. */
	async getQuestions(formId: string): Promise<JotformQuestion[]> {
		const { content } = await this.request<
			Record<string, JotformQuestion> | JotformQuestion[]
		>(`/form/${formId}/questions`);
		const list = Array.isArray(content)
			? content
			: Object.values(content ?? {});
		return list.sort((a, b) => Number(a.order) - Number(b.order));
	}

	getProperties(formId: string): Promise<JotformProperties> {
		return this.request<JotformProperties>(`/form/${formId}/properties`).then(
			(r) => (r.content && typeof r.content === "object" ? r.content : {})
		);
	}

	async listFiles(formId: string): Promise<JotformFile[]> {
		const { content } = await this.request<JotformFile[]>(
			`/form/${formId}/files`
		);
		return Array.isArray(content) ? content : [];
	}

	/** Webhook URLs set on the form. */
	async listWebhooks(formId: string): Promise<string[]> {
		const { content } = await this.request<Record<string, string> | string[]>(
			`/form/${formId}/webhooks`
		);
		const urls = Array.isArray(content)
			? content
			: Object.values(content ?? {});
		return urls.filter(
			(u): u is string => typeof u === "string" && u.startsWith("http")
		);
	}

	/**
	 * Submissions a page at a time (deleted ones skipped). JotForm lists newest
	 * first; a submission arriving mid-import only repeats one already seen,
	 * which the importer recognises, so nothing is missed.
	 */
	async *submissionPages(
		formId: string
	): AsyncGenerator<JotformSubmission[], void, unknown> {
		for (let offset = 0; ; offset += PAGE_SIZE) {
			const page = await this.request<JotformSubmission[]>(
				`/form/${formId}/submissions`,
				{
					filter: NOT_DELETED,
					limit: PAGE_SIZE,
					offset,
					orderby: "created_at",
				}
			);
			const items = Array.isArray(page.content) ? page.content : [];
			yield items.filter((s) => s.status !== "DELETED");
			if (items.length < PAGE_SIZE) {
				return;
			}
		}
	}

	/**
	 * Downloads an uploaded file. Accounts can require signing in to see
	 * uploads, so the API key is sent too (as a header, then as a parameter).
	 */
	async download(fileUrl: string): Promise<Blob> {
		const url = fileUrl.replace(WHITESPACE, "%20");
		const withKey = new URL(url);
		withKey.searchParams.set("apiKey", this.apiKey);
		const attempts: [string, Record<string, string>][] = [
			[url, { APIKEY: this.apiKey }],
			[withKey.toString(), {}],
		];
		let status = 0;
		for (const [target, headers] of attempts) {
			const response = await this.fetchFn(target, {
				headers,
				signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
			});
			({ status } = response);
			const type = response.headers.get("content-type") ?? "";
			// A sign-in page instead of the file means the download was refused.
			if (response.ok && !type.includes("text/html")) {
				return await response.blob();
			}
			await response.body?.cancel();
		}
		throw new JotformError(
			status === 404
				? "The file no longer exists on JotForm"
				: "JotForm refused the download. If your account requires signing in to view uploaded files, turn that off for the import and run it again.",
			{ status: status || 403 }
		);
	}
}

function describeError(
	code: number,
	message: string | undefined,
	path: string
): string {
	if (code === 401 || code === 403) {
		return "JotForm didn't accept this API key. Check it in JotForm under Settings → API.";
	}
	if (code === 404) {
		return `Not found on JotForm (${path}).`;
	}
	if (code === 429 || message?.toLowerCase().includes("limit")) {
		return "Your JotForm account reached its daily API limit. It resets at midnight US Eastern time — run the import again then; finished items won't be duplicated.";
	}
	return message
		? `JotForm: ${message}`
		: `JotForm returned an error (${code}) for ${path}`;
}
