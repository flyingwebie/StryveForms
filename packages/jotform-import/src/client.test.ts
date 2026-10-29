import { describe, expect, test } from "bun:test";

import {
	JotformClient,
	JotformError,
	normalizeApiUrl,
	PAGE_SIZE,
} from "./client";

type Handler = (url: URL, init?: RequestInit) => Response;

function fakeFetch(handler: Handler): typeof fetch {
	return (async (input: string | URL | Request, init?: RequestInit) =>
		handler(new URL(String(input)), init)) as typeof fetch;
}

const ok = (content: unknown, extra: Record<string, unknown> = {}) =>
	Response.json({ content, message: "success", responseCode: 200, ...extra });
const denied = () =>
	Response.json(
		{ content: "", message: "You're not authorized", responseCode: 401 },
		{ status: 401 }
	);

describe("JotformClient", () => {
	test("auto-detects the account's region", async () => {
		const hosts: string[] = [];
		const { client, region, user } = await JotformClient.connect({
			apiKey: "key",
			endpoint: "auto",
			fetch: fakeFetch((url, init) => {
				hosts.push(url.hostname);
				expect(
					(init?.headers as Record<string, string> | undefined)?.APIKEY
				).toBe("key");
				return url.hostname === "eu-api.jotform.com"
					? ok(
							{ email: "ada@example.com", username: "ada" },
							{ "limit-left": 990 }
						)
					: denied();
			}),
		});
		expect(region).toBe("eu");
		expect(user.username).toBe("ada");
		expect(client.limitLeft).toBe(990);
		expect(hosts).toEqual(["api.jotform.com", "eu-api.jotform.com"]);
	});

	test("follows JotForm's EU Safe mode hint to the EU region", async () => {
		const hosts: string[] = [];
		const { region } = await JotformClient.connect({
			apiKey: "key",
			endpoint: "auto",
			fetch: fakeFetch((url) => {
				hosts.push(url.hostname);
				return url.hostname === "eu-api.jotform.com"
					? ok({ email: "ada@example.com", username: "ada" })
					: Response.json({
							content: "",
							message:
								'Your account is in EU Safe mode. Please use "eu-api.jotform.com" endpoint to get your results.',
							responseCode: 301,
						});
			}),
		});
		expect(region).toBe("eu");
		expect(hosts).toEqual(["api.jotform.com", "eu-api.jotform.com"]);
	});

	test("waits and retries when JotForm throttles a burst (HTTP 429)", async () => {
		let calls = 0;
		const client = new JotformClient({
			apiKey: "key",
			baseUrl: "https://api.jotform.com",
			fetch: fakeFetch(() => {
				calls += 1;
				return calls === 1
					? new Response("Too Many Requests", {
							headers: { "retry-after": "0" },
							status: 429,
						})
					: ok([]);
			}),
		});
		expect(await client.listFiles("1")).toEqual([]);
		expect(calls).toBe(2);
	});

	test("explains a rejected key", async () => {
		const attempt = JotformClient.connect({
			apiKey: "bad",
			endpoint: "auto",
			fetch: fakeFetch(denied),
		});
		await expect(attempt).rejects.toBeInstanceOf(JotformError);
		await expect(attempt).rejects.toThrow("US, EU or HIPAA");
	});

	test("reads submissions page by page", async () => {
		const offsets: string[] = [];
		const client = new JotformClient({
			apiKey: "key",
			baseUrl: "https://api.jotform.com",
			fetch: fakeFetch((url) => {
				offsets.push(url.searchParams.get("offset") ?? "");
				expect(url.searchParams.get("limit")).toBe(String(PAGE_SIZE));
				const offset = Number(url.searchParams.get("offset"));
				const count = offset === 0 ? PAGE_SIZE : 3;
				return ok(
					Array.from({ length: count }, (_, i) => ({
						id: String(offset + i),
						status: i === 0 ? "DELETED" : "ACTIVE",
					}))
				);
			}),
		});
		let total = 0;
		for await (const page of client.submissionPages("1")) {
			total += page.length;
		}
		expect(offsets).toEqual(["0", String(PAGE_SIZE)]);
		expect(total).toBe(PAGE_SIZE + 3 - 2);
	});

	test("reports the daily limit clearly", async () => {
		const client = new JotformClient({
			apiKey: "key",
			baseUrl: "https://api.jotform.com",
			fetch: fakeFetch(() =>
				Response.json({
					content: "",
					message: "API-Limit exceeded",
					responseCode: 429,
				})
			),
		});
		await expect(client.getUser()).rejects.toThrow("daily API limit");
	});

	test("retries a protected download with the key as a parameter", async () => {
		const seen: string[] = [];
		const client = new JotformClient({
			apiKey: "key",
			baseUrl: "https://api.jotform.com",
			fetch: fakeFetch((url) => {
				seen.push(url.search);
				return url.searchParams.get("apiKey") === "key"
					? new Response("PDF", {
							headers: { "content-type": "application/pdf" },
						})
					: new Response("<html>login</html>", {
							headers: { "content-type": "text/html" },
						});
			}),
		});
		const blob = await client.download(
			"https://www.jotform.com/uploads/ada/1/2/My CV.pdf"
		);
		expect(await blob.text()).toBe("PDF");
		expect(seen).toEqual(["", "?apiKey=key"]);
	});
});

describe("normalizeApiUrl", () => {
	test("keeps regional URLs and adds /API for Enterprise domains", () => {
		expect(normalizeApiUrl("https://eu-api.jotform.com/")).toBe(
			"https://eu-api.jotform.com"
		);
		expect(normalizeApiUrl("https://forms.acme.com")).toBe(
			"https://forms.acme.com/API"
		);
		expect(normalizeApiUrl("https://forms.acme.com/API/")).toBe(
			"https://forms.acme.com/API"
		);
	});
});
