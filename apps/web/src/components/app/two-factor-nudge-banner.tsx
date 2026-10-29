import { Button } from "@StryveForms/ui/components/button";
import { Link } from "@tanstack/react-router";
import { ShieldAlertIcon, XIcon } from "lucide-react";
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
		<div className="flex items-center gap-3 border-b bg-warning-soft px-4 py-2.5 text-sm text-warning">
			<ShieldAlertIcon className="size-4 shrink-0" />
			<p className="min-w-0 flex-1 truncate">
				<span className="font-medium">Secure your account</span>
				<span className="hidden text-warning/80 sm:inline">
					{" "}
					— Add two-factor authentication to protect your account from
					unauthorized access.
				</span>
			</p>
			<Button
				render={<Link search={{ tab: "account" }} to="/dashboard/settings" />}
				size="sm"
				variant="outline"
			>
				Enable 2FA
			</Button>
			<button
				aria-label="Dismiss"
				className="shrink-0 text-warning/70 hover:text-warning"
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
