import { describe, expect, test } from "bun:test";

import {
	getDefaultSenderId,
	LEGACY_SENDER_ID,
	listSenders,
	resolveSender,
	senderSchema,
} from "./senders";

const SENDER_A = {
	address: "support@acme.com",
	id: "a",
	name: "Acme Support",
	replyTo: "help@acme.com",
};
const SENDER_B = {
	address: "sales@acme.com",
	id: "b",
	name: "Acme Sales",
};

describe("senderSchema", () => {
	test("accepts a sender without a reply-to", () => {
		expect(senderSchema.safeParse(SENDER_B).success).toBe(true);
	});

	test("rejects an invalid email address", () => {
		expect(
			senderSchema.safeParse({ ...SENDER_A, address: "not-an-email" }).success
		).toBe(false);
	});

	test("rejects a blank name", () => {
		expect(senderSchema.safeParse({ ...SENDER_A, name: "  " }).success).toBe(
			false
		);
	});
});

describe("listSenders", () => {
	test("returns the configured senders list when present", () => {
		expect(listSenders({ senders: [SENDER_A, SENDER_B] })).toEqual([
			SENDER_A,
			SENDER_B,
		]);
	});

	test("migrates the legacy senderName/replyTo into one sender", () => {
		expect(
			listSenders({
				emailSettings: { replyTo: "old@acme.com", senderName: "Old Acme" },
			})
		).toEqual([
			{
				address: "",
				id: LEGACY_SENDER_ID,
				name: "Old Acme",
				replyTo: "old@acme.com",
			},
		]);
	});

	test("returns nothing for a workspace with no sender config at all", () => {
		expect(listSenders({})).toEqual([]);
		expect(listSenders(null)).toEqual([]);
		expect(listSenders(undefined)).toEqual([]);
	});

	test("an empty senders array falls back to the legacy migration", () => {
		expect(
			listSenders({
				emailSettings: { senderName: "Old Acme" },
				senders: [],
			})
		).toEqual([
			{
				address: "",
				id: LEGACY_SENDER_ID,
				name: "Old Acme",
				replyTo: undefined,
			},
		]);
	});
});

describe("getDefaultSenderId", () => {
	test("uses the saved defaultSenderId when it matches a sender", () => {
		expect(
			getDefaultSenderId({
				defaultSenderId: "b",
				senders: [SENDER_A, SENDER_B],
			})
		).toBe("b");
	});

	test("falls back to the first sender when defaultSenderId is unset", () => {
		expect(getDefaultSenderId({ senders: [SENDER_A, SENDER_B] })).toBe("a");
	});

	test("falls back to the first sender when defaultSenderId no longer exists", () => {
		expect(
			getDefaultSenderId({
				defaultSenderId: "gone",
				senders: [SENDER_A, SENDER_B],
			})
		).toBe("a");
	});

	test("is undefined when there are no senders", () => {
		expect(getDefaultSenderId({})).toBeUndefined();
	});
});

describe("resolveSender", () => {
	test("given a known id, returns that sender", () => {
		expect(resolveSender({ senders: [SENDER_A, SENDER_B] }, "b")).toEqual({
			address: "sales@acme.com",
			name: "Acme Sales",
			replyTo: "sales@acme.com",
		});
	});

	test("an address-less sender's reply-to falls back to the address field too", () => {
		// SENDER_B has no explicit replyTo, so it should mirror its own address.
		const resolved = resolveSender({ senders: [SENDER_B] }, "b");
		expect(resolved?.replyTo).toBe("sales@acme.com");
	});

	test("a missing senderId falls back to the default sender", () => {
		expect(
			resolveSender({ defaultSenderId: "b", senders: [SENDER_A, SENDER_B] })
		).toEqual({
			address: "sales@acme.com",
			name: "Acme Sales",
			replyTo: "sales@acme.com",
		});
	});

	test("an unknown senderId falls back to the default sender", () => {
		expect(
			resolveSender(
				{ defaultSenderId: "b", senders: [SENDER_A, SENDER_B] },
				"does-not-exist"
			)
		).toEqual({
			address: "sales@acme.com",
			name: "Acme Sales",
			replyTo: "sales@acme.com",
		});
	});

	test("explicit reply-to is kept instead of defaulting to the address", () => {
		expect(resolveSender({ senders: [SENDER_A] }, "a")?.replyTo).toBe(
			"help@acme.com"
		);
	});

	test("returns null when the workspace has no senders configured", () => {
		expect(resolveSender({})).toBeNull();
		expect(resolveSender({}, "anything")).toBeNull();
	});

	test("resolves the migrated legacy sender by its synthetic id", () => {
		const settings = { emailSettings: { senderName: "Old Acme" } };
		expect(resolveSender(settings, LEGACY_SENDER_ID)).toEqual({
			address: undefined,
			name: "Old Acme",
			replyTo: undefined,
		});
	});
});
