import { describe, expect, it } from "bun:test";

import { joinOptionValues, parseCliArgs } from "../args";

const OPTIONS = {
	form: { type: "string" },
	id: { type: "string" },
	json: { type: "boolean" },
} as const;

describe("joinOptionValues", () => {
	it("joins string option values so a leading dash is kept", () => {
		expect(joinOptionValues(["--form", "-abc", "--json"], OPTIONS)).toEqual([
			"--form=-abc",
			"--json",
		]);
	});

	it("leaves boolean flags and already-joined values alone", () => {
		expect(joinOptionValues(["--json", "--id=-x1"], OPTIONS)).toEqual([
			"--json",
			"--id=-x1",
		]);
	});
});

describe("parseCliArgs", () => {
	it("parses ids that start with a dash", () => {
		const { values, positionals } = parseCliArgs(
			["list", "--form", "-Y43O4uuCO", "--id", "-abc"],
			OPTIONS
		);
		expect(values.form).toBe("-Y43O4uuCO");
		expect(values.id).toBe("-abc");
		expect(positionals).toEqual(["list"]);
	});
});
