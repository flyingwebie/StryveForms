import { z } from "zod";

/** One "From" identity a workspace can send notification emails as. */
export const senderSchema = z.object({
	/** Client-generated id (e.g. crypto.randomUUID()), stable across edits. */
	id: z.string().min(1).max(100),
	/** Display name shown to recipients, e.g. "Acme Support". */
	name: z.string().trim().min(1).max(100),
	/** The "From" email address. Only delivers if the SMTP server allows sending as it. */
	address: z.string().trim().toLowerCase().email().max(320),
	/** Where replies go. Defaults to `address` when left blank. */
	replyTo: z.string().trim().toLowerCase().email().max(320).optional(),
});
export type Sender = z.infer<typeof senderSchema>;

/** What a notification email should be sent with, once a sender is resolved. */
export interface ResolvedSender {
	address?: string;
	name?: string;
	replyTo?: string;
}

interface LegacyEmailSettings {
	replyTo?: string;
	senderName?: string;
}

interface SendersWorkspaceSettings {
	defaultSenderId?: string | null;
	/** Pre-multi-sender shape: a single sender name + reply-to, no address. */
	emailSettings?: LegacyEmailSettings;
	senders?: Sender[];
}

/** Synthetic id for the sender migrated from the old single-sender settings. */
export const LEGACY_SENDER_ID = "legacy-default";

/**
 * Reads the workspace's configured senders. Workspaces saved before multiple
 * senders existed only had a sender name + reply-to (no address — the "From"
 * address always came from the SMTP settings or the instance default). Those
 * are migrated on read into one sender so nothing changes for them until they
 * opt into the new list.
 */
export function listSenders(
	settings: Record<string, unknown> | null | undefined
): Sender[] {
	const typed = (settings ?? {}) as SendersWorkspaceSettings;
	if (Array.isArray(typed.senders) && typed.senders.length > 0) {
		return typed.senders;
	}
	const legacy = typed.emailSettings;
	if (legacy?.senderName || legacy?.replyTo) {
		return [
			{
				address: "",
				id: LEGACY_SENDER_ID,
				name: legacy.senderName || "",
				replyTo: legacy.replyTo || undefined,
			},
		];
	}
	return [];
}

/** The id of the sender used when none is explicitly picked. */
export function getDefaultSenderId(
	settings: Record<string, unknown> | null | undefined
): string | undefined {
	const senders = listSenders(settings);
	if (senders.length === 0) {
		return undefined;
	}
	const typed = (settings ?? {}) as SendersWorkspaceSettings;
	if (
		typed.defaultSenderId &&
		senders.some((s) => s.id === typed.defaultSenderId)
	) {
		return typed.defaultSenderId;
	}
	return senders[0]?.id;
}

/**
 * Picks which sender identity an outgoing email should use.
 * - A `senderId` that matches a configured sender returns that sender.
 * - A missing or unrecognised `senderId` falls back to the workspace default.
 * - No senders configured at all (not even the legacy name/reply-to) returns null.
 */
export function resolveSender(
	workspaceSettings: Record<string, unknown> | null | undefined,
	senderId?: string | null
): ResolvedSender | null {
	const senders = listSenders(workspaceSettings);
	if (senders.length === 0) {
		return null;
	}
	const defaultId = getDefaultSenderId(workspaceSettings);
	const sender =
		(senderId ? senders.find((s) => s.id === senderId) : undefined) ??
		senders.find((s) => s.id === defaultId) ??
		senders[0];
	if (!sender) {
		return null;
	}
	return {
		address: sender.address || undefined,
		name: sender.name || undefined,
		// The reply-to defaults to the sender's own address when not set.
		replyTo: sender.replyTo || sender.address || undefined,
	};
}
