/**
 * The one check for a password-protected form, shared by the public page,
 * submit, submission lookup and file uploads.
 *
 * Wrong guesses are counted per client and form. After too many, every attempt
 * from that client is refused for a while, even a correct one, so the password
 * can't be found by trying many guesses.
 */

export const MAX_PASSWORD_FAILURES = 10;
export const PASSWORD_LOCKOUT_MS = 15 * 60 * 1000;

interface FailureWindow {
	count: number;
	resetAt: number;
}

export type PasswordCheck = "ok" | "wrong" | "locked";

export interface PasswordCheckInput {
	/** Requester's IP; null when unknown (all unknown clients share one window). */
	ip: string | null;
	isMember: boolean;
	password: string | null | undefined;
	row: { id: string; passwordHash: string | null };
}

const failures = new Map<string, FailureWindow>();
let lastSweep = Date.now();

function sweep(now: number) {
	if (now - lastSweep < PASSWORD_LOCKOUT_MS) {
		return;
	}
	for (const [key, window] of failures) {
		if (window.resetAt <= now) {
			failures.delete(key);
		}
	}
	lastSweep = now;
}

function isLocked(key: string, now: number): boolean {
	const window = failures.get(key);
	return (
		window !== undefined &&
		window.resetAt > now &&
		window.count >= MAX_PASSWORD_FAILURES
	);
}

function recordFailure(key: string, now: number) {
	const window = failures.get(key);
	if (!window || window.resetAt <= now) {
		failures.set(key, { count: 1, resetAt: now + PASSWORD_LOCKOUT_MS });
		return;
	}
	window.count += 1;
}

/**
 * `ok` when the form has no password, the viewer is a workspace member, or the
 * password is right. `wrong` for a missing or wrong password. `locked` when this
 * client has guessed wrong too many times recently.
 */
export async function checkFormPassword(
	input: PasswordCheckInput,
	now: number = Date.now()
): Promise<PasswordCheck> {
	const { ip, isMember, password, row } = input;
	if (!row.passwordHash || isMember) {
		return "ok";
	}
	// No password sent is the normal first page load, not a guess.
	if (!password) {
		return "wrong";
	}
	sweep(now);
	const key = `${row.id}:${ip ?? "unknown"}`;
	if (isLocked(key, now)) {
		return "locked";
	}
	if (await Bun.password.verify(password, row.passwordHash)) {
		return "ok";
	}
	recordFailure(key, now);
	return "wrong";
}

/** Test hook: forget every recorded failure. */
export function resetPasswordFailures() {
	failures.clear();
}
