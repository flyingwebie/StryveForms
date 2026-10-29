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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

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
	const [name, setName] = useState("");

	const formsQuery = useQuery({
		...trpc.form.list.queryOptions({ workspaceId }),
		enabled: open,
	});

	useEffect(() => {
		if (open) {
			setSource("blank");
			setFormId(undefined);
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
	const forms = formsQuery.data ?? [];

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
						Start blank, or copy an existing form's fields and design.
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
							<Label htmlFor="new-template-name">Name</Label>
							<Input
								id="new-template-name"
								onChange={(event) => setName(event.target.value)}
								placeholder="e.g. Client intake"
								value={name}
							/>
						</div>
					</TabsContent>
					<TabsContent className="space-y-4 pt-3" value="form">
						<div className="space-y-1.5">
							<Label>Form</Label>
							<Select
								items={forms.map((f) => ({ label: f.title, value: f.id }))}
								onValueChange={(value) => {
									setFormId(value ?? undefined);
									const match = forms.find((f) => f.id === value);
									if (match && !name) {
										setName(match.title);
									}
								}}
								value={formId}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Choose a form" />
								</SelectTrigger>
								<SelectContent>
									{forms.map((f) => (
										<SelectItem key={f.id} value={f.id}>
											{f.title}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
						variant="ghost"
					>
						Cancel
					</Button>
					<Button disabled={pending} onClick={handleSubmit} type="button">
						Create template
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
