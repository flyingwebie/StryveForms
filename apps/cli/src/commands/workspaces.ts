import { parseCliArgs } from "../args";

import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { fail, printJson, printTable } from "../output";

function baseFlags(argv: string[]) {
	return parseCliArgs(argv, {
		json: { type: "boolean" },
		token: { type: "string" },
		url: { type: "string" },
	});
}

export async function workspacesCommand(argv: string[]): Promise<void> {
	const [sub, ...rest] = argv;
	if (sub !== "list") {
		fail(`Unknown "workspaces" subcommand "${sub ?? ""}". Try: list`, false);
	}
	const { values } = baseFlags(rest);
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}
	const client = createClient(url, token);
	try {
		const workspaces = await client.instance.agent.data.workspaces.list.query();
		if (json) {
			printJson(workspaces);
		} else {
			printTable(workspaces, [
				{ key: "id", label: "ID" },
				{ key: "name", label: "NAME" },
				{ key: "role", label: "ROLE" },
			]);
		}
	} catch (error) {
		fail(describeError(error), json);
	}
}
