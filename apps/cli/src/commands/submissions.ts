import { idArg, parseCliArgs } from "../args";

import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { fail, printJson, printLine, printTable } from "../output";

function parseSubmissionsArgs(rest: string[]) {
	return parseCliArgs(rest, {
		days: { type: "string" },
		form: { type: "string" },
		from: { type: "string" },
		id: { type: "string" },
		json: { type: "boolean" },
		page: { type: "string" },
		search: { type: "string" },
		status: { type: "string" },
		to: { type: "string" },
		token: { type: "string" },
		url: { type: "string" },
	});
}

export async function submissionsCommand(argv: string[]): Promise<void> {
	const [sub, ...rest] = argv;
	const { values, positionals } = parseSubmissionsArgs(rest);
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}
	if (!values.form) {
		fail("--form <formId> is required", json);
	}
	const { instance } = createClient(url, token);
	const { data } = instance.agent;

	try {
		switch (sub) {
			case "list": {
				const status =
					values.status === "completed" || values.status === "partial"
						? values.status
						: "all";
				const result = await data.submissions.list.query({
					formId: values.form,
					from: values.from,
					page: values.page ? Number(values.page) : undefined,
					search: values.search,
					status,
					to: values.to,
				});
				if (json) {
					printJson(result);
					return;
				}
				printLine(`${result.total} total, page ${result.page}`);
				printTable(
					result.items.map((item) => ({
						createdAt: item.createdAt.slice(0, 10),
						id: item.id,
						status: item.status,
					})),
					[
						{ key: "id", label: "ID" },
						{ key: "status", label: "STATUS" },
						{ key: "createdAt", label: "CREATED" },
					]
				);
				return;
			}
			case "get": {
				const submissionId = idArg(values.id, positionals);
				if (!submissionId) {
					fail(
						"Usage: stryveforms submissions get --form <formId> <submissionId>  (or --id <submissionId>)",
						json
					);
				}
				const submission = await data.submissions.get.query({
					formId: values.form,
					id: submissionId,
				});
				printJson(submission);
				return;
			}
			case "export": {
				const status =
					values.status === "completed" || values.status === "partial"
						? values.status
						: "all";
				const link = await data.submissions.exportLink.query({
					formId: values.form,
					from: values.from,
					search: values.search,
					status,
					to: values.to,
				});
				if (json) {
					printJson(link);
				} else {
					printLine(link.url);
				}
				return;
			}
			default:
				fail(
					`Unknown "submissions" subcommand "${sub ?? ""}". Try: list, get, export`,
					json
				);
		}
	} catch (error) {
		fail(describeError(error), json);
	}
}
