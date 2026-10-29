/**
 * Output helpers shared by every command: `--json` always prints one
 * machine-readable JSON document to stdout and nothing else (agents should
 * pass this everywhere), otherwise a human-friendly table or summary.
 */

export function printJson(data: unknown): void {
	process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

/** Fails the whole process: a one-line stderr message and a non-zero exit code — the contract `--json` callers rely on. */
export function fail(message: string, jsonMode: boolean, code = 1): never {
	if (jsonMode) {
		process.stdout.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
	} else {
		process.stderr.write(`Error: ${message}\n`);
	}
	process.exit(code);
}

const MIN_COLUMN_WIDTH = 3;

/** A minimal column-aligned table — no dependency, good enough for a terminal. */
export function printTable(
	rows: Record<string, string | number | null | undefined>[],
	columns: { key: string; label: string }[]
): void {
	if (rows.length === 0) {
		process.stdout.write("(no results)\n");
		return;
	}
	const widths = columns.map((col) =>
		Math.max(
			MIN_COLUMN_WIDTH,
			col.label.length,
			...rows.map((row) => String(row[col.key] ?? "").length)
		)
	);
	const line = (cells: string[]) =>
		cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join("  ");
	process.stdout.write(`${line(columns.map((c) => c.label))}\n`);
	process.stdout.write(`${widths.map((w) => "-".repeat(w)).join("  ")}\n`);
	for (const row of rows) {
		process.stdout.write(
			`${line(columns.map((c) => String(row[c.key] ?? "")))}\n`
		);
	}
}

export function printLine(message: string): void {
	process.stdout.write(`${message}\n`);
}
