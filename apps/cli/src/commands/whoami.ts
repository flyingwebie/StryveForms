import { parseArgs } from "node:util";

import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { fail, printJson, printLine } from "../output";

export async function whoamiCommand(argv: string[]): Promise<void> {
	const { values } = parseArgs({
		args: argv,
		options: {
			json: { type: "boolean" },
			token: { type: "string" },
			url: { type: "string" },
		},
	});
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}
	const client = createClient(url, token);
	try {
		const user = await client.me.query();
		if (json) {
			printJson({ ...user, serverUrl: url });
		} else {
			printLine(`${user.name} <${user.email}>`);
			printLine(`Server: ${url}`);
			printLine(`Admin: ${user.isAdmin ? "yes" : "no"}`);
		}
	} catch (error) {
		fail(describeError(error), json);
	}
}
