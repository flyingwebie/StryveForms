import { describe, expect, test } from "bun:test";

import { printJson, printLine, printTable } from "../output";

function capture(fn: () => void): string {
	const chunks: string[] = [];
	const original = process.stdout.write.bind(process.stdout);
	(process.stdout as any).write = (chunk: string) => {
		chunks.push(chunk);
		return true;
	};
	try {
		fn();
	} finally {
		process.stdout.write = original;
	}
	return chunks.join("");
}

describe("printJson", () => {
	test("prints valid, pretty-printed JSON ending in a newline", () => {
		const out = capture(() => printJson({ a: 1, b: [1, 2] }));
		expect(out.endsWith("\n")).toBe(true);
		expect(JSON.parse(out)).toEqual({ a: 1, b: [1, 2] });
	});
});

describe("printLine", () => {
	test("prints the message with a trailing newline", () => {
		expect(capture(() => printLine("hello"))).toBe("hello\n");
	});
});

describe("printTable", () => {
	test("prints '(no results)' for an empty array", () => {
		expect(capture(() => printTable([], [{ key: "id", label: "ID" }]))).toBe(
			"(no results)\n"
		);
	});

	test("includes every row's values and the header", () => {
		const out = capture(() =>
			printTable(
				[
					{ id: "1", name: "Alice" },
					{ id: "22", name: "Bob" },
				],
				[
					{ key: "id", label: "ID" },
					{ key: "name", label: "NAME" },
				]
			)
		);
		expect(out).toContain("ID");
		expect(out).toContain("NAME");
		expect(out).toContain("Alice");
		expect(out).toContain("Bob");
		// 3 lines: header, separator, 2 data rows = 4
		expect(out.trim().split("\n")).toHaveLength(4);
	});

	test("pads columns to the widest value", () => {
		const out = capture(() =>
			printTable(
				[{ id: "a-very-long-id-value" }, { id: "short" }],
				[{ key: "id", label: "ID" }]
			)
		);
		const lines = out.trim().split("\n");
		// header + separator + 2 rows, all padded to the same column width
		expect(lines[0]?.length).toBe(lines[2]?.length);
	});

	test("renders null/undefined cell values as empty", () => {
		const out = capture(() =>
			printTable(
				[
					{ id: "1", note: null },
					{ id: "2", note: undefined },
				],
				[
					{ key: "id", label: "ID" },
					{ key: "note", label: "NOTE" },
				]
			)
		);
		expect(out).not.toContain("null");
		expect(out).not.toContain("undefined");
	});
});
