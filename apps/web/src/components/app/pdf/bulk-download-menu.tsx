import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { apiBase } from "@/lib/api-url";

const FILENAME_PATTERN = /filename="([^"]+)"/;

async function downloadBlob(url: string, body: unknown, loadingLabel: string) {
	const toastId = toast.loading(loadingLabel);
	try {
		const res = await fetch(url, {
			body: JSON.stringify(body),
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		if (!res.ok) {
			const json = await res
				.json()
				.catch(() => ({ message: "Download failed" }));
			throw new Error(json.message ?? "Download failed");
		}
		const blob = await res.blob();
		const filename =
			res.headers.get("content-disposition")?.match(FILENAME_PATTERN)?.[1] ??
			"submissions.zip";
		const objectUrl = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = objectUrl;
		link.download = filename;
		document.body.append(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(objectUrl);
		toast.success("Download ready", { id: toastId });
	} catch (error) {
		toast.error(error instanceof Error ? error.message : "Download failed", {
			id: toastId,
		});
	}
}

export interface SubmissionFilters {
	from?: string;
	search?: string;
	status: "all" | "completed" | "partial";
	to?: string;
}

function downloadLabel(selectedCount: number): string {
	if (selectedCount === 1) {
		return "Download PDF";
	}
	if (selectedCount > 1) {
		return `Download ${selectedCount} as ZIP`;
	}
	return "Download all as ZIP";
}

/**
 * "Download PDF(s)": one submission downloads a single PDF directly; several
 * (or none, meaning "every submission matching the current filters") build a
 * ZIP server-side. Shows a template picker when more than one is enabled.
 */
export default function BulkDownloadMenu({
	filters,
	selectedIds,
	templates,
}: {
	filters: SubmissionFilters;
	selectedIds: string[];
	templates: { id: string; name: string }[];
}) {
	if (templates.length === 0) {
		return null;
	}

	function handlePick(templateId: string) {
		if (selectedIds.length === 1) {
			window.location.href = `${apiBase()}/api/pdf/${templateId}/download?submissionId=${selectedIds[0]}`;
			return;
		}
		const url = `${apiBase()}/api/pdf/${templateId}/bulk`;
		if (selectedIds.length > 1) {
			downloadBlob(
				url,
				{ ids: selectedIds },
				`Generating ${selectedIds.length} PDFs…`
			);
		} else {
			downloadBlob(
				url,
				{ filters },
				"Generating PDFs for all matching submissions…"
			);
		}
	}

	const label = downloadLabel(selectedIds.length);

	if (templates.length === 1) {
		return (
			<Button
				onClick={() => handlePick(templates[0].id)}
				size="sm"
				variant="outline"
			>
				<DownloadIcon /> {label}
			</Button>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
				<DownloadIcon /> {label}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{templates.map((template) => (
					<DropdownMenuItem
						key={template.id}
						onClick={() => handlePick(template.id)}
					>
						{template.name}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
