import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CopyIcon,
	DownloadIcon,
	FileIcon,
	MoreHorizontalIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import AddTemplateDialog from "@/components/app/pdf/add-template-dialog";
import { apiBase } from "@/lib/api-url";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/dashboard/forms/$formId/pdf")({
	component: RouteComponent,
});

/** The templates list, or an empty state / loading skeleton. Split out so each state is a plain early return (no nested ternaries). */
function TemplatesTable({
	formId,
	isLoading,
	onAdd,
	onDelete,
	onDuplicate,
	onToggleEnabled,
	templates,
}: {
	formId: string;
	isLoading: boolean;
	onAdd: () => void;
	onDelete: (id: string) => void;
	onDuplicate: (id: string) => void;
	onToggleEnabled: (id: string, enabled: boolean) => void;
	templates: {
		enabled: boolean;
		filenamePattern: string;
		id: string;
		name: string;
		pages: unknown[];
		zones: unknown[];
	}[];
}) {
	if (isLoading) {
		return <Skeleton className="h-48 w-full" />;
	}
	if (templates.length === 0) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
					<FileIcon className="size-8" />
					<p>No PDF templates yet.</p>
					<Button onClick={onAdd} variant="outline">
						<PlusIcon /> Add your first template
					</Button>
				</CardContent>
			</Card>
		);
	}
	return (
		<div className="overflow-hidden rounded-xl border border-border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Filename format</TableHead>
						<TableHead>Pages</TableHead>
						<TableHead>Zones</TableHead>
						<TableHead>Enabled</TableHead>
						<TableHead className="w-10" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{templates.map((template) => (
						<TableRow key={template.id}>
							<TableCell>
								<Link
									className="font-medium hover:underline"
									params={{ formId, templateId: template.id }}
									to="/editor/$formId/pdf/$templateId"
								>
									{template.name}
								</Link>
							</TableCell>
							<TableCell className="font-mono text-muted-foreground text-xs">
								{template.filenamePattern}
							</TableCell>
							<TableCell>{template.pages.length}</TableCell>
							<TableCell>{template.zones.length}</TableCell>
							<TableCell>
								<Switch
									checked={template.enabled}
									onCheckedChange={(checked) =>
										onToggleEnabled(template.id, checked)
									}
								/>
							</TableCell>
							<TableCell>
								<DropdownMenu>
									<DropdownMenuTrigger
										render={<Button size="icon-sm" variant="ghost" />}
									>
										<MoreHorizontalIcon />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											render={
												<Link
													params={{ formId, templateId: template.id }}
													to="/editor/$formId/pdf/$templateId"
												/>
											}
										>
											Edit
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => onDuplicate(template.id)}>
											<CopyIcon /> Duplicate
										</DropdownMenuItem>
										<DropdownMenuItem
											render={
												<a
													href={`${apiBase()}/api/pdf/${template.id}/preview`}
													rel="noopener noreferrer"
													target="_blank"
												/>
											}
										>
											<DownloadIcon /> Download sample
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => onDelete(template.id)}
											variant="destructive"
										>
											<Trash2Icon /> Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

/** Lets the form owner turn the respondent-facing "Download PDF" button on/off and label it. */
function DownloadSettingsCard({ formId }: { formId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const query = useQuery(
		trpc.pdf.getFormDownloadSettings.queryOptions({ formId })
	);
	const [buttonText, setButtonText] = useState("");

	useEffect(() => {
		setButtonText(query.data?.pdfDownloadButtonText ?? "");
	}, [query.data?.pdfDownloadButtonText]);

	const save = useMutation(
		trpc.pdf.updateFormDownloadSettings.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.pdf.getFormDownloadSettings.queryKey({ formId }),
				}),
		})
	);

	if (!query.data) {
		return <Skeleton className="h-24 w-full" />;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Respondent download</CardTitle>
				<CardDescription>
					Let people download a PDF of their own answers right after they submit
					(uses the first enabled template below).
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex items-center gap-3">
					<Switch
						checked={query.data.pdfDownloadEnabled}
						id="pdf-download-enabled"
						onCheckedChange={(checked) =>
							save.mutate({
								formId,
								pdfDownloadButtonText: buttonText || null,
								pdfDownloadEnabled: checked,
							})
						}
					/>
					<Label htmlFor="pdf-download-enabled">
						Show a "Download PDF" button on the success screen
					</Label>
				</div>
				{query.data.pdfDownloadEnabled ? (
					<div className="flex items-center gap-2">
						<Label
							className="text-muted-foreground text-sm"
							htmlFor="pdf-download-text"
						>
							Button text
						</Label>
						<Input
							className="max-w-xs"
							id="pdf-download-text"
							onBlur={() =>
								save.mutate({
									formId,
									pdfDownloadButtonText: buttonText || null,
									pdfDownloadEnabled: true,
								})
							}
							onChange={(e) => setButtonText(e.target.value)}
							placeholder="Download PDF"
							value={buttonText}
						/>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [addOpen, setAddOpen] = useState(false);
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const templatesQuery = useQuery(trpc.pdf.list.queryOptions({ formId }));

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.pdf.list.queryKey({ formId }),
		});

	const toggleEnabled = useMutation(
		trpc.pdf.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: invalidate,
		})
	);
	const duplicate = useMutation(
		trpc.pdf.duplicate.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Template duplicated");
			},
		})
	);
	const remove = useMutation(
		trpc.pdf.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Template deleted");
				setDeleteId(null);
			},
		})
	);

	const templates = templatesQuery.data ?? [];

	return (
		<div className="max-w-4xl space-y-6">
			<DownloadSettingsCard formId={formId} />

			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-medium text-lg">PDF templates</h2>
					<p className="text-muted-foreground text-sm">
						Generate a filled PDF for each submission: a filled contract, a
						certificate, a receipt…
					</p>
				</div>
				<Button onClick={() => setAddOpen(true)}>
					<PlusIcon /> Add template
				</Button>
			</div>

			<TemplatesTable
				formId={formId}
				isLoading={templatesQuery.isLoading}
				onAdd={() => setAddOpen(true)}
				onDelete={setDeleteId}
				onDuplicate={(id) => duplicate.mutate({ id })}
				onToggleEnabled={(id, enabled) => toggleEnabled.mutate({ enabled, id })}
				templates={templates}
			/>

			<AddTemplateDialog
				formId={formId}
				onCreated={async (templateId) => {
					setAddOpen(false);
					await invalidate();
					window.location.href = `/editor/${formId}/pdf/${templateId}`;
				}}
				onOpenChange={setAddOpen}
				open={addOpen}
			/>

			<ConfirmDialog
				description="This permanently removes the template and its zones."
				loading={remove.isPending}
				onConfirm={() => deleteId && remove.mutate({ id: deleteId })}
				onOpenChange={(open) => !open && setDeleteId(null)}
				open={Boolean(deleteId)}
				title="Delete this PDF template?"
			/>
		</div>
	);
}
