/**
 * Fetches the list of models a provider currently offers, for the settings
 * page's model combobox (auto-fetched as soon as a key/base URL is
 * entered). One `parse*` function per provider, each exported on its own so
 * it can be unit-tested against a captured sample response without a real
 * network call — see model-fetch.test.ts.
 */

import { assertPublicUrl, UnsafeUrlError } from "../integrations/ssrf";
import type { AiProvider } from "./providers";

export interface ModelOption {
	label: string;
	value: string;
}

const FETCH_TIMEOUT_MS = 15_000;
const GEMINI_MODEL_PREFIX = /^models\//;
const TRAILING_SLASHES = /\/+$/;

/** A user-facing error (invalid key, unreachable URL, bad response) — the message is shown as-is in the UI. */
export class ModelFetchError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** GETs a JSON endpoint with a timeout, turning network/HTTP failures into a friendly ModelFetchError. */
async function fetchJson(url: string, headers: Record<string, string>) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetch(url, { headers, signal: controller.signal });
	} catch (error) {
		const host = (() => {
			try {
				return new URL(url).host;
			} catch {
				return url;
			}
		})();
		throw new ModelFetchError(
			error instanceof Error && error.name === "AbortError"
				? `Timed out reaching ${host}`
				: `Could not reach ${host}`,
			{ cause: error }
		);
	} finally {
		clearTimeout(timeout);
	}
	if (!response.ok) {
		if (response.status === 401 || response.status === 403) {
			throw new ModelFetchError("Invalid API key");
		}
		if (response.status === 404) {
			throw new ModelFetchError("Models endpoint not found at that URL");
		}
		throw new ModelFetchError(`Request failed (HTTP ${response.status})`);
	}
	try {
		return (await response.json()) as unknown;
	} catch (error) {
		throw new ModelFetchError("The provider returned an unexpected response", {
			cause: error,
		});
	}
}

/** Non-chat OpenAI model families (embeddings, audio, image, moderation…) to leave out of the chat picker. */
const OPENAI_EXCLUDE =
	/embedding|whisper|tts|dall-e|moderation|davinci-002|babbage|-image|-audio|realtime|transcribe/i;

export function parseOpenAiModels(data: unknown): ModelOption[] {
	if (!(isRecord(data) && Array.isArray(data.data))) {
		return [];
	}
	const ids = new Set<string>();
	for (const entry of data.data) {
		if (
			isRecord(entry) &&
			typeof entry.id === "string" &&
			!OPENAI_EXCLUDE.test(entry.id)
		) {
			ids.add(entry.id);
		}
	}
	return [...ids].sort().map((id) => ({ label: id, value: id }));
}

export function parseAnthropicModels(data: unknown): ModelOption[] {
	if (!(isRecord(data) && Array.isArray(data.data))) {
		return [];
	}
	const options: ModelOption[] = [];
	for (const entry of data.data) {
		if (isRecord(entry) && typeof entry.id === "string") {
			const label =
				typeof entry.display_name === "string" ? entry.display_name : entry.id;
			options.push({ label, value: entry.id });
		}
	}
	return options.sort((a, b) => a.value.localeCompare(b.value));
}

export function parseGeminiModels(data: unknown): ModelOption[] {
	if (!(isRecord(data) && Array.isArray(data.models))) {
		return [];
	}
	const options: ModelOption[] = [];
	for (const entry of data.models) {
		if (!(isRecord(entry) && typeof entry.name === "string")) {
			continue;
		}
		const methods = Array.isArray(entry.supportedGenerationMethods)
			? entry.supportedGenerationMethods
			: [];
		if (!methods.includes("generateContent")) {
			continue;
		}
		const id = entry.name.replace(GEMINI_MODEL_PREFIX, "");
		const label =
			typeof entry.displayName === "string" ? entry.displayName : id;
		options.push({ label, value: id });
	}
	return options.sort((a, b) => a.value.localeCompare(b.value));
}

/** Non-text OpenRouter models (e.g. embeddings, image-only) to leave out. */
const OPENROUTER_EXCLUDE = /embedding|moderation/i;

export function parseOpenRouterModels(data: unknown): ModelOption[] {
	if (!(isRecord(data) && Array.isArray(data.data))) {
		return [];
	}
	const options: ModelOption[] = [];
	for (const entry of data.data) {
		if (!(isRecord(entry) && typeof entry.id === "string")) {
			continue;
		}
		if (OPENROUTER_EXCLUDE.test(entry.id)) {
			continue;
		}
		const architecture = isRecord(entry.architecture)
			? entry.architecture
			: null;
		const outputModalities =
			architecture && Array.isArray(architecture.output_modalities)
				? architecture.output_modalities
				: null;
		if (outputModalities && !outputModalities.includes("text")) {
			continue;
		}
		const label = typeof entry.name === "string" ? entry.name : entry.id;
		options.push({ label, value: entry.id });
	}
	return options.sort((a, b) => a.value.localeCompare(b.value));
}

