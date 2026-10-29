import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Field, FieldLabel } from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { useMutation } from "@tanstack/react-query";
import { FileTextIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { apiBase } from "@/lib/api-url";
import { useTRPC } from "@/utils/trpc";

type Orientation = "portrait" | "landscape";
type PageSize = "A4" | "Letter";
const PDF_EXTENSION = /\.pdf$/i;

/** "Add template": upload a base PDF, or start from blank A4/Letter pages. */
export default function AddTemplateDialog({
	formId,
	onCreated,
	onOpenChange,
	open,
}: {
	formId: string;
	onCreated: (templateId: string) => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const trpc = useTRPC();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [uploadName, setUploadName] = useState("");
	const [uploading, setUploading] = useState(false);

	const [scratchName, setScratchName] = useState("");
	const [pageSize, setPageSize] = useState<PageSize>("A4");
	const [orientation, setOrientation] = useState<Orientation>("portrait");
	const [pageCount, setPageCount] = useState(1);
	const [autoGenerateZones, setAutoGenerateZones] = useState(true);

	const createFromUpload = useMutation(
		trpc.pdf.createFromUpload.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (row) => {
				toast.success("Template created");
				onCreated(row.id);
			},
		})
	);
	const createBlank = useMutation(
		trpc.pdf.createBlank.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (row) => {
				toast.success("Template created");
				onCreated(row.id);
			},
		})
	);

	async function handleUpload() {
		const file = fileInputRef.current?.files?.[0];
		if (!file) {
			toast.error("Choose a PDF file first");
			return;
		}
		setUploading(true);
		try {
			const body = new FormData();
			body.set("file", file);
			body.set("formId", formId);
			const res = await fetch(`${apiBase()}/api/pdf-templates/upload`, {
				body,
				credentials: "include",
				method: "POST",
			});
			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.message ?? "Upload failed");
			}
			createFromUpload.mutate({
				formId,
				name: uploadName || file.name.replace(PDF_EXTENSION, ""),
				pages: json.pages,
				sourceFileKey: json.sourceFileKey,
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	}

	function handleCreateBlank() {
		if (!scratchName.trim()) {
			toast.error("Give the template a name");
			return;
		}
		createBlank.mutate({
			autoGenerateZones,
			formId,
			name: scratchName.trim(),
			orientation,
			pageCount,
			pageSize,
		});
	}

	const busy = uploading || createFromUpload.isPending || createBlank.isPending;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add a PDF template</DialogTitle>
					<DialogDescription>
						Upload a PDF to fill in, or start from blank pages.
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="upload">
					<TabsList>
						<TabsTrigger value="upload">
							<UploadIcon /> Upload PDF
						</TabsTrigger>
						<TabsTrigger value="scratch">
							<FileTextIcon /> Create from scratch
						</TabsTrigger>
					</TabsList>

					<TabsContent className="space-y-4" value="upload">
						<Field>
							<FieldLabel htmlFor="pdf-upload-name">Template name</FieldLabel>
							<Input
								id="pdf-upload-name"
								onChange={(e) => setUploadName(e.target.value)}
								placeholder="Invoice"
								value={uploadName}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="pdf-upload-file">PDF file</FieldLabel>
							<Input
								accept="application/pdf"
								id="pdf-upload-file"
								ref={fileInputRef}
								type="file"
							/>
							<p className="text-muted-foreground text-xs">
								Up to 20 MB. You'll place zones on it in the editor next.
							</p>
						</Field>
						<DialogFooter>
							<Button disabled={busy} onClick={handleUpload}>
								{busy ? "Uploading…" : "Upload and continue"}
							</Button>
						</DialogFooter>
					</TabsContent>

					<TabsContent className="space-y-4" value="scratch">
						<Field>
							<FieldLabel htmlFor="pdf-scratch-name">Template name</FieldLabel>
							<Input
								id="pdf-scratch-name"
								onChange={(e) => setScratchName(e.target.value)}
								placeholder="Confirmation letter"
								value={scratchName}
							/>
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel>Page size</FieldLabel>
								<Select
									items={[
										{ label: "A4", value: "A4" },
										{ label: "Letter", value: "Letter" },
									]}
									onValueChange={(value) => setPageSize(value as PageSize)}
									value={pageSize}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="A4">A4</SelectItem>
										<SelectItem value="Letter">Letter</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel>Orientation</FieldLabel>
								<Select
									items={[
										{ label: "Portrait", value: "portrait" },
										{ label: "Landscape", value: "landscape" },
									]}
									onValueChange={(value) =>
										setOrientation(value as Orientation)
									}
									value={orientation}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="portrait">Portrait</SelectItem>
										<SelectItem value="landscape">Landscape</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor="pdf-scratch-pages">Pages</FieldLabel>
							<Input
								id="pdf-scratch-pages"
								max={20}
								min={1}
								onChange={(e) =>
									setPageCount(
										Math.min(20, Math.max(1, Number(e.target.value) || 1))
									)
								}
								type="number"
								value={pageCount}
							/>
						</Field>
						<div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
							<div>
								<Label htmlFor="pdf-auto-zones">
									Auto-generate zones for each field
								</Label>
								<p className="text-muted-foreground text-xs">
									Lays out a label and answer for every question, like a summary
									page.
								</p>
							</div>
							<Switch
								checked={autoGenerateZones}
								id="pdf-auto-zones"
								onCheckedChange={setAutoGenerateZones}
							/>
						</div>
						<DialogFooter>
							<Button disabled={busy} onClick={handleCreateBlank}>
								{busy ? "Creating…" : "Create and continue"}
							</Button>
						</DialogFooter>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
