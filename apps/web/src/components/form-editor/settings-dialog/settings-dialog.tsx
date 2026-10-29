import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import {
	BarChart3Icon,
	Code2Icon,
	SearchIcon,
	SendIcon,
	ShieldCheckIcon,
	SigmaIcon,
	SlidersHorizontalIcon,
	XIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import { useEditor } from "../state/editor-context";
import { AccessSection } from "./access-section";
import { AnalyticsSection } from "./analytics-section";
import { CustomCodeSection } from "./custom-code-section";
import { GeneralSection } from "./general-section";
import { SeoSection } from "./seo-section";
import { SubmissionsSection } from "./submissions-section";
import { VariablesSection } from "./variables-section";

const SECTIONS: {
	component: ComponentType;
	description: string;
	icon: ComponentType<{ className?: string }>;
	label: string;
	value: string;
}[] = [
	{
		component: GeneralSection,
		description: "Title, visibility, tags, and link",
		icon: SlidersHorizontalIcon,
		label: "General",
		value: "general",
	},
	{
		component: SubmissionsSection,
		description: "What happens after someone submits",
		icon: SendIcon,
		label: "Submissions",
		value: "submissions",
	},
	{
		component: AccessSection,
		description: "Password, captcha, close dates, limits",
		icon: ShieldCheckIcon,
		label: "Access & security",
		value: "access",
	},
	{
		component: SeoSection,
		description: "Search engine title, description, previews",
		icon: SearchIcon,
		label: "SEO",
		value: "seo",
	},
	{
		component: AnalyticsSection,
		description: "Connect Meta Pixel, GA, or GTM",
		icon: BarChart3Icon,
		label: "Analytics",
		value: "analytics",
	},
	{
		component: CustomCodeSection,
		description: "Your own CSS and head code",
		icon: Code2Icon,
		label: "Custom code",
		value: "code",
	},
	{
		component: VariablesSection,
		description: "Formulas computed from answers",
		icon: SigmaIcon,
		label: "Variables",
		value: "variables",
	},
];

export function SettingsDialog({
	onOpenChange,
	open,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const { dirty, readOnly } = useEditor();
	let saveState = "All changes saved";
	if (readOnly) {
		saveState = "Read-only";
	} else if (dirty) {
		saveState = "Unsaved changes";
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className="top-[3vh] left-1/2 h-[94vh] max-h-[94vh] w-[96vw] max-w-6xl -translate-x-1/2 translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-6xl"
				showCloseButton={false}
			>
				<Tabs
					className="flex h-full min-h-0 flex-col gap-0"
					defaultValue="general"
					orientation="vertical"
				>
					{/* Sticky header: title, live save state, close. */}
					<div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
						<DialogTitle className="text-base">Form settings</DialogTitle>
						<span
							aria-live="polite"
							className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
						>
							{saveState}
						</span>
						<div className="flex-1" />
						<DialogClose render={<Button size="icon-sm" variant="ghost" />}>
							<XIcon />
							<span className="sr-only">Close settings</span>
						</DialogClose>
					</div>
					<div className="flex min-h-0 flex-1">
						{/* Icon + description nav, arrow-key navigable (Base UI tablist). */}
						<TabsList className="h-full w-64 shrink-0 flex-col items-stretch justify-start gap-1 overflow-y-auto rounded-none border-r bg-muted/20 p-2">
							{SECTIONS.map((section) => {
								const Icon = section.icon;
								return (
									<TabsTrigger
										className="h-auto flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left"
										key={section.value}
										value={section.value}
									>
										<span className="flex items-center gap-2 font-medium text-sm">
											<Icon className="size-4 shrink-0" />
											{section.label}
										</span>
										<span className="pl-6 text-left font-normal text-muted-foreground text-xs">
											{section.description}
										</span>
									</TabsTrigger>
								);
							})}
						</TabsList>
						{/* Scrolls independently of the nav; capped to a readable width. */}
						<div className="min-h-0 flex-1 overflow-y-auto">
							<div className="mx-auto max-w-2xl px-6 py-6">
								{SECTIONS.map((section) => {
									const SectionComponent = section.component;
									return (
										<TabsContent key={section.value} value={section.value}>
											<SectionComponent />
										</TabsContent>
									);
								})}
							</div>
						</div>
					</div>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