/** Same `{ data: [{ id }] }` wire shape as OpenAI, but self-hosted gateways rarely label model
 * families consistently — list everything the endpoint returns, unfiltered. */
export function parseOpenAiCompatibleModels(data: unknown): ModelOption[] {
	if (!(isRecord(data) && Array.isArray(data.data))) {
		return [];
	}
	const options: ModelOption[] = [];
	for (const entry of data.data) {
		if (isRecord(entry) && typeof entry.id === "string") {
			options.push({ label: entry.id, value: entry.id });
		}
	}
	return options.sort((a, b) => a.value.localeCompare(b.value));
}

export function parseOllamaModels(data: unknown): ModelOption[] {
	if (!(isRecord(data) && Array.isArray(data.models))) {
		return [];
	}
	const options: ModelOption[] = [];
	for (const entry of data.models) {
		if (isRecord(entry) && typeof entry.name === "string") {
			options.push({ label: entry.name, value: entry.name });
		}
	}
	return options.sort((a, b) => a.value.localeCompare(b.value));
}

export interface FetchModelsInput {
	apiKey?: string | null;
	baseUrl?: string | null;
	provider: AiProvider;
}

function requireKey(apiKey?: string | null): string {
	if (!apiKey) {
		throw new ModelFetchError("An API key is required to list models.");
	}
	return apiKey;
}

function requireBaseUrl(baseUrl?: string | null): string {
	if (!baseUrl) {
		throw new ModelFetchError("A base URL is required to list models.");
	}
	return baseUrl;
}

function normalizeBaseUrl(url: string): string {
	return url.replace(TRAILING_SLASHES, "");
}

/**
 * Validates an Ollama/local base URL: well-formed http(s), no embedded
 * credentials. Unlike `assertPublicUrl` it does NOT reject private/loopback
 * addresses — a local Ollama install at http://localhost:11434 (or a LAN
 * box) is the expected, intended target, not an SSRF risk the way an
 * arbitrary OpenAI-compatible gateway URL would be.
 */
function validateLocalUrl(raw: string): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch (error) {
		throw new UnsafeUrlError("Invalid URL", { cause: error });
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new UnsafeUrlError("Only http(s) URLs are allowed");
	}
	if (url.username || url.password) {
		throw new UnsafeUrlError("URLs with credentials are not allowed");
	}
	return url;
}

/** Fetches + parses a provider's model list. Throws ModelFetchError/UnsafeUrlError with a user-facing message. */
export async function fetchProviderModels(
	input: FetchModelsInput
): Promise<ModelOption[]> {
	switch (input.provider) {
		case "openai": {
			const key = requireKey(input.apiKey);
			const data = await fetchJson("https://api.openai.com/v1/models", {
				Authorization: `Bearer ${key}`,
			});
			return parseOpenAiModels(data);
		}
		case "anthropic": {
			const key = requireKey(input.apiKey);
			const data = await fetchJson("https://api.anthropic.com/v1/models", {
				"anthropic-version": "2023-06-01",
				"x-api-key": key,
			});
			return parseAnthropicModels(data);
		}
		case "gemini": {
			const key = requireKey(input.apiKey);
			const data = await fetchJson(
				`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`,
				{}
			);
			return parseGeminiModels(data);
		}
		case "openrouter": {
			const data = await fetchJson("https://openrouter.ai/api/v1/models", {});
			return parseOpenRouterModels(data);
		}
		case "openai_compatible": {
			const baseUrl = normalizeBaseUrl(requireBaseUrl(input.baseUrl));
			// User-supplied endpoint: full SSRF guard (can be any host).
			await assertPublicUrl(baseUrl);
			const headers: Record<string, string> = {};
			if (input.apiKey) {
				headers.Authorization = `Bearer ${input.apiKey}`;
			}
			const data = await fetchJson(`${baseUrl}/models`, headers);
			return parseOpenAiCompatibleModels(data);
		}
		case "ollama": {
			const baseUrl = normalizeBaseUrl(requireBaseUrl(input.baseUrl));
			validateLocalUrl(baseUrl);
			const data = await fetchJson(`${baseUrl}/api/tags`, {});
			return parseOllamaModels(data);
		}
		default:
			throw new ModelFetchError(
				`Unknown AI provider: ${input.provider satisfies never}`
			);
	}
}
