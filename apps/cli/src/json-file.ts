/**
 * Reads and JSON-parses a file for a command's `--file`/`--fields-file`/
 * etc. flag. Throws a plain `Error` with a readable message instead of
 * calling `fail()` itself (which exits the process) — every caller decides
 * how to report it (human stderr line, or a `--json` error document), and
 * this stays a pure, testable function.
 */
import { readFileSync } from "node:fs";

export function readJsonFile(path: string): unknown {
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (error) {
		throw new Error(
			`Couldn't read ${path}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error }
		);
	}
	try {
		return JSON.parse(raw);
	} catch (error) {
		throw new Error(
			`Couldn't parse ${path} as JSON: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error }
		);
	}
}
