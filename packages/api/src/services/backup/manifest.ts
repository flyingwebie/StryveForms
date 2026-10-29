/**
 * The `manifest.json` shape and the format-version upgrade framework
 * (BACKUP_DESIGN.md "Version compatibility"). Internal to services/backup —
 * CONTRACT.md documents the overview types callers actually see.
 */

export const ARCHIVE_FORMAT = "stryveforms-archive";
/** Bump this (and add an `upgrades[N]` step below) whenever manifest/entity shapes change. */
export const CURRENT_FORMAT_VERSION = 1;

export type ArchiveScope = "workspace" | "instance";

export interface ArchiveManifest {
	appVersion: string;
	counts: Record<string, number>;
	createdAt: string;
	customDomains?: string[];
	encryption: { includesSecrets: boolean };
	format: typeof ARCHIVE_FORMAT;
	formatVersion: number;
	includesSecrets: boolean;
	includesUploads: boolean;
	members?: { email: string; invited: boolean; role: string }[];
	scope: ArchiveScope;
	sizeBytes?: number;
	source: { instanceName: string; url: string };
	workspaces: { id: string; name: string }[];
}

/**
 * One step per format version bump: `upgrades[N]` turns a manifest+entity
 * rows written at version N into version N+1's shape, in place. Readers run
 * every step between the archive's version and `CURRENT_FORMAT_VERSION`, so
 * a newer app always imports older archives. There are no real steps yet —
 * this is exercised by a fake step in the test suite.
 */
export type UpgradeStep = (manifest: ArchiveManifest) => void;

export const upgrades: Record<number, UpgradeStep> = {};

export class UnsupportedArchiveVersionError extends Error {
	constructor(fileVersion: number, appVersion: string) {
		super(
			`This file was made by StryveForms using archive format v${fileVersion}. Upgrade to at least a version that supports v${fileVersion} to import it (this app understands up to v${CURRENT_FORMAT_VERSION}, running app version ${appVersion}).`
		);
	}
}

/** Runs every `upgrades[N]` step needed to bring `manifest` up to `CURRENT_FORMAT_VERSION`. Mutates and returns it. */
export function upgradeManifest(
	manifest: ArchiveManifest,
	appVersion: string
): ArchiveManifest {
	if (manifest.formatVersion > CURRENT_FORMAT_VERSION) {
		throw new UnsupportedArchiveVersionError(
			manifest.formatVersion,
			appVersion
		);
	}
	let version = manifest.formatVersion;
	while (version < CURRENT_FORMAT_VERSION) {
		const step = upgrades[version];
		if (step) {
			step(manifest);
		}
		version += 1;
	}
	manifest.formatVersion = CURRENT_FORMAT_VERSION;
	return manifest;
}
