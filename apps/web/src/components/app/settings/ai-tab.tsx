import { Button } from "@StryveForms/ui/components/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@StryveForms/ui/components/combobox";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, TrashIcon, ZapIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { WorkspaceSummary } from "@/lib/workspace";
import { useTRPC, useTRPCClient } from "@/utils/trpc";

/** How long to wait after the key/base URL stops changing before auto-fetching the model list. */
const MODEL_FETCH_DEBOUNCE_MS = 600;

type Provider =
	| "openai"
	| "anthropic"
	| "gemini"
	| "openrouter"
	| "openai_compatible"
	| "ollama";

const PROVIDERS: {
	description: string;
	initial: string;
	label: string;
	value: Provider;
}[] = [
	{
		description: "GPT-4o, o3, o3-mini",
		initial: "O",
		label: "OpenAI",
		value: "openai",
	},
	{
		description: "Claude Opus, Sonnet, Haiku",
		initial: "A",
		label: "Anthropic",
		value: "anthropic",
	},
	{
		description: "Gemini 2.5 Pro, Flash",
		initial: "G",
		label: "Gemini",
		value: "gemini",
	},
	{
		description: "100+ hosted models",
		initial: "R",
		label: "OpenRouter",
		value: "openrouter",
	},
	{
		description: "Custom base URL",
		initial: "C",
		label: "OpenAI-compatible",
		value: "openai_compatible",
	},
	{
		description: "Local models",
		initial: "L",
		label: "Ollama",
		value: "ollama",
	},
];

/** One provider tile in the picker grid — icon letter, name and short description. */
function ProviderTile({
	onSelect,
	provider,
	selected,
}: {
	onSelect: () => void;
	provider: (typeof PROVIDERS)[number];
	selected: boolean;
}) {
	return (
		<button
			aria-pressed={selected}
			className={cn(
				"relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
				selected
					? "border-primary bg-primary-soft"
					: "border-border hover:border-foreground/40 hover:bg-muted/40"
			)}
			onClick={onSelect}
			type="button"
		>
			{selected ? (
				<CheckIcon className="absolute top-3 right-3 size-4 text-primary" />
			) : null}
			<span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft font-semibold text-primary-soft-foreground text-sm">
				{provider.initial}
			</span>
			<span className="space-y-0.5">
				<span className="block font-medium text-sm">{provider.label}</span>
				<span className="block text-subtle-foreground text-xs">
					{provider.description}
				</span>
			</span>
		</button>
	);
}

const NEEDS_BASE_URL: readonly Provider[] = ["openai_compatible", "ollama"];
const NEEDS_KEY: readonly Provider[] = [
	"openai",
	"anthropic",
	"gemini",
	"openrouter",
];

/** Where to get a key/address for each provider, shown under the picker. */
const PROVIDER_HINTS: Record<Provider, string> = {
	anthropic: "Get a key at console.anthropic.com/settings/keys",
	gemini: "Get a key at aistudio.google.com/apikey",
	ollama: "A local Ollama server — no key needed, just its address",
	openai: "Get a key at platform.openai.com/api-keys",
	openai_compatible:
		"Any OpenAI-compatible endpoint (self-hosted gateway, proxy, etc.) — needs a base URL",
	openrouter: "Get a key at openrouter.ai/keys — one key, 300+ models",
};

function providerLabel(provider: string): string {
	return PROVIDERS.find((p) => p.value === provider)?.label ?? provider;
}

/** The request body shared by Save and Test connection. */
function credentialInput({
	apiKey,
	baseUrl,
	model,
	needsBaseUrl,
	provider,
	workspaceId,
}: {
	apiKey: string;
	baseUrl: string;
	model: string;
	needsBaseUrl: boolean;
	provider: Provider;
	workspaceId: string;
}) {
	return {
		apiKey: apiKey || undefined,
		baseUrl: needsBaseUrl ? baseUrl || undefined : undefined,
		model: model.trim(),
		provider,
		workspaceId,
	};
}

