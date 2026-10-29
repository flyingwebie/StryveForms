import { Button } from "@StryveForms/ui/components/button";
import { Link } from "@tanstack/react-router";
import { SparklesIcon, XIcon } from "lucide-react";
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
		<div className="flex items-center gap-3 border-b bg-primary-soft px-4 py-2.5 text-primary-soft-foreground text-sm">
			<SparklesIcon className="size-4 shrink-0" />
			<p className="min-w-0 flex-1 truncate">
				<span className="font-medium">Finish setting up your workspace</span>
				<span className="hidden text-primary-soft-foreground/80 sm:inline">
					{" "}
					— Add your branding, invite teammates, and connect an email sender to
					get the most out of StryveForms.
				</span>
			</p>
			<Button render={<Link to="/setup" />} size="sm">
				Continue setup
			</Button>
			<button
				aria-label="Dismiss"
				className="shrink-0 text-primary-soft-foreground/70 hover:text-primary-soft-foreground"
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
