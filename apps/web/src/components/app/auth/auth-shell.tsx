import { cn } from "@StryveForms/ui/lib/utils";
import { GitBranch, LayoutTemplate, Zap } from "lucide-react";
import type { ReactNode } from "react";

import InstanceLogo from "@/components/app/instance-logo";
import PoweredBy from "@/components/app/powered-by";
import {
	DEFAULT_HERO_SUBTITLE,
	DEFAULT_HERO_TITLE,
	useInstance,
} from "@/lib/instance";

import MockForm from "./mock-form";

const FEATURES = [
	{ icon: LayoutTemplate, text: "Build any form in minutes, no code" },
	{ icon: GitBranch, text: "Smart logic that adapts to every answer" },
	{ icon: Zap, text: "Responses, alerts and automations in one place" },
];

/** Soft colour wash and a faint grid, tinted with the instance's primary colour. */
function Backdrop({ className }: { className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 overflow-hidden",
				className
			)}
		>
			<div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_0%_0%,color-mix(in_oklch,var(--primary)_32%,transparent),transparent_60%),radial-gradient(50rem_40rem_at_100%_100%,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_55%)]" />
			<div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--foreground)_6%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground)_6%,transparent)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
		</div>
	);
}

function BrandPanel() {
	const instance = useInstance();
	const heroTitle = instance?.heroTitle || DEFAULT_HERO_TITLE;
	const heroSubtitle = instance?.heroSubtitle || DEFAULT_HERO_SUBTITLE;
	return (
		<section className="relative hidden flex-col justify-between overflow-hidden border-r bg-muted/30 p-10 lg:flex xl:p-14">
			<Backdrop />
			<InstanceLogo
				className="relative"
				markClassName="h-9 size-9"
				nameClassName="text-xl"
			/>
			<div className="relative max-w-xl space-y-6">
				<h1 className="text-balance font-semibold text-4xl tracking-tight xl:text-5xl">
					{heroTitle}
				</h1>
				<p className="max-w-md text-balance text-lg text-muted-foreground">
					{heroSubtitle}
				</p>
				<ul className="space-y-3">
					{FEATURES.map(({ icon: Icon, text }) => (
						<li className="flex items-center gap-3 text-sm" key={text}>
							<span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
								<Icon className="size-4" />
							</span>
							{text}
						</li>
					))}
				</ul>
			</div>
			<div className="relative pt-10 pb-6">
				<MockForm />
			</div>
		</section>
	);
}

/** Branded full-screen shell shared by the homepage, login, register and password pages. */
export default function AuthShell({
	children,
	showHero = true,
}: {
	children: ReactNode;
	showHero?: boolean;
}) {
	const instance = useInstance();
	const heroTitle = instance?.heroTitle || DEFAULT_HERO_TITLE;

	return (
		<div
			className={cn(
				"grid min-h-svh bg-background",
				showHero && "lg:grid-cols-[1.1fr_1fr]"
			)}
		>
			{showHero ? <BrandPanel /> : null}
			<div className="relative flex flex-col">
				<Backdrop className={showHero ? "lg:hidden" : undefined} />
				<main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-5 py-12">
					<div
						className={cn(
							"flex flex-col items-center gap-3 text-center",
							showHero && "lg:hidden"
						)}
					>
						<InstanceLogo markClassName="size-9 h-9" nameClassName="text-xl" />
						{showHero ? (
							<h1 className="max-w-sm text-balance font-semibold text-2xl tracking-tight">
								{heroTitle}
							</h1>
						) : null}
					</div>
					<div className="w-full max-w-sm">{children}</div>
				</main>
				<footer className="relative z-10 flex justify-center pb-8">
					<PoweredBy />
				</footer>
			</div>
		</div>
	);
}
