import { describe, expect, test } from "bun:test";

import {
	parseAnthropicModels,
	parseGeminiModels,
	parseOllamaModels,
	parseOpenAiCompatibleModels,
	parseOpenAiModels,
	parseOpenRouterModels,
} from "./model-fetch";

describe("parseOpenAiModels", () => {
	test("keeps chat models and drops embeddings/audio/image/moderation", () => {
		const options = parseOpenAiModels({
			data: [
				{ id: "gpt-5.1" },
				{ id: "gpt-4o-mini" },
				{ id: "text-embedding-3-large" },
				{ id: "whisper-1" },
				{ id: "tts-1" },
				{ id: "dall-e-3" },
				{ id: "omni-moderation-latest" },
			],
		});
		expect(options).toEqual([
			{ label: "gpt-4o-mini", value: "gpt-4o-mini" },
			{ label: "gpt-5.1", value: "gpt-5.1" },
		]);
	});

	test("deduplicates and sorts", () => {
		const options = parseOpenAiModels({
			data: [{ id: "gpt-5.1" }, { id: "gpt-4o-mini" }, { id: "gpt-5.1" }],
		});
		expect(options.map((o) => o.value)).toEqual(["gpt-4o-mini", "gpt-5.1"]);
	});

	test("returns an empty list for a malformed response", () => {
		expect(parseOpenAiModels({})).toEqual([]);
		expect(parseOpenAiModels(null)).toEqual([]);
		expect(parseOpenAiModels({ data: "nope" })).toEqual([]);
	});
});

describe("parseAnthropicModels", () => {
	test("uses display_name as the label when present", () => {
		const options = parseAnthropicModels({
			data: [
				{ display_name: "Claude Sonnet 4.5", id: "claude-sonnet-4-5" },
				{ id: "claude-haiku-4-5" },
			],
		});
		expect(options).toEqual([
			{ label: "claude-haiku-4-5", value: "claude-haiku-4-5" },
			{ label: "Claude Sonnet 4.5", value: "claude-sonnet-4-5" },
		]);
	});
});

describe("parseGeminiModels", () => {
	test("keeps only models supporting generateContent and strips the models/ prefix", () => {
		const options = parseGeminiModels({
			models: [
				{
					displayName: "Gemini 2.5 Flash",
					name: "models/gemini-2.5-flash",
					supportedGenerationMethods: ["generateContent"],
				},
				{
					name: "models/embedding-001",
					supportedGenerationMethods: ["embedContent"],
				},
			],
		});
		expect(options).toEqual([
			{ label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
		]);
	});
});

describe("parseOpenRouterModels", () => {
	test("keeps text-output models and drops embeddings", () => {
		const options = parseOpenRouterModels({
			data: [
				{
					architecture: { output_modalities: ["text"] },
					id: "openai/gpt-4o-mini",
					name: "GPT-4o mini",
				},
				{
					architecture: { output_modalities: ["embedding"] },
					id: "openai/text-embedding-3-large",
					name: "Embedding",
				},
				{ id: "some/text-embedding-model" },
			],
		});
		expect(options).toEqual([
			{ label: "GPT-4o mini", value: "openai/gpt-4o-mini" },
		]);
	});

	test("keeps models with no architecture metadata", () => {
		const options = parseOpenRouterModels({
			data: [{ id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5" }],
		});
		expect(options).toEqual([
			{ label: "Claude Sonnet 4.5", value: "anthropic/claude-sonnet-4.5" },
		]);
	});
});

describe("parseOpenAiCompatibleModels", () => {
	test("lists every model unfiltered", () => {
		const options = parseOpenAiCompatibleModels({
			data: [{ id: "mock-model" }, { id: "another-model" }],
		});
		expect(options).toEqual([
			{ label: "another-model", value: "another-model" },
			{ label: "mock-model", value: "mock-model" },
		]);
	});
});

describe("parseOllamaModels", () => {
	test("lists local tags by name", () => {
		const options = parseOllamaModels({
			models: [{ name: "llama3.1:latest" }, { name: "mistral:7b" }],
		});
		expect(options).toEqual([
			{ label: "llama3.1:latest", value: "llama3.1:latest" },
			{ label: "mistral:7b", value: "mistral:7b" },
		]);
	});

	test("returns an empty list when there are no local models", () => {
		expect(parseOllamaModels({ models: [] })).toEqual([]);
	});
});
