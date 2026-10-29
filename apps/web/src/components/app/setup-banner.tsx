import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useInstance } from "@/lib/instance";

const DISMISSED_KEY = "sf.setupBannerDismissed";

/** Nudges an admin who hasn't finished onboarding back to /setup. Dismissible, admin-only. */
export default function SetupBanner() {
	const instance = useInstance();
	const { data: session } = authClient.useSession();
	const [dismissed, setDismissed] = useState(
		() =>
			typeof window !== "undefined" &&
			window.localStorage.getItem(DISMISSED_KEY) === "1"
	);

	const isAdmin = Boolean(session?.user.isAdmin);
	if (dismissed || !isAdmin || !instance || instance.setupCompleted) {
		return null;
	}

	return (
		<div className="flex items-center justify-between gap-3 border-b bg-primary/10 px-4 py-2 text-sm">
			<p>
				Finish setting up your installation &mdash;{" "}
				<Link className="font-medium underline" to="/setup">
					resume onboarding
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
