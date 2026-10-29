import { parseCliArgs } from "../args";

import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { readJsonFile } from "../json-file";
import { fail, printJson, printLine, printTable } from "../output";
import { requireStatus } from "../status";

type AgentData = ReturnType<typeof createClient>["instance"]["agent"]["data"];

/** `--file`'s shape for `create`/`update`: the notification's `data` (recipients, subject, body…) plus an optional condition. */
interface NotificationSpecFile {
	data?: Record<string, unknown>;
	logic?: Record<string, unknown> | null;
}

function readSpecFile(path: string | undefined): NotificationSpecFile {
	if (!path) {
		return {};
	}
	return readJsonFile(path) as NotificationSpecFile;
}

/** `preview`/`test`'s `--file` is just the plain `data` object (no wrapper). */
function readDataFile(path: string | undefined): Record<string, unknown> {
	if (!path) {
		return {};
	}
	return readJsonFile(path) as Record<string, unknown>;
}

export function parseNotificationsArgs(rest: string[]) {
	return parseCliArgs(rest, {
		dark: { type: "boolean" },
		file: { type: "string" },
		form: { type: "string" },
		id: { type: "string" },
		json: { type: "boolean" },
		status: { type: "string" },
		to: { type: "string" },
		token: { type: "string" },
		url: { type: "string" },
	});
}

type Values = ReturnType<typeof parseNotificationsArgs>["values"];

async function listNotifications(
	data: AgentData,
	values: Values,
	json: boolean
) {
	if (!values.form) {
		fail("Usage: stryveforms notifications list --form <formId>", json);
	}
	const notifications = await data.notifications.list.query({
		formId: values.form,
	});
	if (json) {
		printJson(notifications);
		return;
	}
	printTable(
		notifications.map((n) => ({
			id: n.id,
			sendTo: String((n.data as { send_to?: string }).send_to ?? ""),
			status: n.status,
			subject: String((n.data as { subject?: string }).subject ?? ""),
		})),
		[
			{ key: "id", label: "ID" },
			{ key: "status", label: "STATUS" },
			{ key: "subject", label: "SUBJECT" },
			{ key: "sendTo", label: "SEND TO" },
		]
	);
}

async function createNotification(
	data: AgentData,
	values: Values,
	json: boolean
) {
	if (!values.form) {
		fail(
			"Usage: stryveforms notifications create --form <formId> --file notification.json [--status active|inactive]",
			json
		);
	}
	const spec = readSpecFile(values.file);
	const created = await data.notifications.create.mutate({
		data: spec.data ?? {},
		formId: values.form,
		logic: spec.logic,
		status: requireStatus(values.status, json) ?? "active",
	});
	if (json) {
		printJson(created);
		return;
	}
	printLine(`Created email notification ${created.id} on form ${values.form}.`);
}

async function updateNotification(
	data: AgentData,
	positionalId: string | undefined,
	values: Values,
	json: boolean
) {
	const id = positionalId ?? values.id;
	if (!(id && values.form)) {
		fail(
			"Usage: stryveforms notifications update <id> --form <formId> [--file notification.json] [--status active|inactive]\n" +
				'(an id starting with "-" needs --id <id> instead of the positional form)',
			json
		);
	}
	const spec = readSpecFile(values.file);
	const status = requireStatus(values.status, json);
	const result = await data.notifications.update.mutate({
		formId: values.form,
		id,
		...spec,
		...(status ? { status } : {}),
	});
	if (json) {
		printJson(result);
		return;
	}
	printLine(`Updated email notification ${id}.`);
}

async function deleteNotification(
	data: AgentData,
	positionalId: string | undefined,
	values: Values,
	json: boolean
) {
	const id = positionalId ?? values.id;
	if (!(id && values.form)) {
		fail(
			"Usage: stryveforms notifications delete <id> --form <formId>\n" +
				'(an id starting with "-" needs --id <id> instead of the positional form)',
			json
		);
	}
	const result = await data.notifications.delete.mutate({
		formId: values.form,
		id,
	});
	if (json) {
		printJson(result);
		return;
	}
	printLine(`Deleted email notification ${id}.`);
}

async function previewNotification(
	data: AgentData,
	values: Values,
	json: boolean
) {
	if (!values.form) {
		fail(
			"Usage: stryveforms notifications preview --form <formId> --file data.json [--dark]",
			json
		);
	}
	const draft = readDataFile(values.file);
	const preview = await data.notifications.preview.query({
		colorScheme: values.dark ? "dark" : undefined,
		data: draft,
		formId: values.form,
	});
	if (json) {
		printJson(preview);
		return;
	}
	printLine(`Subject: ${preview.subject}`);
	printLine(
		`From: ${preview.fromAddress ?? "(default)"} (${preview.senderName})`
	);
	printLine(`To: ${preview.recipients.join(", ") || "(no valid recipients)"}`);
	printLine(`Preview: ${preview.preheader}`);
}

async function testNotification(
	data: AgentData,
	values: Values,
	json: boolean
) {
	if (!values.form) {
		fail(
			"Usage: stryveforms notifications test --form <formId> --file data.json [--to email]",
			json
		);
	}
	const draft = readDataFile(values.file);
	const result = await data.notifications.sendTest.mutate({
		data: draft,
		formId: values.form,
		to: values.to,
	});
	if (json) {
		printJson(result);
		return;
	}
	printLine(
		result.loggedOnly
			? `SMTP isn't configured — the test email was logged on the server instead of being delivered (would have gone to ${result.to}).`
			: `Test email sent to ${result.to}.`
	);
}

export async function notificationsCommand(argv: string[]): Promise<void> {
	const [sub, ...rest] = argv;
	const { values, positionals } = parseNotificationsArgs(rest);
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
			case "list":
				await listNotifications(data, values, json);
				return;
			case "create":
				await createNotification(data, values, json);
				return;
			case "update":
				await updateNotification(data, id, values, json);
				return;
			case "delete":
				await deleteNotification(data, id, values, json);
				return;
			case "preview":
				await previewNotification(data, values, json);
				return;
			case "test":
				await testNotification(data, values, json);
				return;
			default:
				fail(
					`Unknown "notifications" subcommand "${sub ?? ""}". Try: list, create, update, delete, preview, test`,
					json
				);
		}
	} catch (error) {
		fail(describeError(error), json);
	}
}
