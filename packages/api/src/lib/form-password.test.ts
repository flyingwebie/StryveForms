import { beforeEach, describe, expect, it } from "bun:test";

import {
	checkFormPassword,
	MAX_PASSWORD_FAILURES,
	PASSWORD_LOCKOUT_MS,
	resetPasswordFailures,
} from "./form-password";

const passwordHash = await Bun.password.hash("open-sesame");
const row = { id: "form-1", passwordHash };
const ip = "203.0.113.7";

beforeEach(() => {
	resetPasswordFailures();
});

describe("checkFormPassword", () => {
	it("lets anyone through a form without a password", async () => {
		expect(
			await checkFormPassword({
				ip,
				isMember: false,
				password: undefined,
				row: { id: "f", passwordHash: null },
			})
		).toBe("ok");
	});

	it("lets workspace members through without the password", async () => {
		expect(
			await checkFormPassword({ ip, isMember: true, password: undefined, row })
		).toBe("ok");
	});

	it("checks the password for respondents", async () => {
		expect(
			await checkFormPassword({ ip, isMember: false, password: undefined, row })
		).toBe("wrong");
		expect(
			await checkFormPassword({ ip, isMember: false, password: "nope", row })
		).toBe("wrong");
		expect(
			await checkFormPassword({
				ip,
				isMember: false,
				password: "open-sesame",
				row,
			})
		).toBe("ok");
	});

	it("locks a client out after too many wrong guesses, even for the right password", async () => {
		const now = 1_000_000;
		await Promise.all(
			Array.from({ length: MAX_PASSWORD_FAILURES }, (_, i) =>
				checkFormPassword(
					{ ip, isMember: false, password: `guess-${i}`, row },
					now
				)
			)
		);
		expect(
			await checkFormPassword(
				{ ip, isMember: false, password: "open-sesame", row },
				now
			)
		).toBe("locked");
		// Another client and another form are unaffected.
		expect(
			await checkFormPassword(
				{ ip: "198.51.100.1", isMember: false, password: "open-sesame", row },
				now
			)
		).toBe("ok");
		// The lockout ends once the window passes.
		expect(
			await checkFormPassword(
				{ ip, isMember: false, password: "open-sesame", row },
				now + PASSWORD_LOCKOUT_MS + 1
			)
		).toBe("ok");
	});

	it("admits at most the limit when many guesses arrive at once", async () => {
		const now = 2_000_000;
		const attempts = Array.from({ length: 100 }, (_, i) =>
			i === 50 ? "open-sesame" : `guess-${i}`
		);
		const results = await Promise.all(
			attempts.map((password) =>
				checkFormPassword({ ip, isMember: false, password, row }, now)
			)
		);
		// Only the first MAX_PASSWORD_FAILURES were checked at all; the right
		// password arrived after the limit, so it was refused too.
		expect(results.filter((r) => r !== "locked")).toHaveLength(
			MAX_PASSWORD_FAILURES
		);
		expect(results[50]).toBe("locked");
	});

	it("doesn't count a right password against the limit", async () => {
		const now = 3_000_000;
		await Promise.all(
			Array.from({ length: MAX_PASSWORD_FAILURES - 1 }, (_, i) =>
				checkFormPassword(
					{ ip, isMember: false, password: `guess-${i}`, row },
					now
				)
			)
		);
		expect(
			await checkFormPassword(
				{ ip, isMember: false, password: "open-sesame", row },
				now
			)
		).toBe("ok");
		expect(
			await checkFormPassword(
				{ ip, isMember: false, password: "open-sesame", row },
				now
			)
		).toBe("ok");
	});

	it("doesn't count a page load with no password as a guess", async () => {
		await Promise.all(
			Array.from({ length: MAX_PASSWORD_FAILURES * 2 }, () =>
				checkFormPassword({ ip, isMember: false, password: "", row })
			)
		);
		expect(
			await checkFormPassword({
				ip,
				isMember: false,
				password: "open-sesame",
				row,
			})
		).toBe("ok");
	});
});