/** The base URL field, shown only for providers that need a custom endpoint. */
function BaseUrlField({
	onChange,
	provider,
	value,
}: {
	onChange: (value: string) => void;
	provider: Provider;
	value: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor="ai-base-url">
				{provider === "ollama" ? "Server address" : "Base URL"}
			</Label>
			<Input
				id="ai-base-url"
				onChange={(event) => onChange(event.target.value)}
				placeholder={
					provider === "ollama"
						? "http://localhost:11434"
						: "https://your-gateway.example.com/v1"
				}
				value={value}
			/>
		</div>
	);
}

/** What the combobox's empty state shows: loading, an error, or a hint that free text is fine. */
function modelComboboxEmptyLabel({
	error,
	loading,
	model,
}: {
	error: string | null;
	loading: boolean;
	model: string;
}): string {
	if (loading) {
		return "Fetching models…";
	}
	if (error) {
		return error;
	}
	const trimmed = model.trim();
	return trimmed ? `Press Enter to use "${trimmed}"` : "Type a model name";
}

/** The helper line under the model field: loading, an error, a result count, or the default hint. */
function modelHintText({
	error,
	loading,
	optionsCount,
}: {
	error: string | null;
	loading: boolean;
	optionsCount: number;
}): string {
	if (error) {
		return error;
	}
	if (loading) {
		return "Fetching available models…";
	}
	if (optionsCount > 0) {
		return `${optionsCount} model(s) found for this provider — search the list, or type any other model name.`;
	}
	return "A sensible default is pre-filled. Add a key (and base URL) to fetch this provider's models, or type any other model name it supports.";
}

/** The model field: a searchable combobox of fetched + default models that also accepts free text. */
function ModelField({
	fetchedModels,
	items,
	model,
	onChange,
}: {
	fetchedModels: {
		error: string | null;
		loading: boolean;
		options: { label: string; value: string }[];
	};
	items: { label: string; value: string }[];
	model: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor="ai-model">Model</Label>
			<Combobox
				inputValue={model}
				items={items}
				onInputValueChange={onChange}
				onValueChange={(value) => {
					if (typeof value === "string") {
						onChange(value);
					}
				}}
			>
				<ComboboxInput
					className="w-full"
					id="ai-model"
					placeholder="model name"
				/>
				<ComboboxContent>
					<ComboboxList>
						{items.map((item) => (
							<ComboboxItem key={item.value} value={item.value}>
								{item.label}
							</ComboboxItem>
						))}
					</ComboboxList>
					<ComboboxEmpty>
						{modelComboboxEmptyLabel({
							error: fetchedModels.error,
							loading: fetchedModels.loading,
							model,
						})}
					</ComboboxEmpty>
				</ComboboxContent>
			</Combobox>
			<p
				className={
					fetchedModels.error
						? "text-destructive text-xs"
						: "text-muted-foreground text-xs"
				}
			>
				{modelHintText({
					error: fetchedModels.error,
					loading: fetchedModels.loading,
					optionsCount: fetchedModels.options.length,
				})}
			</p>
		</div>
	);
}

/** The API key field, with a hint when a key is already saved. */
function ApiKeyField({
	hasKey,
	lastFour,
	onChange,
	value,
}: {
	hasKey: boolean;
	lastFour: string | null;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor="ai-api-key">
				API key{hasKey ? ` (currently ${lastFour ?? "saved"})` : ""}
			</Label>
			<Input
				id="ai-api-key"
				onChange={(event) => onChange(event.target.value)}
				placeholder={hasKey ? "Leave blank to keep the current key" : "sk-…"}
				type="password"
				value={value}
			/>
		</div>
	);
}

/** The save/remove/test mutations, wired to clear the key field and test result on success. */
function useCredentialMutations({
	onChanged,
	setTestResult,
	workspaceId,
}: {
	onChanged: () => void;
	setTestResult: (result: { message: string; ok: boolean } | null) => void;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.ai.credential.get.queryKey({ workspaceId }),
		});

	const save = useMutation(
		trpc.ai.credential.save.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				onChanged();
				toast.success("AI provider saved");
			},
		})
	);
	const remove = useMutation(
		trpc.ai.credential.remove.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				onChanged();
				toast.success("API key removed");
			},
		})
	);
	const test = useMutation(
		trpc.ai.credential.test.mutationOptions({
			onError: (error) => setTestResult({ message: error.message, ok: false }),
			onSuccess: (data) =>
				setTestResult({
					message: data.ok
						? `Connected — model replied "${data.reply}"`
						: data.reply,
					ok: data.ok,
				}),
		})
	);

	return { remove, save, test };
}

