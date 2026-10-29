import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { format } from "date-fns";
import { InboxIcon, type LucideIcon, StarIcon } from "lucide-react";

interface DistributionItem {
	count: number;
	percentage: number;
	value: string;
}

export interface FieldSummary {
	answeredCount: number;
	data: Record<string, unknown>;
	id: string;
	name: string;
	summaryType: string;
	type: string;
}

/** Small centered placeholder for a card with nothing to show yet. */
function EmptyMini({
	icon: Icon = InboxIcon,
	text = "No answers yet",
}: {
	icon?: LucideIcon;
	text?: string;
}) {
	return (
		<div className="flex flex-col items-center gap-2 py-6 text-center">
			<span className="flex size-9 items-center justify-center rounded-full bg-muted">
				<Icon className="size-4 text-muted-foreground" />
			</span>
			<p className="text-muted-foreground text-sm">{text}</p>
		</div>
	);
}

function DistributionBar({ item }: { item: DistributionItem }) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between gap-2 text-sm">
				<span className="truncate">{item.value}</span>
				<span className="shrink-0 text-muted-foreground">
					{item.count.toLocaleString()} · {item.percentage}%
				</span>
			</div>
			<div className="h-2 w-full rounded-full bg-muted">
				<div
					className="h-full rounded-full bg-primary"
					style={{ width: `${item.percentage}%` }}
				/>
			</div>
		</div>
	);
}

function DistributionBars({ items }: { items: DistributionItem[] }) {
	if (items.length === 0) {
		return <EmptyMini />;
	}
	return (
		<div className="space-y-2.5">
			{items.slice(0, 8).map((item) => (
				<DistributionBar item={item} key={item.value} />
			))}
		</div>
	);
}

/** Average/min/max only — no distribution bars (those are reserved for the rating card). */
function NumericStats({ data }: { data: Record<string, unknown> }) {
	const average = data.average as number | null;
	const min = data.min as number | null;
	const max = data.max as number | null;
	return (
		<div className="grid grid-cols-3 gap-2">
			<div className="space-y-1">
				<p className="text-muted-foreground text-xs">Average</p>
				<p className="font-semibold text-lg">{average ?? "—"}</p>
			</div>
			<div className="space-y-1">
				<p className="text-muted-foreground text-xs">Min</p>
				<p className="font-semibold text-lg">{min ?? "—"}</p>
			</div>
			<div className="space-y-1">
				<p className="text-muted-foreground text-xs">Max</p>
				<p className="font-semibold text-lg">{max ?? "—"}</p>
			</div>
		</div>
	);
}

function RatingStarIcon({ filled }: { filled: boolean }) {
	return (
		<StarIcon
			className={
				filled
					? "size-3.5 fill-primary text-primary"
					: "size-3.5 text-muted-foreground/40"
			}
		/>
	);
}

/** The average shown as a 5-star mini glyph next to its numeric value, e.g. "★★★★☆ 4.2 avg". */
function RatingAverageBadge({ average }: { average: number }) {
	const rounded = Math.round(average);
	const stars = [0, 1, 2, 3, 4];
	return (
		<div className="flex items-center gap-1.5">
			<div className="flex items-center gap-0.5">
				{stars.map((i) => (
					<RatingStarIcon filled={i < rounded} key={i} />
				))}
			</div>
			<span className="font-medium text-sm">{average} avg</span>
		</div>
	);
}

/** A "rating" field's summary: average (as stars) plus a per-star-value distribution, high to low. */
function RatingSummary({ data }: { data: Record<string, unknown> }) {
	const items = (data.distribution as DistributionItem[] | undefined) ?? [];
	if (items.length === 0) {
		return <EmptyMini icon={StarIcon} />;
	}
	const sorted = [...items].sort((a, b) => Number(b.value) - Number(a.value));
	return (
		<div className="space-y-2.5">
			{sorted.map((item) => (
				<DistributionBar
					item={{
						...item,
						value: `${item.value} ${item.value === "1" ? "star" : "stars"}`,
					}}
					key={item.value}
				/>
			))}
		</div>
	);
}

function MatrixSummary({ data }: { data: Record<string, unknown> }) {
	const rows =
		(data.rows as Record<string, DistributionItem[]> | undefined) ?? {};
	const rowNames = Object.keys(rows);
	if (rowNames.length === 0) {
		return <EmptyMini />;
	}
	return (
		<div className="space-y-4">
			{rowNames.map((rowName) => (
				<div key={rowName}>
					<p className="mb-1.5 font-medium text-sm">{rowName}</p>
					<DistributionBars items={rows[rowName] ?? []} />
				</div>
			))}
		</div>
	);
}

function TextSamples({ data }: { data: Record<string, unknown> }) {
	const values = (data.values as string[] | undefined) ?? [];
	const total = (data.total as number | undefined) ?? 0;
	if (values.length === 0) {
		return <EmptyMini />;
	}
	return (
		<div className="space-y-2">
			<ul className="space-y-1.5">
				{values.map((value) => (
					<li
						className="truncate rounded-lg bg-muted px-3 py-2 text-sm"
						key={value}
					>
						{value || <span className="text-muted-foreground">(empty)</span>}
					</li>
				))}
			</ul>
			{total > values.length ? (
				<p className="text-muted-foreground text-xs">
					+{total - values.length} more
				</p>
			) : null}
		</div>
	);
}

/** Formats an ISO date string for display, including the time only if it isn't midnight UTC. */
function formatSummaryDate(iso: string | undefined): string {
	if (!iso) {
		return "—";
	}
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return iso;
	}
	const hasTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
	return format(date, hasTime ? "PPp" : "PP");
}

function DateSummary({ data }: { data: Record<string, unknown> }) {
	return (
		<dl className="grid grid-cols-2 gap-2 text-sm">
			<div>
				<dt className="text-muted-foreground text-xs">Earliest</dt>
				<dd>{formatSummaryDate(data.earliest as string | undefined)}</dd>
			</div>
			<div>
				<dt className="text-muted-foreground text-xs">Latest</dt>
				<dd>{formatSummaryDate(data.latest as string | undefined)}</dd>
			</div>
		</dl>
	);
}

function SummaryBody({ summary }: { summary: FieldSummary }) {
	switch (summary.summaryType) {
		case "boolean":
		case "distribution":
			return (
				<DistributionBars
					items={
						(summary.data.distribution as DistributionItem[] | undefined) ?? []
					}
				/>
			);
		case "rating":
			return <RatingSummary data={summary.data} />;
		case "numeric_stats":
			return <NumericStats data={summary.data} />;
		case "matrix":
			return <MatrixSummary data={summary.data} />;
		case "date_summary":
			return <DateSummary data={summary.data} />;
		default:
			return <TextSamples data={summary.data} />;
	}
}

function answeredLabel(count: number): string {
	return `${count.toLocaleString()} ${count === 1 ? "answer" : "answers"}`;
}

export default function FieldSummaryCard({
	summary,
}: {
	summary: FieldSummary;
}) {
	const average =
		summary.summaryType === "rating"
			? (summary.data.average as number | null)
			: null;
	return (
		<Card>
			<CardHeader className="flex-row items-start justify-between gap-3">
				<div>
					<CardTitle>{summary.name}</CardTitle>
					<p className="text-muted-foreground text-xs">
						{answeredLabel(summary.answeredCount)}
					</p>
				</div>
				{average === null ? null : <RatingAverageBadge average={average} />}
			</CardHeader>
			<CardContent>
				<SummaryBody summary={summary} />
			</CardContent>
		</Card>
	);
}
