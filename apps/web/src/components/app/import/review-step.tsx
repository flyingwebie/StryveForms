import type {
	FormPreview,
	ImportPreview,
	PreviewField,
} from "@StryveForms/api/services/import/preview";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@StryveForms/ui/components/accordion";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { Progress } from "@StryveForms/ui/components/progress";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@StryveForms/ui/components/table";
import { cn } from "@StryveForms/ui/lib/utils";
import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	CheckCircle2Icon,
	ClockIcon,
	DownloadIcon,
	FileStackIcon,
	FileTextIcon,
	InboxIcon,
	InfoIcon,
	PaperclipIcon,
	PlugIcon,
	RefreshCwIcon,
	SparklesIcon,
	XCircleIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { formatBytes, formatDuration, plural } from "./format";

const STATUS_BADGE: Record<
	PreviewField["status"],
	{ label: string; variant: "info" | "success" | "neutral" }
> = {
	converted: { label: "Converted", variant: "success" },
	ok: { label: "Ready", variant: "info" },
	skipped: { label: "Skipped", variant: "neutral" },
};

function filesHint(files: number | null, size: number | null) {
	if (files === null) {
		return "Counted while importing";
	}
	return size ? formatBytes(size) : undefined;
}

function needsAttention(form: FormPreview): boolean {
	return (
		Boolean(form.error) ||
		form.fields.some((f) => f.status !== "ok") ||
		form.integrations.some((i) => !(i.supported && !i.note))
	);
}

function Stat({
	hint,
	icon,
	label,
	value,
}: {
	hint?: ReactNode;
	icon: ReactNode;
	label: string;
	value: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
			<div className="flex items-center gap-2 text-muted-foreground text-xs">
				<span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:size-3.5">
					{icon}
				</span>
				{label}
			</div>
			<div className="font-semibold text-2xl tabular-nums tracking-tight">
				{value}
			</div>
			{hint ? (
				<div className="text-muted-foreground text-xs">{hint}</div>
			) : null}
		</div>
	);
}

function ApiUsage({
	usage,
}: {
	usage: NonNullable<ImportPreview["apiUsage"]>;
}) {
	const { needed, remaining } = usage;
	if (remaining === null) {
		return null;
	}
	const enough = needed <= remaining;
	const percent = Math.min(
		100,
		Math.round((needed / Math.max(1, remaining)) * 100)
	);
	return (
		<div className="rounded-xl border bg-card p-4">
			<div className="flex items-center justify-between gap-3 text-sm">
				<span className="font-medium">JotForm API calls</span>
				<span className="text-muted-foreground tabular-nums">
					~{needed.toLocaleString()} needed · {remaining.toLocaleString()} left
					today
				</span>
			</div>
			<Progress
				className={cn(
					"mt-3",
					enough ? "" : "[&_[data-slot=progress-indicator]]:bg-destructive"
				)}
				value={percent}
			/>
			<p className="mt-2 text-muted-foreground text-xs">
				{enough
					? "Enough for this import. Downloading files doesn't use API calls."
					: "Not enough calls left today. Import fewer forms now and the rest tomorrow — nothing is duplicated when you run it again."}
			</p>
		</div>
	);
}