/**
 * Auto-fetches the provider's model list, debounced, whenever the provider,
 * key, or base URL settle. Uses the already-saved key/base URL when the
 * field is left blank (so a configured credential re-lists without
 * re-entering anything) — the server resolves that fallback, this hook just
 * tells it when enough has been entered to bother asking.
 */
function useModelOptions({
	apiKey,
	baseUrl,
	hasSavedBaseUrl,
	hasSavedKey,
	needsBaseUrl,
	needsKey,
	provider,
	workspaceId,
}: {
	apiKey: string;
	baseUrl: string;
	hasSavedBaseUrl: boolean;
	hasSavedKey: boolean;
	needsBaseUrl: boolean;
	needsKey: boolean;
	provider: Provider;
	workspaceId: string;
}) {
	const trpcClient = useTRPCClient();
	const [debouncedApiKey, setDebouncedApiKey] = useState(apiKey);
	const [debouncedBaseUrl, setDebouncedBaseUrl] = useState(baseUrl);
	const [options, setOptions] = useState<{ label: string; value: string }[]>(
		[]
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const timeout = setTimeout(() => {
			setDebouncedApiKey(apiKey);
			setDebouncedBaseUrl(baseUrl);
		}, MODEL_FETCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [apiKey, baseUrl]);

	useEffect(() => {
		const trimmedKey = debouncedApiKey.trim();
		const trimmedBaseUrl = debouncedBaseUrl.trim();
		const hasUsableKey = !needsKey || trimmedKey.length > 0 || hasSavedKey;
		const hasUsableBaseUrl =
			!needsBaseUrl || trimmedBaseUrl.length > 0 || hasSavedBaseUrl;
		if (!(hasUsableKey && hasUsableBaseUrl)) {
			setOptions([]);
			setError(null);
			return;
		}
		let cancelled = false;
		setLoading(true);
		setError(null);
		trpcClient.ai.credential.models
			.mutate({
				apiKey: trimmedKey || undefined,
				baseUrl: needsBaseUrl ? trimmedBaseUrl || undefined : undefined,
				provider,
				workspaceId,
			})
			.then((data) => {
				if (!cancelled) {
					setOptions(data.models);
				}
			})
			.catch((fetchError: unknown) => {
				if (!cancelled) {
					setOptions([]);
					setError(
						fetchError instanceof Error
							? fetchError.message
							: "Could not list models"
					);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [
		provider,
		debouncedApiKey,
		debouncedBaseUrl,
		needsKey,
		needsBaseUrl,
		hasSavedKey,
		hasSavedBaseUrl,
		trpcClient,
		workspaceId,
	]);

	return { error, loading, options };
}

export default function AiSettingsTab({
	workspace,
}: {
	workspace: WorkspaceSummary;
}) {
	const trpc = useTRPC();
	const credential = useQuery(
		trpc.ai.credential.get.queryOptions({ workspaceId: workspace.id })
	);

	if (workspace.role !== "admin") {
		return (
			<div className="max-w-lg space-y-2">
				<h3 className="font-medium text-sm">AI assistant</h3>
				<p className="text-muted-foreground text-sm">
					{credential.data
						? `This workspace uses ${providerLabel(credential.data.provider)} (${credential.data.model}). Ask a workspace admin to change the provider or key.`
						: "No AI provider is configured yet. Ask a workspace admin to set one up."}
				</p>
			</div>
		);
	}

	return (
		<AiProviderForm
			credential={credential.data ?? null}
			workspace={workspace}
		/>
	);
}

/** The editable provider/model/key form — admins only. */
function AiProviderForm({
	credential: initialCredential,
	workspace,
}: {
	credential: {
		baseUrl: string | null;
		hasKey: boolean;
		lastFour: string | null;
		model: string;
		provider: string;
	} | null;
	workspace: WorkspaceSummary;
}) {
	const trpc = useTRPC();
	const credential = useQuery({
		...trpc.ai.credential.get.queryOptions({ workspaceId: workspace.id }),
		initialData: initialCredential,
	});
	const defaultModels = useQuery(trpc.ai.defaultModels.queryOptions());

	const [provider, setProvider] = useState<Provider>("openai");
	const [model, setModel] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [testResult, setTestResult] = useState<{
		message: string;
		ok: boolean;
	} | null>(null);

	useEffect(() => {
		if (!credential.data) {
			return;
		}
		setProvider(credential.data.provider as Provider);
		setModel(credential.data.model);
		setBaseUrl(credential.data.baseUrl ?? "");
	}, [credential.data]);

	const { remove, save, test } = useCredentialMutations({
		onChanged: () => {
			setApiKey("");
			setTestResult(null);
		},
		setTestResult,
		workspaceId: workspace.id,
	});

	const needsBaseUrl = NEEDS_BASE_URL.includes(provider);
	const needsKey = NEEDS_KEY.includes(provider);
	const activeHint = PROVIDER_HINTS[provider];

	const fetchedModels = useModelOptions({
		apiKey,
		baseUrl,
		hasSavedBaseUrl: Boolean(credential.data?.baseUrl),
		hasSavedKey: Boolean(credential.data?.hasKey),
		needsBaseUrl,
		needsKey,
		provider,
		workspaceId: workspace.id,
	});

	// The default suggestion always stays in the list, even once real models
	// come back, so a familiar name never disappears from under the user.
	const defaultModel = defaultModels.data?.[provider];
	const modelItems = (() => {
		const seen = new Set<string>();
		const items: { label: string; value: string }[] = [];
		if (defaultModel) {
			items.push({ label: `${defaultModel} (default)`, value: defaultModel });
			seen.add(defaultModel);
		}
		for (const option of fetchedModels.options) {
			if (!seen.has(option.value)) {
				items.push(option);
				seen.add(option.value);
			}
		}
		return items;
	})();

	return (
		<div className="max-w-2xl space-y-6">
			<p className="text-muted-foreground text-sm">
				Connect a provider to power Ask AI, form generation, and summaries
				across this workspace. The key is encrypted at rest and never shown
				again after saving.
			</p>

			<div className="space-y-2">
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{PROVIDERS.map((p) => (
						<ProviderTile
							key={p.value}
							onSelect={() => {
								setProvider(p.value);
								setModel(defaultModels.data?.[p.value] ?? "");
								setTestResult(null);
							}}
							provider={p}
							selected={provider === p.value}
						/>
					))}
				</div>
				{activeHint ? (
					<p className="text-muted-foreground text-xs">{activeHint}</p>
				) : null}
			</div>

			<ModelField
				fetchedModels={fetchedModels}
				items={modelItems}
				model={model}
				onChange={setModel}
			/>

			{needsBaseUrl ? (
				<BaseUrlField
					onChange={setBaseUrl}
					provider={provider}
					value={baseUrl}
				/>
			) : null}

			{needsKey ? (
				<ApiKeyField
					hasKey={Boolean(credential.data?.hasKey)}
					lastFour={credential.data?.lastFour ?? null}
					onChange={setApiKey}
					value={apiKey}
				/>
			) : null}

			{testResult ? (
				<p
					className={
						testResult.ok ? "text-sm text-success" : "text-destructive text-sm"
					}
				>
					{testResult.message}
				</p>
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-5">
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={test.isPending || !model.trim()}
						onClick={() =>
							test.mutate(
								credentialInput({
									apiKey,
									baseUrl,
									model,
									needsBaseUrl,
									provider,
									workspaceId: workspace.id,
								})
							)
						}
						variant="outline"
					>
						<ZapIcon /> {test.isPending ? "Testing…" : "Test connection"}
					</Button>
					<Button
						disabled={save.isPending || !model.trim()}
						onClick={() =>
							save.mutate(
								credentialInput({
									apiKey,
									baseUrl,
									model,
									needsBaseUrl,
									provider,
									workspaceId: workspace.id,
								})
							)
						}
					>
						{save.isPending ? "Saving…" : "Save"}
					</Button>
				</div>
				{credential.data?.hasKey ? (
					<Button
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						disabled={remove.isPending}
						onClick={() => remove.mutate({ workspaceId: workspace.id })}
						variant="ghost"
					>
						<TrashIcon /> Remove key
					</Button>
				) : null}
			</div>
		</div>
	);
}
