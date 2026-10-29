import type { PresentationStyle } from "@StryveForms/forms/blocks";
import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Input } from "@StryveForms/ui/components/input";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowUpRightIcon,
	CheckIcon,
	ChevronRightIcon,
	FileTextIcon,
	LayoutGridIcon,
	SearchIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PresentationPreview } from "@/components/form-editor/design/illustrations";
import { useTRPC } from "@/utils/trpc";

const PRESENTATION_OPTIONS: {
	description: string;
	label: string;
	value: PresentationStyle;
}[] = [
	{
		description: "One page, all questions together.",
		label: "Classic",
		value: "classic",
	},
	{
		description: "One question per screen, like a conversation.",
		label: "Focused",
		value: "focused",
	},
];

export default function NewFormDialog({
	folderId,
	onOpenChange,
	open,
	workspaceId,
}: {
	/** Pre-selects the folder the new form is created into (sidebar filter context). */
	folderId?: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const [search, setSearch] = useState("");
	// Asked up front, applies to blank forms and templates alike.
	const [presentationStyle, setPresentationStyle] =
		useState<PresentationStyle>("classic");
	const templates = useQuery(trpc.template.list.queryOptions());
	const myTemplates = useQuery(
		trpc.template.listMine.queryOptions({ workspaceId })
	);

	const create = useMutation(
		trpc.form.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (data) => {
				onOpenChange(false);
				navigate({ to: "/editor/$formId", params: { formId: data.id } });
			},
		})
	);

	const builtIn = (templates.data ?? []).filter((template) =>
		template.name.toLowerCase().includes(search.toLowerCase())
	);
	const mine = (myTemplates.data ?? []).filter((template) =>
		template.name.toLowerCase().includes(search.toLowerCase())
	);

	const templateRows = [
		...mine.map((template) => ({
			fieldsCount: template.fieldsCount,
			key: template.id,
			name: template.name,
			onSelect: () =>
				create.mutate({
					data: { presentationStyle },
					folderId,
					templateId: template.id,
					workspaceId,
				}),
		})),
		...builtIn.map((template) => ({
			fieldsCount: template.fieldsCount,
			key: template.slug,
			name: template.name,
			onSelect: () =>
				create.mutate({
					data: { presentationStyle },
					folderId,
					templateSlug: template.slug,
					workspaceId,
				}),
		})),
	];

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Create a new form</DialogTitle>
					<DialogDescription>
						Start blank in a style, or pick a template to customize.
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-6 sm:grid-cols-2">
					<div className="space-y-2">
						<p className="font-medium text-[13px]">Style</p>
						<div className="grid grid-cols-2 gap-3">
							{PRESENTATION_OPTIONS.map((option) => (
								<button
									aria-pressed={presentationStyle === option.value}
									className={cn(
										"flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
										presentationStyle === option.value
											? "border-primary ring-1 ring-primary"
											: "border-border hover:border-foreground/30"
									)}
									key={option.value}
									onClick={() => setPresentationStyle(option.value)}
									type="button"
								>
									<div className="flex h-24 items-center justify-center rounded-lg bg-subtle">
										<PresentationPreview variant={option.value} />
									</div>
									<div className="flex items-center justify-between gap-2">
										<span className="font-medium text-sm">{option.label}</span>
										<span
											aria-hidden="true"
											className={cn(
												"flex size-4 shrink-0 items-center justify-center rounded-full border",
												presentationStyle === option.value
													? "border-primary bg-primary text-primary-foreground"
													: "border-input"
											)}
										>
											{presentationStyle === option.value ? (
												<CheckIcon className="size-3" />
											) : null}
										</span>
									</div>
									<p className="text-subtle-foreground text-xs">
										{option.description}
									</p>
								</button>
							))}
						</div>
					</div>

					<div className="space-y-2">
						<p className="font-medium text-[13px]">Start from a template</p>
						<div className="relative">
							<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
							<Input
								className="pl-8"
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Search templates…"
								value={search}
							/>
						</div>

						<div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
							{templateRows.map((template) => (
								<button
									className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
									disabled={create.isPending}
									key={template.key}
									onClick={template.onSelect}
									type="button"
								>
									<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
										<FileTextIcon className="size-4" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium text-sm">
											{template.name}
										</span>
										<span className="block text-subtle-foreground text-xs">
											{template.fieldsCount} fields
										</span>
									</span>
									<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
								</button>
							))}
							{templates.isSuccess &&
							myTemplates.isSuccess &&
							templateRows.length === 0 ? (
								<p className="py-6 text-center text-muted-foreground text-sm">
									No templates match "{search}"
								</p>
							) : null}
						</div>

						<Button
							className="w-full justify-start text-muted-foreground"
							onClick={() => onOpenChange(false)}
							render={<Link to="/dashboard/templates" />}
							size="sm"
							variant="ghost"
						>
							<LayoutGridIcon /> Browse all templates
						</Button>
					</div>
				</div>

				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
					<Button
						disabled={create.isPending}
						onClick={() =>
							create.mutate({
								data: { presentationStyle },
								folderId,
								workspaceId,
							})
						}
						type="button"
					>
						<ArrowUpRightIcon /> Start from scratch
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
