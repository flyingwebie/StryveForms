import { cn } from "@StryveForms/ui/lib/utils";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { ReactNode } from "react";

import InstanceLogo from "@/components/app/instance-logo";
import PoweredBy from "@/components/app/powered-by";
import {
	DEFAULT_HERO_SUBTITLE,
	DEFAULT_HERO_TITLE,
	useInstance,
} from "@/lib/instance";

import MockForm from "./mock-form";

const DEFAULT_PRIMARY_COLOR = "#7c3aed";

const FEATURES = [
	{ icon: Zap, text: "Publish a branded form in minutes" },
	{ icon: Sparkles, text: "Match your workspace's colors and fonts" },
	{
		icon: ShieldCheck,
		text: "Self-hosted — your submissions never leave home",
	},
];

const SHELL_SIZES = {
	lg: "max-w-lg",
	md: "max-w-md",
	sm: "max-w-sm",
	xl: "max-w-3xl",
} as const;

function BrandPanel() {
	const instance = useInstance();
	const heroTitle = instance?.heroTitle || DEFAULT_HERO_TITLE;
	const heroSubtitle = instance?.heroSubtitle || DEFAULT_HERO_SUBTITLE;
	const isDefaultBrand =
		!instance?.primaryColor ||
		instance.primaryColor.toLowerCase() === DEFAULT_PRIMARY_COLOR;

	return (
		<section
			className={cn(
				"relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14",
				isDefaultBrand && "bg-gradient-to-br from-[#8B5CF6] to-[#4338CA]"
			)}
			style={
				isDefaultBrand
					? undefined
					: {
							backgroundImage:
								"linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 55%, black))",
						}
			}
		>
			<InstanceLogo
				className="relative"
				nameClassName="text-white"
				size="lg"
				surface="brand"
			/>
			<div className="relative max-w-xl space-y-6">
				<h1 className="text-balance font-display font-normal text-5xl leading-[1.1] xl:text-6xl">
					{heroTitle}
				</h1>
				<p className="max-w-md text-balance text-lg text-white/80">
					{heroSubtitle}
				</p>
				<ul className="space-y-3">
					{FEATURES.map(({ icon: Icon, text }) => (
						<li className="flex items-center gap-3 text-sm" key={text}>
							<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
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

/** Branded full-screen shell shared by the homepage, login, register and account/device/setup pages. */
export default function AuthShell({
	children,
	showHero = true,
	size = "sm",
}: {
	children: ReactNode;
	showHero?: boolean;
	size?: keyof typeof SHELL_SIZES;
}) {
	return (
		<div
			className={cn(
				"grid min-h-svh bg-app",
				showHero && "lg:grid-cols-[1.1fr_1fr]"
			)}
		>
			{showHero ? <BrandPanel /> : null}
			<div className="relative flex flex-col">
				<main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-5 py-12">
					<div
						className={cn(
							"flex flex-col items-center gap-3 text-center",
							showHero && "lg:hidden"
						)}
					>
						<InstanceLogo size="lg" />
					</div>
					<div className={cn("w-full", SHELL_SIZES[size])}>{children}</div>
				</main>
				<footer className="relative z-10 flex justify-center pb-8">
					<PoweredBy />
				</footer>
			</div>
		</div>
	);
}
