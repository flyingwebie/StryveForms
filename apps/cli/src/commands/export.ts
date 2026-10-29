import { parseCliArgs } from "../args";
import { downloadBackupJobFile, waitForBackupJob } from "../backup-job";
import { createClient, describeError } from "../client";
import { resolveToken, resolveUrl } from "../config";
import { fail, printJson, printLine } from "../output";

export function parseExportArgs(argv: string[]) {
	return parseCliArgs(argv, {
		"include-secrets": { type: "boolean" },
		json: { type: "boolean" },
		"no-uploads": { type: "boolean" },
		out: { type: "string" },
		"passphrase-env": { type: "string" },
		token: { type: "string" },
		url: { type: "string" },
		workspace: { type: "string" },
	});
}

/** `stryveforms export --workspace <id> [--no-uploads] [--include-secrets] [--passphrase-env VAR] [--out file]` */
export async function exportCommand(argv: string[]): Promise<void> {
	const { values } = parseExportArgs(argv);
	const json = Boolean(values.json);
	const url = resolveUrl(values.url);
	const token = resolveToken(values.token);
	if (!token) {
		fail("Not signed in. Run `stryveforms login` first.", json);
	}
	if (!values.workspace) {
		fail("--workspace <id> is required", json);
	}

	let passphrase: string | undefined;
	if (values["include-secrets"]) {
		const envVar = values["passphrase-env"];
		if (!envVar) {
			fail(
				"--include-secrets needs --passphrase-env <VAR> naming an environment variable holding the passphrase",
				json
			);
		}
		passphrase = process.env[envVar];
		if (!passphrase) {
			fail(`Environment variable ${envVar} is not set`, json);
		}
	}

	const client = createClient(url, token);
	try {
		if (!json) {
			printLine(`Starting export of workspace ${values.workspace}…`);
		}
		const { jobId } = await client.backup.exportWorkspace.mutate({
			includeUploads: !values["no-uploads"],
			passphrase,
			workspaceId: values.workspace,
		});

		const job = await waitForBackupJob(
			() => client.backup.job.query({ id: jobId }),
			(current) => {
				if (!json) {
					printLine(`  ${current.status}…`);
				}
			}
		);

		let savedTo: string | null = null;
		if (job.fileKey) {
			const outPath = values.out || job.fileName || `${jobId}.stryve.zip`;
			await downloadBackupJobFile(url, token, jobId, outPath);
			savedTo = outPath;
		}

		if (json) {
			printJson({ jobId, savedTo, status: job.status });
		} else {
			printLine(`Export complete.${savedTo ? ` Saved to ${savedTo}` : ""}`);
		}
	} catch (error) {
		fail(describeError(error), json);
	}
}
