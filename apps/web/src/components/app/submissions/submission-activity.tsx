import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	MailIcon,
	PencilIcon,
	ZapIcon,
} from "lucide-react";

import { useTRPC } from "@/utils/trpc";

const TONE_CLASSES = {
	default: "text-muted-foreground",
	error: "text-destructive",
	success: "text-success",
} as const;

/** One row of the submission's activity timeline. */
function TimelineRow({
	icon,
	message,
	time,
	title,
	tone = "default",
}: {
	icon: React.ReactNode;
	message?: string | null;
	time: string;
	title: string;
	tone?: keyof typeof TONE_CLASSES;
}) {
	return (
		<div className="flex gap-2.5">
			<div className={`mt-0.5 ${TONE_CLASSES[tone]}`}>{icon}</div>
			<div className="min-w-0 flex-1 space-y-0.5">
				<div className="flex items-baseline justify-between gap-2">
					<p className="font-medium text-sm">{title}</p>
					<span className="shrink-0 text-muted-foreground text-xs">{time}</span>
				</div>
				{message ? (
					<p className="break-words text-muted-foreground text-xs">{message}</p>
				) : null}
			</div>
		</div>
	);
}

/** "3 hours ago", falling back to the raw timestamp if it can't be parsed. */
function relative(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime())
		? iso
		: formatDistanceToNow(date, { addSuffix: true });
}

/**
 * A timeline of this submission's life: created, edited, and every
 * integration delivery (including email notifications — they run through
 * the same "email" integration) recorded against it. Loaded on its own so
 * opening the submission doesn't wait on it.
 */
export default function SubmissionActivity({
	formId,
	submissionId,
}: {
	formId: string;
	submissionId: string;
}) {
	const trpc = useTRPC();
	const activityQuery = useQuery(
		trpc.submission.activity.queryOptions({ formId, id: submissionId })
	);

	// biome-ignore lint/suspicious/noUnnecessaryConditions: isLoading is a runtime query-status flag
	if (activityQuery.isLoading) {
		return (
			<div className="space-y-2">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}
	const activity = activityQuery.data;
	if (!activity) {
		return (
			<p className="text-muted-foreground text-sm">
				Couldn't load activity for this submission.
			</p>
		);
	}

	const edited = activity.updatedAt !== activity.createdAt;

	return (
		<div className="space-y-3">
			<TimelineRow
				icon={<CheckCircle2Icon className="size-4" />}
				time={relative(activity.createdAt)}
				title="Submitted"
				tone="success"
			/>
			{edited ? (
				<TimelineRow
					icon={<PencilIcon className="size-4" />}
					time={relative(activity.updatedAt)}
					title="Edited"
				/>
			) : null}
			{activity.events.map((event) => (
				<TimelineRow
					icon={
						event.type === "success" ? (
							<ZapIcon className="size-4" />
						) : (
							<AlertTriangleIcon className="size-4" />
						)
					}
					key={event.id}
					message={event.message}
					time={relative(event.createdAt)}
					title={
						event.type === "success"
							? `Sent to ${event.integrationName}`
							: `${event.integrationName} failed`
					}
					tone={event.type === "error" ? "error" : "success"}
				/>
			))}
			{activity.events.length === 0 && !edited ? (
				<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
					<MailIcon className="size-3.5" /> No integration deliveries recorded
					for this submission.
				</p>
			) : null}
		</div>
	);
}
