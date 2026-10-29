import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

type Tab = "sign-in" | "sign-up";

const HEADINGS: Record<Tab, { subtitle: string; title: string }> = {
	"sign-in": {
		subtitle: "Sign in to manage your forms and responses.",
		title: "Welcome back",
	},
	"sign-up": {
		subtitle: "It only takes a minute to get started.",
		title: "Create your account",
	},
};

/** The sign-in / create-account card embedded in the branded homepage, login and register pages. */
export default function AuthCard({
	defaultTab,
	onTabChange,
	redirectTo,
	registrationOpen,
}: {
	defaultTab: Tab;
	onTabChange?: (tab: Tab) => void;
	redirectTo?: string;
	registrationOpen: boolean;
}) {
	const [tab, setTab] = useState<Tab>(
		registrationOpen ? defaultTab : "sign-in"
	);
	// While the sign-in form is showing its 2FA step, the card drops its own
	// heading and tabs so the 2FA screen can own the whole card (see design).
	const [twoFactorActive, setTwoFactorActive] = useState(false);
	const heading = HEADINGS[tab];

	return (
		<div className="w-full rounded-2xl border bg-card p-6 text-card-foreground shadow-black/5 shadow-xl sm:p-8 dark:shadow-black/40">
			{twoFactorActive ? null : (
				<div className="mb-6 space-y-1">
					<h2 className="font-semibold text-xl tracking-tight">
						{heading.title}
					</h2>
					<p className="text-muted-foreground text-sm">{heading.subtitle}</p>
				</div>
			)}
			{registrationOpen ? (
				<Tabs
					onValueChange={(value) => {
						setTab(value as Tab);
						onTabChange?.(value as Tab);
					}}
					value={tab}
				>
					{twoFactorActive ? null : (
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="sign-in">Sign in</TabsTrigger>
							<TabsTrigger value="sign-up">Create account</TabsTrigger>
						</TabsList>
					)}
					<TabsContent
						className={twoFactorActive ? undefined : "pt-5"}
						value="sign-in"
					>
						<SignInForm
							onTwoFactorActiveChange={setTwoFactorActive}
							redirectTo={redirectTo}
						/>
					</TabsContent>
					<TabsContent className="pt-5" value="sign-up">
						<SignUpForm redirectTo={redirectTo} />
					</TabsContent>
				</Tabs>
			) : (
				<div className="space-y-5">
					<SignInForm
						onTwoFactorActiveChange={setTwoFactorActive}
						redirectTo={redirectTo}
					/>
					{twoFactorActive ? null : (
						<p className="rounded-lg bg-muted px-3 py-2 text-center text-muted-foreground text-xs">
							New accounts are by invitation only. Ask an administrator to
							invite you.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
