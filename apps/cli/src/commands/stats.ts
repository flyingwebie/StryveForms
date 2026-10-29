import { idArg, parseCliArgs } from "../args";

import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { fail, printJson, printLine } from "../output";

export async function statsCommand(argv: string[]): Promise<void> {
	const { values, positionals } = parseCliArgs(argv, {
		days: { type: "string" },
		form: { type: "string" },
		json: { type: "boolean" },
		token: { type: "string" },
		url: { type: "string" },
	});
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}
	// `--form` also accepts ids that start with "-".
	const formId = idArg(values.form, positionals);
	if (!formId) {
		fail(
			"Usage: stryveforms stats <formId> [--days N]  (or --form <formId>)",
			json
		);
	}
	const { instance } = createClient(url, token);
	try {
		const stats = await instance.agent.data.submissions.stats.query({
			days: values.days ? Number(values.days) : undefined,
			formId,
		});
		if (json) {
			printJson(stats);
			return;
		}
		printLine(`Views: ${stats.views}`);
		printLine(`Submissions: ${stats.submissions}`);
		printLine(`Completion rate: ${stats.completionRate}%`);
	} catch (error) {
		fail(describeError(error), json);
	}
}
