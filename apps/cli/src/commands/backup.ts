import { parseCliArgs } from "../args";
import { downloadBackupJobFile, waitForBackupJob } from "../backup-job";
import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { fail, printJson, printLine } from "../output";

export function parseBackupArgs(argv: string[]) {
	return parseCliArgs(argv, {
		destination: { type: "string" },
		json: { type: "boolean" },
		out: { type: "string" },
		"passphrase-env": { type: "string" },
		token: { type: "string" },
		url: { type: "string" },
	});
}

/** Picks `--destination`, else the schedule's default, else the only/first configured one. */
async function resolveDestinationId(
	client: ReturnType<typeof createClient>,
	given: string | undefined
): Promise<string | null> {
	if (given) {
		return given;
	}
	const schedule = await client.backupAdmin.schedule.get.query();
	if (schedule.schedule.destinationId) {
		return schedule.schedule.destinationId;
	}
	const destinations = await client.backupAdmin.destinations.list.query();
	return destinations[0]?.id ?? null;
}

/** `stryveforms backup [--destination <id>|--out file] [--passphrase-env VAR]` (instance admin) */
export async function backupCommand(argv: string[]): Promise<void> {
	const { values } = parseBackupArgs(argv);
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}

	const envVar = values["passphrase-env"];
	const passphrase = envVar ? process.env[envVar] : undefined;
	if (envVar && !passphrase) {
		fail(`Environment variable ${envVar} is not set`, json);
	}

	const client = createClient(url, token);
	try {
		const destinationId = await resolveDestinationId(
			client,
			values.destination
		);
		if (!destinationId) {
			fail(
				"No destination given and none configured. Pass --destination <id>, or add one in Admin → Backups first.",
				json
			);
		}

		if (!json) {
			printLine(`Starting a full instance backup to ${destinationId}…`);
		}
		const { jobId } = await client.backupAdmin.backupNow.mutate({
			destinationId,
			passphrase,
		});

		const job = await waitForBackupJob(
			() => client.backupAdmin.job.query({ id: jobId }),
			(current) => {
				if (!json) {
					printLine(`  ${current.status}…`);
				}
			}
		);

		let savedTo: string | null = null;
		if (values.out && job.fileKey) {
			await downloadBackupJobFile(url, token, jobId, values.out);
			savedTo = values.out;
		}

		if (json) {
			printJson({ destinationId, jobId, savedTo, status: job.status });
		} else {
			printLine(
				`Backup complete.${savedTo ? ` Saved a local copy to ${savedTo}` : ""}`
			);
		}
	} catch (error) {
		fail(describeError(error), json);
	}
}
