import { parseCliArgs } from "../args";

import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { fail, printJson, printTable } from "../output";

function baseFlags(argv: string[]) {
	return parseCliArgs(argv, {
		json: { type: "boolean" },
		token: { type: "string" },
		url: { type: "string" },
		workspace: { type: "string" },
	});
}

export async function sendersCommand(argv: string[]): Promise<void> {
	const [sub, ...rest] = argv;
	if (sub !== "list") {
		fail(`Unknown "senders" subcommand "${sub ?? ""}". Try: list`, false);
	}
	const { values } = baseFlags(rest);
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}
	if (!values.workspace) {
		fail("Usage: stryveforms senders list --workspace <id>", json);
	}
	const { instance } = createClient(url, token);
	try {
		const senders = await instance.agent.data.senders.list.query({
			workspaceId: values.workspace,
		});
		if (json) {
			printJson(senders);
			return;
		}
		printTable(senders, [
			{ key: "id", label: "ID" },
			{ key: "name", label: "NAME" },
			{ key: "address", label: "ADDRESS" },
			{ key: "replyTo", label: "REPLY-TO" },
		]);
	} catch (error) {
		fail(describeError(error), json);
	}
}
