/**
 * Where `stryveforms` keeps its saved login: `~/.config/stryveforms/config.json`.
 * `--url` / `STRYVEFORMS_URL` and `STRYVEFORMS_TOKEN` always take priority
 * over the saved file, so CI can run without ever writing to disk.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CliConfig {
	/** Unix seconds the OAuth access token expires at. Absent for a personal API token (never expires here). */
	expiresAt?: number;
	/** Present when `token` is an OAuth access token — used to silently refresh it. */
	refreshToken?: string;
	/** A personal API token (sfpat_…) or OAuth access token from `login`. */
	token?: string;
	/** The API server's base URL, e.g. https://forms.example.com (no trailing slash, no /api suffix). */
	url?: string;
}

const TRAILING_SLASH = /\/$/;

// Computed per call (not cached at module load). Honors
// `STRYVEFORMS_CONFIG_DIR` first — an explicit override, and how tests
// isolate themselves without touching the real `~/.config` (Bun's
// `homedir()` is resolved once per process and doesn't follow a `HOME`
// env var changed afterwards, so that isn't a usable test seam).
function configDir(): string {
	return (
		process.env.STRYVEFORMS_CONFIG_DIR ||
		join(homedir(), ".config", "stryveforms")
	);
}

function configFile(): string {
	return join(configDir(), "config.json");
}

export function readConfig(): CliConfig {
	const file = configFile();
	if (!existsSync(file)) {
		return {};
	}
	try {
		return JSON.parse(readFileSync(file, "utf8")) as CliConfig;
	} catch {
		return {};
	}
}

export function writeConfig(config: CliConfig): void {
	mkdirSync(configDir(), { recursive: true, mode: 0o700 });
	writeFileSync(configFile(), `${JSON.stringify(config, null, 2)}\n`, {
		mode: 0o600,
	});
}

export function clearConfig(): void {
	writeConfig({});
}

const DEFAULT_URL = "http://localhost:3000";

/** Resolves the server URL: `--url` flag > `STRYVEFORMS_URL` > saved config > localhost default. */
export function resolveUrl(flagUrl?: string): string {
	const url =
		flagUrl || process.env.STRYVEFORMS_URL || readConfig().url || DEFAULT_URL;
	return url.replace(TRAILING_SLASH, "");
}

/** Resolves the bearer token: `--token` flag > `STRYVEFORMS_TOKEN` > saved config. */
export function resolveToken(flagToken?: string): string | undefined {
	return flagToken || process.env.STRYVEFORMS_TOKEN || readConfig().token;
}

export function configPath(): string {
	return configFile();
}
