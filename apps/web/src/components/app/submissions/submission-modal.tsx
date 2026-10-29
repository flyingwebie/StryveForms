import type { FormDto } from "@StryveForms/api/lib/serialize";
import type { SubmissionDto } from "@StryveForms/api/routers/submission";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
} from "@StryveForms/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import { ScrollArea } from "@StryveForms/ui/components/scroll-area";
import { Separator } from "@StryveForms/ui/components/separator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
	BracesIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ClockIcon,
	CopyIcon,
	DownloadIcon,
	ExternalLinkIcon,
	MonitorSmartphoneIcon,
	PencilIcon,
	PrinterIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { apiBase } from "@/lib/api-url";
import { useTRPC } from "@/utils/trpc";
import ConfirmDialog from "../confirm-dialog";
import AnswerValue from "./answer-value";
import CopyButton from "./copy-button";
import SubmissionActivity from "./submission-activity";
import SubmissionFieldInput from "./submission-field-input";
import {
	answerToText,
	answerValueText,
	formatCompletionTime,
	formatDeviceLabel,
	type ParsedDevice,
} from "./submission-format";
import {
	buildSubmissionSections,
	type SubmissionSection,
} from "./submission-sections";

function isAnswerEmpty(value: unknown) {
	return value === undefined || value === null || value === "";
}

/** `https://example.com/path` → `example.com`; falls back to the raw string. */
function hostnameOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

