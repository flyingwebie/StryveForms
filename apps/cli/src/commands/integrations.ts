import { parseCliArgs } from "../args";

import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { readJsonFile } from "../json-file";
import { fail, printJson, printLine, printTable } from "../output";
import { requireStatus } from "../status";

type AgentData = ReturnType<typeof createClient>["instance"]["agent"]["data"];

/** `--file`'s shape for `create`/`update`/`test`: everything `create_integration`/`update_integration` accepts besides `formId`/`id`/`integrationId`/`status`, which have their own flags. */
interface IntegrationSpecFile {
	data?: Record<string, unknown>;
	logic?: Record<string, unknown> | null;
	settings?: Record<string, unknown>;
}

function readSpecFile(path: string | undefined): IntegrationSpecFile {
	if (!path) {
		return {};
	}
	return readJsonFile(path) as IntegrationSpecFile;
}

export function parseIntegrationsArgs(rest: string[]) {
	return parseCliArgs(rest, {
		file: { type: "string" },
		form: { type: "string" },
		id: { type: "string" },
		json: { type: "boolean" },
		status: { type: "string" },
		token: { type: "string" },
		type: { type: "string" },
		url: { type: "string" },
	});
}

type Values = ReturnType<typeof parseIntegrationsArgs>["values"];

async function listIntegrations(
	data: AgentData,
	values: Values,
	json: boolean
) {
	if (!values.form) {
		fail("Usage: stryveforms integrations list --form <formId>", json);
	}
	const integrations = await data.integrations.list.query({
		formId: values.form,
	});
	if (json) {
		printJson(integrations);
		return;
	}
	printTable(integrations, [
		{ key: "id", label: "ID" },
		{ key: "integrationId", label: "TYPE" },
		{ key: "name", label: "NAME" },
		{ key: "status", label: "STATUS" },
	]);
}

async function listTypes(data: AgentData, json: boolean) {
	const types = await data.integrations.types.query({});
	if (json) {
		printJson(types);
		return;
	}
	for (const type of types) {
		printLine(`${type.id} (${type.name}, ${type.section})`);
		for (const field of type.dataFields) {
			printLine(`  data.${field.key}: ${field.type} — ${field.description}`);
		}
		for (const field of type.settingsFields) {
			printLine(
				`  settings.${field.key}: ${field.type} — ${field.description}`
			);
		}
	}
}

async function createIntegration(
	data: AgentData,
	values: Values,
	json: boolean
) {
	if (!(values.form && values.type)) {
		fail(
			"Usage: stryveforms integrations create --form <formId> --type <integrationId> [--file spec.json] [--status active|inactive]",
			json
		);
	}
	const spec = readSpecFile(values.file);
	const created = await data.integrations.create.mutate({
		data: spec.data ?? {},
		formId: values.form,
		integrationId: values.type as never,
		logic: spec.logic,
		settings: spec.settings ?? {},
		status: requireStatus(values.status, json) ?? "active",
	});
	if (json) {
		printJson(created);
		return;
	}
	printLine(
		`Created ${values.type} integration ${created.id} on form ${values.form}.`
	);
}

async function updateIntegration(
	data: AgentData,
	positionalId: string | undefined,
	values: Values,
	json: boolean
) {
	const id = positionalId ?? values.id;
	if (!(id && values.form)) {
		fail(
			"Usage: stryveforms integrations update <id> --form <formId> [--file patch.json] [--status active|inactive]\n" +
				'(an id starting with "-" needs --id <id> instead of the positional form)',
			json
		);
	}
	const spec = readSpecFile(values.file);
	const status = requireStatus(values.status, json);
	const result = await data.integrations.update.mutate({
		formId: values.form,
		id,
		...spec,
		...(status ? { status } : {}),
	});
	if (json) {
		printJson(result);
		return;
	}
	printLine(`Updated integration ${id}.`);
}

async function deleteIntegration(
	data: AgentData,
	positionalId: string | undefined,
	values: Values,
	json: boolean
) {
	const id = positionalId ?? values.id;
	if (!(id && values.form)) {
		fail(
			"Usage: stryveforms integrations delete <id> --form <formId>\n" +
				'(an id starting with "-" needs --id <id> instead of the positional form)',
			json
		);
	}
	const result = await data.integrations.delete.mutate({
		formId: values.form,
		id,
	});
	if (json) {
		printJson(result);
		return;
	}
	printLine(`Deleted integration ${id}.`);
}

async function testIntegration(data: AgentData, values: Values, json: boolean) {
	if (!values.form) {
		fail(
			"Usage: stryveforms integrations test --form <formId> (--id <id> | --type <integrationId>) [--file spec.json]",
			json
		);
	}
	if (!(values.id || values.type)) {
		fail("Pass --id <existing integration id> or --type <integrationId>", json);
	}
	const spec = readSpecFile(values.file);
	const result = await data.integrations.test.mutate({
		data: spec.data,
		formId: values.form,
		id: values.id,
		integrationId: values.type as never,
		settings: spec.settings,
	});
	if (json) {
		printJson(result);
		return;
	}
	printLine(
		result.ok
			? `Test send succeeded${result.status ? ` (HTTP ${result.status})` : ""}.`
			: `Test send failed: ${result.error}`
	);
}

export async function integrationsCommand(argv: string[]): Promise<void> {
	const [sub, ...rest] = argv;
	const { values, positionals } = parseIntegrationsArgs(rest);
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}
	const { instance } = createClient(url, token);
	const { data } = instance.agent;
	const [id] = positionals;

	try {
		switch (sub) {
			case "types":
				await listTypes(data, json);
				return;
			case "list":
				await listIntegrations(data, values, json);
				return;
			case "create":
				await createIntegration(data, values, json);
				return;
			case "update":
				await updateIntegration(data, id, values, json);
				return;
			case "delete":
				await deleteIntegration(data, id, values, json);
				return;
			case "test":
				await testIntegration(data, values, json);
				return;
			default:
				fail(
					`Unknown "integrations" subcommand "${sub ?? ""}". Try: types, list, create, update, delete, test`,
					json
				);
		}
	} catch (error) {
		fail(describeError(error), json);
	}
}
