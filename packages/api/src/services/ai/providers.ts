/**
 * Builds a TanStack AI text adapter for whichever provider a workspace
 * configured. One function per provider from the official adapters
 * (@tanstack/ai-openai, -anthropic, -gemini, -openrouter, -ollama); the
 * "openai_compatible" option covers OpenRouter-alikes and self-hosted
 * OpenAI-compatible gateways via a custom base URL, including our own
 * mock server used in tests.
 */
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import { createGeminiChat } from "@tanstack/ai-gemini";
import { createOllamaChat } from "@tanstack/ai-ollama";
import { createOpenaiChat } from "@tanstack/ai-openai";
import { openaiCompatible } from "@tanstack/ai-openai/compatible";
import { createOpenRouterText } from "@tanstack/ai-openrouter";

export const AI_PROVIDERS = [
	"openai",
	"anthropic",
	"gemini",
	"openrouter",
	"openai_compatible",
	"ollama",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Sensible default models shown in the settings UI; the model field also accepts free text. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
	anthropic: "claude-sonnet-4-5",
	gemini: "gemini-2.5-flash",
	ollama: "llama3.1",
	openai: "gpt-5.1",
	openai_compatible: "gpt-4o-mini",
	openrouter: "openai/gpt-4o-mini",
};

export interface ProviderConfig {
	apiKey?: string | null;
	baseUrl?: string | null;
	model: string;
	provider: AiProvider;
}

/** A provider needs a real API key unless it's local (Ollama) or a gateway that doesn't require one. */
function requireApiKey(config: ProviderConfig): string {
	if (!config.apiKey) {
		throw new Error(
			`An API key is required for the ${config.provider} provider.`
		);
	}
	return config.apiKey;
}

/**
 * The official adapters type `model` as a union of known model ids so
 * editors get autocomplete, but the settings UI also accepts free text (a
 * newer model the adapter's type list hasn't caught up with yet, or a
 * self-hosted model name). Runtime behaviour doesn't care — the adapters
 * just forward the string to the provider's API — so this cast is safe.
 * biome-ignore lint/suspicious/noExplicitAny: see above
 */
function modelId(model: string): any {
	return model;
}

// biome-ignore lint/suspicious/noExplicitAny: adapters differ per provider; callers only need the `chat()`-compatible shape
export function buildTextAdapter(config: ProviderConfig): any {
	switch (config.provider) {
		case "openai":
			return createOpenaiChat(modelId(config.model), requireApiKey(config), {
				...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
			});
		case "anthropic":
			return createAnthropicChat(modelId(config.model), requireApiKey(config), {
				...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
			});
		case "gemini":
			return createGeminiChat(modelId(config.model), requireApiKey(config), {
				...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
			});
		case "openrouter":
			// OpenRouter has one fixed API endpoint; it has no custom-base-URL option.
			return createOpenRouterText(modelId(config.model), requireApiKey(config));
		case "ollama":
			return createOllamaChat(
				modelId(config.model),
				config.baseUrl || undefined
			);
		case "openai_compatible": {
			if (!config.baseUrl) {
				throw new Error("An OpenAI-compatible provider needs a base URL.");
			}
			// Many self-hosted gateways accept any non-empty bearer token.
			const factory = openaiCompatible({
				apiKey: config.apiKey || "not-needed",
				baseURL: config.baseUrl,
				models: [config.model],
				name: "openai-compatible",
			});
			return factory(modelId(config.model));
		}
		default:
			throw new Error(
				`Unknown AI provider: ${config.provider satisfies never}`
			);
	}
}

export function isAiProvider(value: string): value is AiProvider {
	return (AI_PROVIDERS as readonly string[]).includes(value);
}
