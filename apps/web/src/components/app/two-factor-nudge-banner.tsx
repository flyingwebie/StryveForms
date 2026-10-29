import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

const DISMISSED_KEY = "sf.twoFactorNudgeDismissed";

/**
 * Nudges a signed-in user without 2FA to turn it on. Dismissible (remembered
 * per browser) — 2FA stays optional, this is just a reminder.
 */
export default function TwoFactorNudgeBanner() {
	const { data: session } = authClient.useSession();
	const [dismissed, setDismissed] = useState(
		() =>
			typeof window !== "undefined" &&
			window.localStorage.getItem(DISMISSED_KEY) === "1"
	);

	if (dismissed || !session || session.user.twoFactorEnabled) {
		return null;
	}

	return (
		<div className="flex items-center justify-between gap-3 border-b bg-primary/10 px-4 py-2 text-sm">
			<p>
				Protect your account with two-factor authentication &mdash;{" "}
				<Link
					className="font-medium underline"
					search={{ tab: "account" }}
					to="/dashboard/settings"
				>
					turn it on in Settings → Account
				</Link>
				.
			</p>
			<button
				aria-label="Dismiss"
				onClick={() => {
					window.localStorage.setItem(DISMISSED_KEY, "1");
					setDismissed(true);
				}}
				type="button"
			>
				<XIcon className="size-4" />
			</button>
		</div>
	);
}
