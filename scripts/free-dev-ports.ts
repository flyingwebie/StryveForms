/**
 * Runs before `bun run dev`: stops StryveForms dev servers left over from an
 * earlier session (another terminal, a crashed run, an agent's helper script)
 * that still hold the API or web port. Without this, the API fails with
 * EADDRINUSE and the web app silently moves to another port, which breaks
 * sign-in because BETTER_AUTH_URL points at the usual one.
 *
 * Only processes started from this repository are stopped. Anything else on
 * those ports is reported and left alone.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
/** Bun's default port for `apps/server` (it exports the app without a port). */
const API_PORT = 3000;
const WEB_PORT = Number(process.env.PORT) || 3002;
const EXIT_WAIT_MS = 3000;
const POLL_MS = 100;

function run(command: string, args: string[]): string {
	const result = spawnSync(command, args, { encoding: "utf8" });
	return result.stdout ?? "";
}

function listenersOn(port: number): number[] {
	return run("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"])
		.split("\n")
		.map((line) => Number(line.trim()))
		.filter((pid) => pid > 0);
}

/** The process's working directory and full command line. */
function describeProcess(pid: number): { command: string; cwd: string } {
	const cwdLine = run("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"])
		.split("\n")
		.find((line) => line.startsWith("n"));
	return {
		command: run("ps", ["-o", "command=", "-p", String(pid)]).trim(),
		cwd: cwdLine ? cwdLine.slice(1) : "",
	};
}

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function waitForExit(pids: number[]): void {
	const deadline = Date.now() + EXIT_WAIT_MS;
	while (Date.now() < deadline && pids.some(isAlive)) {
		Bun.sleepSync(POLL_MS);
	}
	for (const pid of pids.filter(isAlive)) {
		process.kill(pid, "SIGKILL");
	}
}

const stopped: number[] = [];
for (const port of [API_PORT, WEB_PORT]) {
	for (const pid of listenersOn(port)) {
		const { command, cwd } = describeProcess(pid);
		const ours = cwd.startsWith(REPO_ROOT) || command.includes(REPO_ROOT);
		if (!ours) {
			console.warn(
				`[dev] Port ${port} is used by another app (pid ${pid}: ${command}). Stop it before running the dev servers.`
			);
			continue;
		}
		console.log(
			`[dev] Stopping a leftover StryveForms server on port ${port} (pid ${pid}).`
		);
		process.kill(pid, "SIGTERM");
		stopped.push(pid);
	}
}
waitForExit(stopped);
