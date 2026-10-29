import { parseArgs } from "node:util";

import { clearConfig } from "../config";
import { printJson, printLine } from "../output";

export function logoutCommand(argv: string[]): void {
	const { values } = parseArgs({
		args: argv,
		options: { json: { type: "boolean" } },
	});
	clearConfig();
	if (values.json) {
		printJson({ ok: true });
	} else {
		printLine("Signed out.");
	}
}
