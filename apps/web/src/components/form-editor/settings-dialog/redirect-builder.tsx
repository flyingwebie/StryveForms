import { evaluateComputedVariables } from "@StryveForms/forms/computed";
import {
	buildRedirectUrl,
	exampleFieldValue,
	fieldParamValue,
	paramFieldId,
	parseRedirectUrl,
	type RedirectParam,
	resolveRedirectUrl,
} from "@StryveForms/forms/redirect";
import type { ComputedVariable, FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOptGroup,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import { Switch } from "@StryveForms/ui/components/switch";
import { AtSignIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { nanoid } from "nanoid";
import { useMemo, useState } from "react";

import { useEditor } from "../state/editor-context";

/**
 * A singleLine RichTextEditor's content is always exactly one `<p>...</p>`
 * (TipTap always serializes a paragraph wrapper, even for one line). The
 * base URL field is kept in exactly that shape end-to-end — never stripped —
 * so what's fed back as its `value` after every keystroke is byte-identical
 * to what the editor itself just produced. Stripping and re-adding the
 * wrapper on each render breaks the editor's own change-detection and
 * resets the cursor mid-type, which is why this now only *inserts into* the
 * wrapper (for the "Insert field" button) instead of removing it.
 */
const PARAGRAPH_WRAP = /^\s*<p>([\s\S]*?)<\/p>\s*$/i;

/** Inserts `insertion` at the end of a `<p>...</p>`-wrapped (or empty) base URL. */
function insertIntoBaseUrl(html: string, insertion: string): string {
	const inner = html.match(PARAGRAPH_WRAP)?.[1] ?? html;
	return `<p>${inner}${insertion}</p>`;
}

interface Target {
	id: string;
	kind: "field" | "variable";
	label: string;
}

/** Picker target for every field (hidden ones flagged) and computed variable. */
function useTargets(): Target[] {
	const { state } = useEditor();
	const fields = state.settings.properties as FormField[];
	return useMemo(() => {
		const fieldTargets: Target[] = fields
			.filter((f) => f.type !== "nf-page-break" && !f.type.startsWith("nf-"))
			.map((f) => ({
				id: f.id,
				kind: "field",
				label: f.hidden ? `${f.name} (hidden)` : f.name,
			}));
		const variableTargets: Target[] = state.settings.computedVariables.map(
			(v) => ({ id: v.id, kind: "variable", label: v.name })
		);
		return [...fieldTargets, ...variableTargets];
	}, [fields, state.settings.computedVariables]);
}

function ParamRow({
	onChange,
	onRemove,
	param,
	targets,
}: {
	onChange: (param: RedirectParam) => void;
	onRemove: () => void;
	param: RedirectParam;
	targets: Target[];
}) {
	const selectedFieldId = paramFieldId(param.value);

	return (
		<div className="flex items-center gap-2">
			<Input
				aria-label="Parameter name"
				className="w-32 shrink-0"
				onChange={(e) => onChange({ ...param, name: e.target.value })}
				placeholder="name"
				value={param.name}
			/>
			<span className="text-muted-foreground text-sm">=</span>
			<NativeSelect
				aria-label="Field to pass as this parameter's value"
				className="flex-1"
				onChange={(e) => {
					const target = targets.find((t) => t.id === e.target.value);
					if (target) {
						onChange({
							...param,
							value: fieldParamValue({ id: target.id, name: target.label }),
						});
					}
				}}
				value={selectedFieldId ?? ""}
			>
				<option disabled value="">
					{selectedFieldId ? "Unknown field" : "Choose a field…"}
				</option>
				<NativeSelectOptGroup label="Fields">
					{targets
						.filter((t) => t.kind === "field")
						.map((t) => (
							<NativeSelectOption key={t.id} value={t.id}>
								{t.label}
							</NativeSelectOption>
						))}
				</NativeSelectOptGroup>
				{targets.some((t) => t.kind === "variable") && (
					<NativeSelectOptGroup label="Computed variables">
						{targets
							.filter((t) => t.kind === "variable")
							.map((t) => (
								<NativeSelectOption key={t.id} value={t.id}>
									{t.label}
								</NativeSelectOption>
							))}
					</NativeSelectOptGroup>
				)}
			</NativeSelect>
			<Button
				aria-label="Remove parameter"
				onClick={onRemove}
				size="icon-sm"
				type="button"
				variant="ghost"
			>
				<Trash2Icon />
			</Button>
		</div>
	);
}

/**
 * Builds `FormSettings.redirectUrl` (a base URL plus mention-valued query
 * parameters) without changing the stored format: it's still the single
 * OpnForm-compatible string, just edited through a structured UI instead of
 * raw text. An "Advanced" toggle switches to the raw editor for full control
 * (literal text mixed with mentions, mentions inside the base URL itself).
 */
export function RedirectBuilder() {
	const { patch, readOnly, state } = useEditor();
	const { settings } = state;
	const targets = useTargets();
	const [advanced, setAdvanced] = useState(false);

	const config = useMemo(
		() => parseRedirectUrl(settings.redirectUrl ?? ""),
		[settings.redirectUrl]
	);
	// Stable per-row keys: re-derived whenever the parsed param list changes
	// shape, but never from the row's position in the array.
	const paramKeys = useMemo(
		() => config.params.map(() => nanoid(8)),
		[config.params]
	);

	const extraSettings = settings.settings as {
		redirectOpenInNewTab?: boolean;
		redirectKeepEmptyParams?: boolean;
	};

	function save(nextConfig: typeof config) {
		patch({ redirectUrl: buildRedirectUrl(nextConfig) || null });
	}

	function insertAtEnd(target: Target) {
		save({
			...config,
			baseUrl: insertIntoBaseUrl(
				config.baseUrl,
				fieldParamValue({ id: target.id, name: target.label })
			),
		});
	}

	const fields = settings.properties as FormField[];
	const preview = useMemo(() => {
		if (!settings.redirectUrl) {
			return null;
		}
		const exampleValues: Record<string, unknown> = {};
		for (const field of fields) {
			exampleValues[field.id] = exampleFieldValue(field);
		}
		const computed = evaluateComputedVariables(
			settings.computedVariables as ComputedVariable[],
			exampleValues
		);
		return resolveRedirectUrl(settings.redirectUrl, exampleValues, {
			computed,
			dropEmptyParams: !extraSettings.redirectKeepEmptyParams,
		});
	}, [
		settings.redirectUrl,
		settings.computedVariables,
		fields,
		extraSettings.redirectKeepEmptyParams,
	]);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<FieldLabel htmlFor="redirect-advanced-toggle">
					Advanced: edit the raw URL
				</FieldLabel>
				<Switch
					checked={advanced}
					disabled={readOnly}
					id="redirect-advanced-toggle"
					onCheckedChange={(checked) => setAdvanced(checked)}
				/>
			</div>
			{advanced ? (
				<Field>
					<FieldLabel htmlFor="redirect-raw">Redirect URL</FieldLabel>
					<RichTextEditor
						mentions={targets.map((t) => ({ id: t.id, label: t.label }))}
						onChange={(html) => patch({ redirectUrl: html || null })}
						placeholder="https://example.com/thanks?name={Name}"
						singleLine
						toolbar="basic"
						value={settings.redirectUrl ?? ""}
					/>
					<FieldDescription>
						Type the full URL by hand. Press "@" or use the field button in the
						toolbar to insert an answer anywhere, including inside the path or
						domain.
					</FieldDescription>
				</Field>
			) : (
				<>
					<Field>
						<div className="flex items-center justify-between gap-2">
							<FieldLabel htmlFor="redirect-base-url">Base URL</FieldLabel>
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button
											disabled={readOnly || targets.length === 0}
											size="sm"
											type="button"
											variant="ghost"
										/>
									}
								>
									<AtSignIcon /> Insert field
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="max-h-72 overflow-y-auto"
								>
									{targets.map((t) => (
										<DropdownMenuItem key={t.id} onClick={() => insertAtEnd(t)}>
											{t.label}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
						<RichTextEditor
							aria-label="Base URL"
							mentions={targets.map((t) => ({ id: t.id, label: t.label }))}
							onChange={(html) => save({ ...config, baseUrl: html })}
							placeholder="https://example.com/thanks"
							singleLine
							toolbar="none"
							value={config.baseUrl}
						/>
						<FieldDescription>
							The page to send respondents to. Type "@" to insert an answer
							anywhere in it (e.g. a subdomain or path segment).
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>Pass answers as URL parameters</FieldLabel>
						<FieldDescription>
							Each row adds "?name=value" to the base URL above, filled in with
							the chosen field's answer at submit time.
						</FieldDescription>
						<div className="flex flex-col gap-2">
							{config.params.map((param, index) => (
								<ParamRow
									key={paramKeys[index]}
									onChange={(next) => {
										const params = [...config.params];
										params[index] = next;
										save({ ...config, params });
									}}
									onRemove={() =>
										save({
											...config,
											params: config.params.filter((_, i) => i !== index),
										})
									}
									param={param}
									targets={targets}
								/>
							))}
						</div>
						<Button
							disabled={readOnly}
							onClick={() =>
								save({
									...config,
									params: [...config.params, { name: "", value: "" }],
								})
							}
							size="sm"
							type="button"
							variant="outline"
						>
							<PlusIcon /> Add parameter
						</Button>
					</Field>
				</>
			)}
			<Field orientation="horizontal">
				<div className="flex flex-1 flex-col">
					<FieldLabel htmlFor="redirect-new-tab">Open in a new tab</FieldLabel>
					<FieldDescription>
						Keeps your form's success screen open and opens the redirect in a
						separate tab, instead of navigating away.
					</FieldDescription>
				</div>
				<Switch
					checked={Boolean(extraSettings.redirectOpenInNewTab)}
					disabled={readOnly}
					id="redirect-new-tab"
					onCheckedChange={(checked) =>
						patch({
							settings: {
								...settings.settings,
								redirectOpenInNewTab: checked,
							},
						})
					}
				/>
			</Field>
			<Field orientation="horizontal">
				<div className="flex flex-1 flex-col">
					<FieldLabel htmlFor="redirect-keep-empty">
						Keep empty parameters
					</FieldLabel>
					<FieldDescription>
						When a field was left blank, still include it as "name=" instead of
						dropping it from the URL.
					</FieldDescription>
				</div>
				<Switch
					checked={Boolean(extraSettings.redirectKeepEmptyParams)}
					disabled={readOnly}
					id="redirect-keep-empty"
					onCheckedChange={(checked) =>
						patch({
							settings: {
								...settings.settings,
								redirectKeepEmptyParams: checked,
							},
						})
					}
				/>
			</Field>
			{preview ? (
				<div className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-2.5">
					<span className="font-medium text-muted-foreground text-xs">
						Preview with example answers
					</span>
					<code className="break-all text-xs">{preview}</code>
				</div>
			) : null}
		</div>
	);
}