/** "Download PDF": a direct link when there's one enabled template, a menu when there are several. */
function DownloadPdfAction({
	formId,
	submissionId,
}: {
	formId: string;
	submissionId: string;
}) {
	const trpc = useTRPC();
	const templatesQuery = useQuery(trpc.pdf.list.queryOptions({ formId }));
	const templates = (templatesQuery.data ?? []).filter((t) => t.enabled);
	if (templates.length === 0) {
		return null;
	}
	const downloadUrl = (templateId: string) =>
		`${apiBase()}/api/pdf/${templateId}/download?submissionId=${submissionId}`;
	if (templates.length === 1) {
		return (
			<Button
				render={<a href={downloadUrl(templates[0].id)} />}
				size="sm"
				variant="outline"
			>
				<DownloadIcon /> Download PDF
			</Button>
		);
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
				<DownloadIcon /> Download PDF
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{templates.map((template) => (
					<DropdownMenuItem
						key={template.id}
						render={<a href={downloadUrl(template.id)} />}
					>
						{template.name}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function DetailRow({
	copyLabel,
	label,
	value,
}: {
	/** When set, shows a copy button next to the value, labeled for screen readers. */
	copyLabel?: string;
	label: string;
	value: string;
}) {
	return (
		<div className="space-y-1">
			<span className="block text-muted-foreground text-xs">{label}</span>
			<div className="flex items-center justify-between gap-2">
				<span className="truncate text-sm">{value}</span>
				{copyLabel ? <CopyButton label={copyLabel} text={value} /> : null}
			</div>
		</div>
	);
}

/** Submission id, respondent edit link, IP/source, and device/browser. */
function DetailsPanel({
	form,
	submission,
}: {
	form: FormDto;
	submission: SubmissionDto;
}) {
	const meta = (submission.meta ?? {}) as Record<string, unknown>;
	const ip = typeof meta.ip_address === "string" ? meta.ip_address : null;
	const device = (meta.device ?? null) as ParsedDevice | null;
	const referrer = typeof meta.referrer === "string" ? meta.referrer : null;
	const attribution =
		meta.attribution && typeof meta.attribution === "object"
			? (meta.attribution as Record<string, string>)
			: null;
	const editUrl = form.editableSubmissions
		? `${form.shareUrl}?submission_id=${submission.publicId}`
		: null;

	return (
		<div className="space-y-4">
			<h3 className="font-medium text-sm">Details</h3>
			<DetailRow
				copyLabel="Copy submission id"
				label="Submission ID"
				value={submission.publicId}
			/>
			{editUrl ? (
				<div className="space-y-1">
					<span className="block text-muted-foreground text-xs">
						Respondent's edit link — lets them come back and change their
						answers
					</span>
					<div className="flex items-center gap-1">
						<a
							className="flex-1 truncate text-primary text-xs underline underline-offset-2"
							href={editUrl}
							rel="noopener noreferrer"
							target="_blank"
						>
							{editUrl}
						</a>
						<CopyButton label="Copy edit link" text={editUrl} />
						<Button
							render={
								<a href={editUrl} rel="noopener noreferrer" target="_blank" />
							}
							size="icon-xs"
							variant="ghost"
						>
							<ExternalLinkIcon className="size-3.5" />
							<span className="sr-only">Open edit link</span>
						</Button>
					</div>
				</div>
			) : null}
			<DetailRow
				label="IP address"
				value={ip ?? "Not recorded"}
				{...(ip ? { copyLabel: "Copy IP address" } : {})}
			/>
			<DetailRow label="Device & browser" value={formatDeviceLabel(device)} />
			{referrer ? (
				<DetailRow label="Referrer" value={hostnameOf(referrer)} />
			) : null}
			{attribution && Object.keys(attribution).length > 0 ? (
				<div className="space-y-1.5">
					<span className="block text-muted-foreground text-xs">
						Source / attribution — tracking parameters present on the form URL
						when they submitted
					</span>
					<div className="flex flex-wrap gap-1">
						{Object.entries(attribution).map(([key, value]) => (
							<Badge key={key} variant="outline">
								{key}: {value}
							</Badge>
						))}
					</div>
				</div>
			) : null}
		</div>
	);
}

function SectionAnswers({
	hideEmpty,
	section,
	submission,
}: {
	hideEmpty: boolean;
	section: SubmissionSection;
	submission: SubmissionDto;
}) {
	const visible = hideEmpty
		? section.fields.filter(
				(field) => !isAnswerEmpty(submission.data[field.id])
			)
		: section.fields;
	if (visible.length === 0) {
		return null;
	}
	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2">
				<h3 className="font-medium text-sm">{section.title}</h3>
				{section.kind === "hidden" || section.kind === "removed" ? (
					<Badge variant="outline">
						{section.kind === "hidden" ? "Hidden" : "Removed"}
					</Badge>
				) : null}
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{visible.map((field) => {
					const value = submission.data[field.id];
					return (
						<div className="space-y-1.5" key={field.id}>
							<div className="flex items-center justify-between gap-2">
								<span className="block font-medium text-muted-foreground text-xs">
									{field.name}
								</span>
								{isAnswerEmpty(value) ? null : (
									<CopyButton
										label={`Copy ${field.name}`}
										text={answerValueText(field, value)}
									/>
								)}
							</div>
							<AnswerValue field={field} value={value} />
						</div>
					);
				})}
			</div>
		</div>
	);
}

/** "3 hours ago" with the absolute timestamp as a title tooltip. */
function RelativeTime({ iso }: { iso: string }) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return <span>{iso}</span>;
	}
	return (
		<span title={format(date, "PPpp")}>
			{formatDistanceToNow(date, { addSuffix: true })}
		</span>
	);
}

export interface SubmissionModalProps {
	/** Field/column ids in the order the submissions table currently shows them (used only while editing). */
	fieldOrder?: string[];
	form: FormDto;
	hasNext: boolean;
	hasPrev: boolean;
	onClose: () => void;
	onNext: () => void;
	onPrev: () => void;
	/** e.g. "3 of 42", respecting the table's current filters/search/sort. */
	positionLabel: string | null;
	submission: SubmissionDto | null;
}

/**
 * The full submission detail view: header with status/timing and prev/next
 * navigation, answers grouped into the form's own sections, a details +
 * activity sidebar, and actions (edit, PDF, copy, print, delete).
 */
export default function SubmissionModal({
	fieldOrder,
	form,
	hasNext,
	hasPrev,
	onClose,
	onNext,
	onPrev,
	positionLabel,
	submission,
}: SubmissionModalProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState<Record<string, unknown>>({});
	const [hideEmpty, setHideEmpty] = useState(false);
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

	useEffect(() => {
		setEditing(false);
		setDraft(submission?.data ?? {});
	}, [submission]);

	// Prev/Next by ← → keys, same as the on-screen buttons, except while
	// editing or while focus is in a text input. Registered on the capture
	// phase: Base UI's dialog focus trap stops a plain bubble-phase listener
	// from ever seeing the key (verified — a bubble listener on `window`
	// never fires while the dialog is open, but a capture listener does).
	useEffect(() => {
		if (!submission || editing) {
			return;
		}
		const handler = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (
				target?.isContentEditable ||
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA"
			) {
				return;
			}
			if (event.key === "ArrowLeft" && hasPrev) {
				onPrev();
			} else if (event.key === "ArrowRight" && hasNext) {
				onNext();
			}
		};
		window.addEventListener("keydown", handler, { capture: true });
		return () =>
			window.removeEventListener("keydown", handler, { capture: true });
	}, [submission, editing, hasPrev, hasNext, onPrev, onNext]);

	const properties = form.properties as FormField[];
	const removedProperties = form.removedProperties as FormField[];
	const sections = useMemo(
		() => buildSubmissionSections(properties, removedProperties),
		[properties, removedProperties]
	);

	const editFields = useMemo(() => {
		const unordered = answerFields(properties, removedProperties);
		const rank = (id: string) => {
			const index = fieldOrder?.indexOf(id) ?? -1;
			return index === -1 ? Number.POSITIVE_INFINITY : index;
		};
		return fieldOrder
			? [...unordered].sort((a, b) => rank(a.id) - rank(b.id))
			: unordered;
	}, [properties, removedProperties, fieldOrder]);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.submission.list.queryKey(),
		});

	const update = useMutation(
		trpc.submission.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Submission updated");
				setEditing(false);
			},
		})
	);
	const remove = useMutation(
		trpc.submission.delete.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Submission deleted");
				onClose();
			},
		})
	);

	const completionLabel = submission
		? formatCompletionTime(submission.completionTime)
		: null;
	const edited = Boolean(
		submission && submission.updatedAt !== submission.createdAt
	);

	const copyAsText = async () => {
		if (!submission) {
			return;
		}
		const lines = sections.flatMap((section) => [
			`${section.title}`,
			...section.fields.map((field) =>
				answerToText(field, submission.data[field.id])
			),
			"",
		]);
		try {
			await navigator.clipboard.writeText(lines.join("\n").trim());
			toast.success("Copied as text");
		} catch {
			toast.error("Couldn't copy to clipboard");
		}
	};
	const copyAsJson = async () => {
		if (!submission) {
			return;
		}
		const obj: Record<string, unknown> = {};
		for (const section of sections) {
			for (const field of section.fields) {
				obj[field.name] = submission.data[field.id] ?? null;
			}
		}
		try {
			await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
			toast.success("Copied as JSON");
		} catch {
			toast.error("Couldn't copy to clipboard");
		}
	};

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			open={Boolean(submission)}
		>
			{/* The dialog shell stays mounted even as `submission` briefly turns
			    null (closing, or navigating to an adjacent one), so Base UI's
			    own open/close transition plays instead of an abrupt unmount. */}
			<DialogContent
				// True edge-to-edge (no margin, square corners) below `sm`; a
				// large, rounded, centered panel from `sm` up.
				className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 rounded-none p-0 sm:h-[90vh] sm:max-h-[90vh] sm:w-full sm:max-w-3xl sm:rounded-xl lg:max-w-5xl print:h-auto print:max-h-none"
				showCloseButton={false}
			>
				{submission ? (
					<>
						{/* Header: form title, status, timing, and prev/next navigation. */}
						<div className="flex items-start justify-between gap-4 border-border border-b p-5">
							<div className="min-w-0 space-y-1.5">
								<div className="flex flex-wrap items-center gap-2">
									<h2 className="font-heading font-medium text-base">
										{form.title}
									</h2>
									<Badge variant="outline">
										#{submission.publicId.slice(0, 8).toUpperCase()}
									</Badge>
									<Badge
										className="capitalize"
										variant={
											submission.status === "completed"
												? "default"
												: "secondary"
										}
									>
										{submission.status}
									</Badge>
								</div>
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
									<span>
										Submitted <RelativeTime iso={submission.createdAt} />
									</span>
									{edited ? (
										<span>
											· Edited <RelativeTime iso={submission.updatedAt} />
										</span>
									) : null}
									{completionLabel ? (
										<span className="flex items-center gap-1">
											<ClockIcon className="size-3" /> {completionLabel}
										</span>
									) : null}
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								<Button
									disabled={!hasPrev}
									onClick={onPrev}
									size="icon-sm"
									variant="outline"
								>
									<ChevronLeftIcon />
									<span className="sr-only">Previous submission</span>
								</Button>
								{positionLabel ? (
									<span className="whitespace-nowrap px-1 text-muted-foreground text-xs tabular-nums">
										{positionLabel}
									</span>
								) : null}
								<Button
									disabled={!hasNext}
									onClick={onNext}
									size="icon-sm"
									variant="outline"
								>
									<ChevronRightIcon />
									<span className="sr-only">Next submission</span>
								</Button>
								<DialogClose
									render={
										<Button className="ml-1" size="icon-sm" variant="ghost" />
									}
								>
									<XIcon />
									<span className="sr-only">Close</span>
								</DialogClose>
							</div>
						</div>

						{/* Body: answers (main) + details/activity (sidebar), in one scroll area. */}
						<div className="flex-1 overflow-hidden">
							<ScrollArea className="h-full">
								<div className="grid grid-cols-1 gap-8 p-5 pb-24 md:grid-cols-[1fr_300px]">
									<div className="min-w-0 space-y-6">
										{editing ? (
											<div className="space-y-4">
												{editFields.map((field) => (
													<div className="space-y-1.5" key={field.id}>
														<span className="block text-muted-foreground text-xs">
															{field.name}
														</span>
														<SubmissionFieldInput
															field={field}
															onChange={(value) =>
																setDraft({ ...draft, [field.id]: value })
															}
															value={draft[field.id]}
														/>
													</div>
												))}
											</div>
										) : (
											<>
												<div className="flex items-center justify-end gap-2 print:hidden">
													<Checkbox
														checked={hideEmpty}
														id="hide-empty-answers"
														onCheckedChange={(checked) =>
															setHideEmpty(checked === true)
														}
													/>
													<label
														className="text-muted-foreground text-xs"
														htmlFor="hide-empty-answers"
													>
														Hide empty answers
													</label>
												</div>
												{sections.map((section) => (
													<SectionAnswers
														hideEmpty={hideEmpty}
														key={section.title + section.kind}
														section={section}
														submission={submission}
													/>
												))}
											</>
										)}
									</div>
									<div className="min-w-0 space-y-6 print:hidden">
										<DetailsPanel form={form} submission={submission} />
										<Separator />
										<div className="space-y-3">
											<h3 className="flex items-center gap-1.5 font-medium text-sm">
												<MonitorSmartphoneIcon className="size-4" /> Activity
											</h3>
											<SubmissionActivity
												formId={form.id}
												submissionId={submission.id}
											/>
										</div>
									</div>
								</div>
							</ScrollArea>
						</div>

						{/* Footer actions. */}
						<div className="flex flex-wrap items-center justify-between gap-2 border-border border-t p-4 print:hidden">
							<div className="flex flex-wrap items-center gap-2">
								<Button
									className="text-destructive"
									onClick={() => setConfirmDeleteOpen(true)}
									size="sm"
									variant="ghost"
								>
									<Trash2Icon /> Delete
								</Button>
								<DownloadPdfAction
									formId={form.id}
									submissionId={submission.id}
								/>
								<Button onClick={copyAsText} size="sm" variant="outline">
									<CopyIcon /> Copy as text
								</Button>
								<Button onClick={copyAsJson} size="sm" variant="outline">
									<BracesIcon /> Copy as JSON
								</Button>
								<Button
									onClick={() => window.print()}
									size="sm"
									variant="outline"
								>
									<PrinterIcon /> Print
								</Button>
							</div>
							{editing ? (
								<div className="flex gap-2">
									<Button
										onClick={() => setEditing(false)}
										size="sm"
										variant="outline"
									>
										Cancel
									</Button>
									<Button
										disabled={update.isPending}
										onClick={() =>
											update.mutate({
												data: draft,
												formId: form.id,
												id: submission.id,
											})
										}
										size="sm"
									>
										{update.isPending ? "Saving…" : "Save"}
									</Button>
								</div>
							) : (
								<Button onClick={() => setEditing(true)} size="sm">
									<PencilIcon /> Edit answers
								</Button>
							)}
						</div>
					</>
				) : null}
			</DialogContent>

			<ConfirmDialog
				description="This permanently removes the submission and its answers."
				loading={remove.isPending}
				onConfirm={() =>
					submission && remove.mutate({ formId: form.id, ids: [submission.id] })
				}
				onOpenChange={setConfirmDeleteOpen}
				open={confirmDeleteOpen}
				title="Delete this submission?"
			/>
		</Dialog>
	);
}