function FieldTable({ fields }: { fields: PreviewField[] }) {
	if (fields.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">This form has no fields.</p>
		);
	}
	return (
		<div className="overflow-hidden rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow className="bg-muted/40">
						<TableHead>Field</TableHead>
						<TableHead>From</TableHead>
						<TableHead />
						<TableHead>Becomes</TableHead>
						<TableHead className="text-right">Status</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{fields.map((field) => {
						const badge = STATUS_BADGE[field.status];
						return (
							<TableRow key={field.id}>
								<TableCell className="max-w-56">
									<div className="truncate font-medium">{field.label}</div>
									{field.note ? (
										<div className="whitespace-normal text-muted-foreground text-xs">
											{field.note}
										</div>
									) : null}
								</TableCell>
								<TableCell className="text-muted-foreground text-xs">
									{field.sourceType}
								</TableCell>
								<TableCell className="w-6 px-0 text-muted-foreground">
									<ArrowRightIcon className="size-3.5" />
								</TableCell>
								<TableCell className="font-mono text-xs">
									{field.targetType ?? "—"}
								</TableCell>
								<TableCell className="text-right">
									<Badge variant={badge.variant}>{badge.label}</Badge>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

function FormRow({ form }: { form: FormPreview }) {
	const converted = form.fields.filter((f) => f.status === "converted").length;
	const skipped = form.fields.filter((f) => f.status === "skipped").length;
	const attention = needsAttention(form);
	return (
		<AccordionItem className="border-b last:border-b-0" value={form.sourceId}>
			<AccordionTrigger className="px-4 py-3 hover:no-underline">
				<div className="flex min-w-0 flex-1 items-center gap-3 text-left">
					<span
						className={cn(
							"flex size-8 shrink-0 items-center justify-center rounded-lg",
							attention
								? "bg-warning-soft text-warning"
								: "bg-success-soft text-success"
						)}
					>
						{attention ? (
							<AlertTriangleIcon className="size-4" />
						) : (
							<CheckCircle2Icon className="size-4" />
						)}
					</span>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="truncate font-medium">{form.title}</span>
							{form.action === "update" ? (
								<Badge variant="secondary">
									<RefreshCwIcon /> Update
								</Badge>
							) : (
								<Badge variant="outline">
									<SparklesIcon /> New
								</Badge>
							)}
						</div>
						<div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
							<span>→ {form.targetWorkspace}</span>
							<span>{plural(form.fields.length, "field")}</span>
							<span>{plural(form.submissions, "submission")}</span>
							{form.files === null ? null : (
								<span>
									{plural(form.files, "file")}
									{form.filesSize ? ` · ${formatBytes(form.filesSize)}` : ""}
								</span>
							)}
							{converted > 0 ? (
								<span className="text-success">{converted} converted</span>
							) : null}
							{skipped > 0 ? <span>{skipped} skipped</span> : null}
						</div>
					</div>
				</div>
			</AccordionTrigger>
			<AccordionContent className="space-y-4 px-4 pb-4">
				{form.error ? (
					<Alert variant="destructive">
						<XCircleIcon />
						<AlertTitle>Couldn't analyse this form</AlertTitle>
						<AlertDescription>
							{form.error} It can still be imported.
						</AlertDescription>
					</Alert>
				) : null}
				{form.warnings.length > 0 ? (
					<ul className="space-y-1.5">
						{form.warnings.map((warning) => (
							<li
								className="flex items-start gap-2 text-muted-foreground text-sm"
								key={warning}
							>
								<InfoIcon className="mt-0.5 size-3.5 shrink-0" />
								{warning}
							</li>
						))}
					</ul>
				) : null}
				<FieldTable fields={form.fields} />
				{form.integrations.length > 0 ? (
					<div className="space-y-2">
						<h4 className="font-medium text-sm">Integrations</h4>
						<div className="flex flex-wrap gap-2">
							{form.integrations.map((integration) => (
								<div
									className={cn(
										"flex max-w-full items-start gap-2 rounded-lg border px-3 py-2 text-sm",
										integration.supported ? "" : "border-dashed opacity-80"
									)}
									key={integration.id}
								>
									<PlugIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
									<div className="min-w-0">
										<div className="font-medium capitalize">
											{integration.name.replaceAll("_", " ")}
											{integration.supported ? null : (
												<span className="ml-1.5 font-normal text-muted-foreground text-xs normal-case">
													not imported
												</span>
											)}
										</div>
										{integration.note ? (
											<div className="text-muted-foreground text-xs">
												{integration.note}
											</div>
										) : null}
									</div>
								</div>
							))}
						</div>
					</div>
				) : null}
			</AccordionContent>
		</AccordionItem>
	);
}

export default function ReviewStep({
	onBack,
	onStart,
	options,
	preview,
	starting,
}: {
	onBack: () => void;
	onStart: () => void;
	/** Summary of the chosen options, shown next to the start button. */
	options: string[];
	preview: ImportPreview;
	starting: boolean;
}) {
	const [attentionOnly, setAttentionOnly] = useState<boolean>(false);
	const { totals } = preview;
	const forms = attentionOnly
		? preview.forms.filter(needsAttention)
		: preview.forms;
	const attentionCount = preview.forms.filter(needsAttention).length;

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg">Review your import</h2>
				<p className="text-muted-foreground text-sm">
					Nothing has been copied yet. Check what will happen, then start the
					import.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
				<Stat
					hint={[
						totals.create ? `${totals.create} new` : null,
						totals.update ? `${totals.update} updated` : null,
					]
						.filter(Boolean)
						.join(" · ")}
					icon={<FileTextIcon />}
					label="Forms"
					value={totals.forms}
				/>
				<Stat
					hint={
						totals.converted || totals.skipped
							? `${totals.converted} converted · ${totals.skipped} skipped`
							: "All fields map directly"
					}
					icon={<FileStackIcon />}
					label="Fields"
					value={totals.fields}
				/>
				<Stat
					icon={<InboxIcon />}
					label="Submissions"
					value={totals.submissions.toLocaleString()}
				/>
				<Stat
					hint={filesHint(totals.files, totals.filesSize)}
					icon={<PaperclipIcon />}
					label="Files"
					value={totals.files === null ? "—" : totals.files.toLocaleString()}
				/>
				<Stat
					hint={
						totals.unsupportedIntegrations
							? `${totals.unsupportedIntegrations} can't be imported`
							: undefined
					}
					icon={<PlugIcon />}
					label="Integrations"
					value={totals.integrations}
				/>
				<Stat
					icon={<ClockIcon />}
					label="Est. time"
					value={formatDuration(preview.estimatedSeconds)}
				/>
			</div>

			{preview.notes.length > 0 ? (
				<Alert>
					<InfoIcon />
					<AlertTitle>Good to know</AlertTitle>
					<AlertDescription>
						<ul className="list-disc space-y-1 pl-4">
							{preview.notes.map((note) => (
								<li key={note}>{note}</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			) : null}

			{preview.apiUsage ? <ApiUsage usage={preview.apiUsage} /> : null}

			<div className="space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className="font-medium">Forms</h3>
					{attentionCount > 0 ? (
						<label
							className="flex items-center gap-2 text-muted-foreground text-sm"
							htmlFor="review-attention-only"
						>
							<Switch
								checked={attentionOnly}
								id="review-attention-only"
								onCheckedChange={setAttentionOnly}
							/>
							Only show forms that need attention ({attentionCount})
						</label>
					) : (
						<span className="flex items-center gap-1.5 text-sm text-success">
							<CheckCircle2Icon className="size-4" /> Everything maps cleanly
						</span>
					)}
				</div>
				<Accordion className="overflow-hidden rounded-xl border bg-card">
					{forms.map((form) => (
						<FormRow form={form} key={form.sourceId} />
					))}
				</Accordion>
			</div>

			<div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t bg-background/90 px-1 py-4 backdrop-blur">
				<Button onClick={onBack} variant="outline">
					<ArrowLeftIcon />
					Back
				</Button>
				<div className="flex flex-wrap items-center gap-3">
					<span className="hidden text-muted-foreground text-xs sm:inline">
						{options.join(" · ")}
					</span>
					<Button disabled={starting} onClick={onStart}>
						<DownloadIcon />
						{starting
							? "Starting…"
							: `Start import (${plural(totals.forms, "form")})`}
					</Button>
				</div>
			</div>
		</div>
	);
}
