import type { FormField } from "@StryveForms/forms/types";
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
import { Label } from "@StryveForms/ui/components/label";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, FileTextIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

const VISIBILITY_LABELS: Record<string, string> = {
	closed: "Closed",
	draft: "Draft",
	public: "Live",
};

/** "New template" from the Templates page: blank, or snapshotted from an existing form. */
export default function NewTemplateDialog({
	onOpenChange,
	open,
	workspaceId,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [source, setSource] = useState<"blank" | "form">("blank");
	const [formId, setFormId] = useState<string | undefined>();
	const [formSearch, setFormSearch] = useState("");
	const [name, setName] = useState("");

	const formsQuery = useQuery({
		...trpc.form.list.queryOptions({ workspaceId }),
		enabled: open,
	});

	useEffect(() => {
		if (open) {
			setSource("blank");
			setFormId(undefined);
			setFormSearch("");
			setName("");
		}
	}, [open]);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.template.listMine.queryKey({ workspaceId }),
		});

	const createBlank = useMutation(
		trpc.template.createBlank.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Template created");
				onOpenChange(false);
			},
		})
	);
	const createFromForm = useMutation(
		trpc.template.createFromForm.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Template created");
				onOpenChange(false);
			},
		})
	);

	const pending = createBlank.isPending || createFromForm.isPending;
	const forms = (formsQuery.data ?? []).filter((f) =>
		f.title.toLowerCase().includes(formSearch.toLowerCase())
	);

	function handleSubmit() {
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Give the template a name");
			return;
		}
		if (source === "form") {
			if (!formId) {
				toast.error("Pick a form to copy from");
				return;
			}
			createFromForm.mutate({ formId, name: trimmed });
			return;
		}
		createBlank.mutate({ workspaceId, name: trimmed });
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>New template</DialogTitle>
					<DialogDescription>
						{source === "form"
							? "Pick a form to copy its fields and logic into a template."
							: "Save a reusable starting point for your team."}
					</DialogDescription>
				</DialogHeader>

				<Tabs
					onValueChange={(value) => setSource(value as "blank" | "form")}
					value={source}
				>
					<TabsList className="w-full">
						<TabsTrigger className="flex-1" value="blank">
							Blank
						</TabsTrigger>
						<TabsTrigger className="flex-1" value="form">
							From a form
						</TabsTrigger>
					</TabsList>
					<TabsContent className="space-y-4 pt-3" value="blank">
						<div className="space-y-1.5">
							<Label htmlFor="new-template-name">Template name</Label>
							<Input
								id="new-template-name"
								onChange={(event) => setName(event.target.value)}
								placeholder="e.g. Client intake"
								value={name}
							/>
						</div>
						<p className="text-subtle-foreground text-xs">
							Starts empty — add fields and logic in the editor after you create
							it.
						</p>
					</TabsContent>
					<TabsContent className="space-y-3 pt-3" value="form">
						<div className="relative">
							<SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
							<Input
								className="pl-8"
								onChange={(event) => setFormSearch(event.target.value)}
								placeholder="Search…"
								value={formSearch}
							/>
						</div>
						<div className="max-h-56 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
							{forms.length === 0 ? (
								<p className="p-3 text-center text-muted-foreground text-sm">
									No forms found
								</p>
							) : (
								forms.map((f) => {
									const fieldsCount = (
										(f.properties as FormField[] | null) ?? []
									).length;
									const selected = f.id === formId;
									return (
										<button
											className={cn(
												"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted",
												selected && "bg-primary-soft hover:bg-primary-soft"
											)}
											key={f.id}
											onClick={() => {
												setFormId(f.id);
												if (!name) {
													setName(f.title);
												}
											}}
											type="button"
										>
											<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
											<span className="min-w-0 flex-1">
												<span className="block truncate font-medium text-sm">
													{f.title}
												</span>
												<span className="text-subtle-foreground text-xs">
													{fieldsCount} field{fieldsCount === 1 ? "" : "s"} ·{" "}
													{VISIBILITY_LABELS[f.visibility] ?? f.visibility}
												</span>
											</span>
											{selected ? (
												<CheckIcon className="size-4 shrink-0 text-primary" />
											) : null}
										</button>
									);
								})
							)}
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="new-template-name-form">Template name</Label>
							<Input
								id="new-template-name-form"
								onChange={(event) => setName(event.target.value)}
								value={name}
							/>
						</div>
					</TabsContent>
				</Tabs>

				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button disabled={pending} onClick={handleSubmit} type="button">
						<PlusIcon /> Create template
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
