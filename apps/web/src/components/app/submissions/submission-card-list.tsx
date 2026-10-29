import type { SubmissionDto } from "@StryveForms/api/routers/submission";
import type { FormField } from "@StryveForms/forms/types";
import { formatDistanceToNow } from "date-fns";
import { ChevronRightIcon } from "lucide-react";

import CellValue from "./cell-value";
import SubmissionStatusBadge from "./submission-status-badge";

/** "Submitted 9:14 AM" / "Submitted yesterday" — matches the detail modal's phrasing. */
function SubmittedCaption({ iso }: { iso: string }) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return <span>Submitted {iso}</span>;
	}
	return (
		<span>Submitted {formatDistanceToNow(date, { addSuffix: true })}</span>
	);
}

/** One submission as a tappable card: the form's first couple of fields, status, and timestamp. */
function SubmissionCard({
	fields,
	onClick,
	submission,
}: {
	fields: FormField[];
	onClick: () => void;
	submission: SubmissionDto;
}) {
	const [primaryField, secondaryField, ...restFields] = fields;
	return (
		<button
			className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-xs"
			onClick={onClick}
			type="button"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="truncate font-medium text-sm">
						{primaryField ? (
							<CellValue
								field={primaryField}
								value={submission.data[primaryField.id]}
							/>
						) : (
							`#${submission.publicId}`
						)}
					</p>
					{secondaryField ? (
						<p className="truncate text-muted-foreground text-sm">
							<CellValue
								field={secondaryField}
								value={submission.data[secondaryField.id]}
							/>
						</p>
					) : null}
				</div>
				<SubmissionStatusBadge status={submission.status} />
			</div>
			{restFields.length > 0 ? (
				<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
					{restFields.slice(0, 2).map((field) => (
						<CellValue
							field={field}
							key={field.id}
							value={submission.data[field.id]}
						/>
					))}
				</div>
			) : null}
			<div className="mt-3 flex items-center justify-between border-border border-t pt-2 text-muted-foreground text-xs">
				<SubmittedCaption iso={submission.createdAt} />
				<ChevronRightIcon className="size-4" />
			</div>
		</button>
	);
}

/**
 * Mobile replacement for the submissions table: one card per row, tapping it
 * opens the same submission detail modal. Shown only below the `sm` breakpoint.
 */
export default function SubmissionCardList({
	fields,
	hasFilters,
	items,
	onClearFilters,
	onSelect,
}: {
	fields: FormField[];
	hasFilters: boolean;
	items: SubmissionDto[];
	onClearFilters: () => void;
	onSelect: (id: string) => void;
}) {
	if (items.length === 0) {
		return (
			<div className="rounded-xl border border-border py-16 text-center">
				<p className="font-medium text-sm">
					{hasFilters ? "No matching submissions" : "No submissions yet"}
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					{hasFilters
						? "Try a different search or clear your filters."
						: "New submissions will show up here in real time."}
				</p>
				{hasFilters ? (
					<button
						className="mt-3 font-medium text-primary text-sm"
						onClick={onClearFilters}
						type="button"
					>
						Clear filters
					</button>
				) : null}
			</div>
		);
	}
	return (
		<div className="space-y-3">
			{items.map((submission) => (
				<SubmissionCard
					fields={fields}
					key={submission.id}
					onClick={() => onSelect(submission.id)}
					submission={submission}
				/>
			))}
		</div>
	);
}
