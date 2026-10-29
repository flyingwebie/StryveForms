import { describe, expect, test } from "bun:test";

import { OpnformClient, OpnformError } from "./client";

function clientWith(responses: Response[]) {
	const calls: string[] = [];
	const fetchFn = ((input: string | URL | Request) => {
		calls.push(String(input));
		const next = responses.shift();
		if (!next) {
			throw new Error("No more responses");
		}
		return Promise.resolve(next);
	}) as typeof fetch;
	const client = new OpnformClient({
		baseUrl: "https://api.opnform.com",
		fetch: fetchFn,
		requestsPerMinute: 6000,
		token: "t",
	});
	return { calls, client };
}

describe("OpnformClient.download", () => {
	test("retries a 429 after Retry-After and returns the file", async () => {
		const { calls, client } = clientWith([
			new Response("slow down", {
				headers: { "retry-after": "0" },
				status: 429,
			}),
			new Response("file-bytes"),
		]);
		const blob = await client.download("https://api.opnform.com/files/a.pdf");
		expect(await blob.text()).toBe("file-bytes");
		expect(calls).toHaveLength(2);
	});

	test("does not retry a 403, so expired links can be refreshed", async () => {
		const { calls, client } = clientWith([new Response("", { status: 403 })]);
		const error = await client
			.download("https://api.opnform.com/files/a.pdf")
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(OpnformError);
		expect((error as OpnformError).status).toBe(403);
		expect(calls).toHaveLength(1);
	});
});
