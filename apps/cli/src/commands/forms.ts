import { readFileSync } from "node:fs";
import { idArg, parseCliArgs } from "../args";

import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { fail, printJson, printLine, printTable } from "../output";

type FormsData = ReturnType<typeof createClient>["instance"]["agent"]["data"];

function readJsonFile(path: string, json: boolean): unknown {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		fail(
			`Couldn't read/parse ${path}: ${error instanceof Error ? error.message : String(error)}`,
			json
		);
	}
}

function parseFormsArgs(rest: string[]) {
	return parseCliArgs(rest, {
		"fields-file": { type: "string" },
		file: { type: "string" },
		id: { type: "string" },
		json: { type: "boolean" },
		query: { type: "string" },
		"settings-file": { type: "string" },
		title: { type: "string" },
		token: { type: "string" },
		url: { type: "string" },
		workspace: { type: "string" },
	});
}

async function listForms(
	data: FormsData,
	values: ReturnType<typeof parseFormsArgs>["values"],
	json: boolean
) {
	if (!values.workspace) {
		fail("--workspace <id> is required", json);
	}
	const forms = await data.forms.list.query({
		query: values.query,
		workspaceId: values.workspace,
	});
	if (json) {
		printJson(forms);
		return;
	}
	printTable(
		forms.map((f) => ({ ...f, updatedAt: f.updatedAt.slice(0, 10) })),
		[
			{ key: "id", label: "ID" },
			{ key: "title", label: "TITLE" },
			{ key: "visibility", label: "VISIBILITY" },
			{ key: "submissionsCount", label: "SUBMISSIONS" },
			{ key: "updatedAt", label: "UPDATED" },
		]
	);
}

async function getForm(
	data: FormsData,
	formId: string | undefined,
	json: boolean
) {
	if (!formId) {
		fail("Usage: stryveforms forms get <formId>  (or --id <formId>)", json);
	}
	const form = await data.forms.get.query({ formId });
	if (json) {
		printJson(form);
		return;
	}
	printLine(`${form.title} (${form.visibility})`);
	printLine(`Share: ${form.shareUrl}`);
	printLine(`Fields: ${form.fields.length}`);
	for (const field of form.fields) {
		printLine(
			`  - ${field.name} [${field.type}]${field.required ? " required" : ""}`
		);
	}
}

async function createForm(
	data: FormsData,
	values: ReturnType<typeof parseFormsArgs>["values"],
	json: boolean
) {
	if (!(values.workspace && values.title && values.file)) {
		fail(
			"Usage: stryveforms forms create --workspace <id> --title <title> --file <spec.json>",
			json
		);
	}
	const spec = readJsonFile(values.file, json) as { fields: unknown };
	const created = await data.forms.create.mutate({
		fields: spec.fields as never,
		title: values.title,
		workspaceId: values.workspace,
	});
	if (json) {
		printJson(created);
		return;
	}
	printLine(`Created "${created.title}" (${created.id}), draft.`);
	printLine(`Edit: ${created.editorUrl}`);
}

async function updateForm(
	data: FormsData,
	formId: string | undefined,
	values: ReturnType<typeof parseFormsArgs>["values"],
	json: boolean
) {
	if (!formId) {
		fail(
			"Usage: stryveforms forms update <formId> [--fields-file f.json] [--settings-file s.json]",
			json
		);
	}
	if (!(values["fields-file"] || values["settings-file"])) {
		fail("Pass --fields-file and/or --settings-file", json);
	}
	const results: unknown[] = [];
	if (values["fields-file"]) {
		const spec = readJsonFile(values["fields-file"], json) as {
			fields: unknown;
		};
		results.push(
			await data.forms.updateFields.mutate({
				fields: spec.fields as never,
				formId,
			})
		);
	}
	if (values["settings-file"]) {
		const patch = readJsonFile(values["settings-file"], json);
		results.push(
			await data.forms.updateSettings.mutate({ formId, ...(patch as object) })
		);
	}
	if (json) {
		printJson({ formId, results });
		return;
	}
	printLine(`Updated form ${formId}.`);
}

const VISIBILITY_BY_SUBCOMMAND = {
	close: "closed",
	publish: "public",
	unpublish: "draft",
} as const;

async function setVisibility(
	data: FormsData,
	sub: keyof typeof VISIBILITY_BY_SUBCOMMAND,
	formId: string | undefined,
	json: boolean
) {
	if (!formId) {
		fail(`Usage: stryveforms forms ${sub} <formId>  (or --id <formId>)`, json);
	}
	const result = await data.forms.setVisibility.mutate({
		formId,
		visibility: VISIBILITY_BY_SUBCOMMAND[sub],
	});
	if (json) {
		printJson(result);
		return;
	}
	printLine(`Form ${formId} is now ${result.visibility}.`);
}

export async function formsCommand(argv: string[]): Promise<void> {
	const [sub, ...rest] = argv;
	const { values, positionals } = parseFormsArgs(rest);
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}
	const { instance } = createClient(url, token);
	const { data } = instance.agent;
	// `--id` also accepts ids that start with "-".
	const formId = idArg(values.id, positionals);

	try {
		switch (sub) {
			case "list":
				await listForms(data, values, json);
				return;
			case "get":
				await getForm(data, formId, json);
				return;
			case "create":
				await createForm(data, values, json);
				return;
			case "update":
				await updateForm(data, formId, values, json);
				return;
			case "publish":
			case "unpublish":
			case "close":
				await setVisibility(data, sub, formId, json);
				return;
			default:
				fail(
					`Unknown "forms" subcommand "${sub ?? ""}". Try: list, get, create, update, publish, unpublish, close`,
					json
				);
		}
	} catch (error) {
		fail(describeError(error), json);
	}
}
