/**
 * Pure argument-parsing coverage for `export`/`backup`. The commands
 * themselves need a signed-in session and a live server, so this only
 * covers the flag wiring — safe to run in CI without a server.
 */
import { describe, expect, test } from "bun:test";

import { parseBackupArgs } from "../commands/backup";
import { parseExportArgs } from "../commands/export";

describe("parseExportArgs", () => {
	test("reads --workspace, --no-uploads, --include-secrets, --passphrase-env, --out, --json", () => {
		const { values } = parseExportArgs([
			"--workspace",
			"ws_1",
			"--no-uploads",
			"--include-secrets",
			"--passphrase-env",
			"MY_PASSPHRASE",
			"--out",
			"export.zip",
			"--json",
		]);
		expect(values.workspace).toBe("ws_1");
		expect(values["no-uploads"]).toBe(true);
		expect(values["include-secrets"]).toBe(true);
		expect(values["passphrase-env"]).toBe("MY_PASSPHRASE");
		expect(values.out).toBe("export.zip");
		expect(values.json).toBe(true);
	});

	test("every flag is optional — an empty invocation parses cleanly", () => {
		const { values } = parseExportArgs([]);
		expect(values.workspace).toBeUndefined();
		expect(values["no-uploads"]).toBeUndefined();
		expect(values["include-secrets"]).toBeUndefined();
	});

	test("a workspace id starting with a dash survives (dash-safe option joining)", () => {
		const { values } = parseExportArgs(["--workspace", "-Y43O4uuCO"]);
		expect(values.workspace).toBe("-Y43O4uuCO");
	});
});

describe("parseBackupArgs", () => {
	test("reads --destination, --out, --passphrase-env, --json", () => {
		const { values } = parseBackupArgs([
			"--destination",
			"dest_1",
			"--out",
			"backup.stryve-backup",
			"--passphrase-env",
			"BACKUP_PASSPHRASE",
			"--json",
		]);
		expect(values.destination).toBe("dest_1");
		expect(values.out).toBe("backup.stryve-backup");
		expect(values["passphrase-env"]).toBe("BACKUP_PASSPHRASE");
		expect(values.json).toBe(true);
	});

	test("every flag is optional — an empty invocation parses cleanly", () => {
		const { values } = parseBackupArgs([]);
		expect(values.destination).toBeUndefined();
		expect(values.out).toBeUndefined();
	});
});
