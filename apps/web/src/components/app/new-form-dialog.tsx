import type { PresentationStyle } from "@StryveForms/forms/blocks";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileTextIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PresentationPreview } from "@/components/form-editor/design/illustrations";
import {
	OptionCard,
	OptionCardGrid,
} from "@/components/form-editor/design/option-card";
import { useTRPC } from "@/utils/trpc";

const PRESENTATION_OPTIONS: {
	description: string;
	label: string;
	value: PresentationStyle;
}[] = [
	{
		description: "All questions on one scrollable page.",
		label: "Classic",
		value: "classic",
	},
	{
		description: "One question at a time, Typeform-style.",
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

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Create a new form</DialogTitle>
					<DialogDescription>Start blank or from a template.</DialogDescription>
				</DialogHeader>

				<Field>
					<FieldLabel>Form style</FieldLabel>
					<OptionCardGrid>
						{PRESENTATION_OPTIONS.map((option) => (
							<OptionCard
								illustration={<PresentationPreview variant={option.value} />}
								key={option.value}
								label={option.label}
								onSelect={() => setPresentationStyle(option.value)}
								selected={presentationStyle === option.value}
							/>
						))}
					</OptionCardGrid>
					<FieldDescription>
						{
							PRESENTATION_OPTIONS.find((o) => o.value === presentationStyle)
								?.description
						}{" "}
						Applies to a blank form or any template below.
					</FieldDescription>
				</Field>

				<button
					className="flex w-full items-center gap-3 border border-border border-dashed p-3 text-left hover:bg-muted"
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
					<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
						<FileTextIcon className="size-4" />
					</span>
					<span>
						<span className="block font-medium text-sm">Blank form</span>
						<span className="block text-muted-foreground text-xs">
							Start from scratch with an empty form
						</span>
					</span>
				</button>

				<div className="relative">
					<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
					<Input
						className="pl-8"
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search templates…"
						value={search}
					/>
				</div>

				<div className="max-h-80 space-y-1 overflow-y-auto">
					{mine.map((template) => (
						<button
							className="flex w-full items-start justify-between gap-3 border border-border p-3 text-left hover:bg-muted"
							disabled={create.isPending}
							key={template.id}
							onClick={() =>
								create.mutate({
									data: { presentationStyle },
									templateId: template.id,
									workspaceId,
									folderId,
								})
							}
							type="button"
						>
							<span>
								<span className="block font-medium text-sm">
									{template.icon ? `${template.icon} ` : ""}
									{template.name}
								</span>
								<span className="block text-muted-foreground text-xs">
									{template.description}
								</span>
							</span>
							<Badge variant="outline">{template.fieldsCount} fields</Badge>
						</button>
					))}
					{builtIn.map((template) => (
						<button
							className="flex w-full items-start justify-between gap-3 border border-border p-3 text-left hover:bg-muted"
							disabled={create.isPending}
							key={template.slug}
							onClick={() =>
								create.mutate({
									data: { presentationStyle },
									templateSlug: template.slug,
									workspaceId,
									folderId,
								})
							}
							type="button"
						>
							<span>
								<span className="block font-medium text-sm">
									{template.name}
								</span>
								<span className="block text-muted-foreground text-xs">
									{template.description}
								</span>
							</span>
							<Badge variant="outline">{template.fieldsCount} fields</Badge>
						</button>
					))}
					{templates.isSuccess &&
						myTemplates.isSuccess &&
						builtIn.length === 0 &&
						mine.length === 0 && (
							<p className="py-6 text-center text-muted-foreground text-sm">
								No templates match "{search}"
							</p>
						)}
				</div>

				<Button
					onClick={() => onOpenChange(false)}
					render={<Link to="/dashboard/templates" />}
					size="sm"
					variant="ghost"
				>
					Browse all templates
				</Button>
			</DialogContent>
		</Dialog>
	);
}
