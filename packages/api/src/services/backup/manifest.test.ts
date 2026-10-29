import { describe, expect, test } from "bun:test";

import {
	ARCHIVE_FORMAT,
	type ArchiveManifest,
	CURRENT_FORMAT_VERSION,
	UnsupportedArchiveVersionError,
	upgradeManifest,
	upgrades,
} from "./manifest";

function fakeManifest(
	overrides: Partial<ArchiveManifest> = {}
): ArchiveManifest {
	return {
		appVersion: "0.1.0",
		counts: {},
		createdAt: new Date().toISOString(),
		encryption: { includesSecrets: false },
		format: ARCHIVE_FORMAT,
		formatVersion: CURRENT_FORMAT_VERSION,
		includesSecrets: false,
		includesUploads: true,
		scope: "workspace",
		source: { instanceName: "test", url: "https://example.test" },
		workspaces: [],
		...overrides,
	};
}

describe("upgradeManifest", () => {
	test("leaves a current-version manifest untouched", () => {
		const manifest = fakeManifest();
		const upgraded = upgradeManifest(manifest, "0.2.0");
		expect(upgraded.formatVersion).toBe(CURRENT_FORMAT_VERSION);
		expect(upgraded).toBe(manifest);
	});

	test("runs a registered upgrade step to bring an older archive up to date", () => {
		// There are no real steps yet (CURRENT_FORMAT_VERSION is still 1), so
		// this registers a fake `0 -> 1` step and feeds in a v0 manifest —
		// exactly the "fake step" exercise ROUND6_BRIEF asks for.
		const fakeStep = (m: ArchiveManifest) => {
			m.counts.upgradedFromV0 = 1;
		};
		upgrades[0] = fakeStep;
		try {
			const manifest = fakeManifest({ formatVersion: 0 });
			const result = upgradeManifest(manifest, "0.2.0");
			expect(result.formatVersion).toBe(CURRENT_FORMAT_VERSION);
			expect(result.counts.upgradedFromV0).toBe(1);
		} finally {
			Reflect.deleteProperty(upgrades, 0);
		}
	});

	test("refuses a newer formatVersion than this app understands", () => {
		const manifest = fakeManifest({
			formatVersion: CURRENT_FORMAT_VERSION + 1,
		});
		expect(() => upgradeManifest(manifest, "0.1.0")).toThrow(
			UnsupportedArchiveVersionError
		);
	});
});
