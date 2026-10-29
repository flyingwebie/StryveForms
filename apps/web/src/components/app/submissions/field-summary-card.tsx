import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { format } from "date-fns";

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

function DistributionBars({ items }: { items: DistributionItem[] }) {
	if (items.length === 0) {
		return <p className="text-muted-foreground text-sm">No answers yet</p>;
	}
	return (
		<div className="space-y-2">
			{items.slice(0, 8).map((item) => (
				<div className="space-y-1" key={item.value}>
					<div className="flex justify-between text-sm">
						<span className="truncate">{item.value}</span>
						<span className="text-muted-foreground">
							{item.count} ({item.percentage}%)
						</span>
					</div>
					<div className="h-1.5 w-full bg-muted">
						<div
							className="h-full bg-primary"
							style={{ width: `${item.percentage}%` }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

function NumericStats({ data }: { data: Record<string, unknown> }) {
	const average = data.average as number | null;
	const min = data.min as number | null;
	const max = data.max as number | null;
	return (
		<div className="space-y-3">
			<div className="grid grid-cols-3 gap-2 text-center">
				<div>
					<p className="font-semibold text-lg">{average ?? "—"}</p>
					<p className="text-muted-foreground text-xs">Average</p>
				</div>
				<div>
					<p className="font-semibold text-lg">{min ?? "—"}</p>
					<p className="text-muted-foreground text-xs">Min</p>
				</div>
				<div>
					<p className="font-semibold text-lg">{max ?? "—"}</p>
					<p className="text-muted-foreground text-xs">Max</p>
				</div>
			</div>
			<DistributionBars
				items={(data.distribution as DistributionItem[] | undefined) ?? []}
			/>
		</div>
	);
}

function MatrixSummary({ data }: { data: Record<string, unknown> }) {
	const rows =
		(data.rows as Record<string, DistributionItem[]> | undefined) ?? {};
	const rowNames = Object.keys(rows);
	if (rowNames.length === 0) {
		return <p className="text-muted-foreground text-sm">No answers yet</p>;
	}
	return (
		<div className="space-y-4">
			{rowNames.map((rowName) => (
				<div key={rowName}>
					<p className="mb-1 font-medium text-sm">{rowName}</p>
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
		return <p className="text-muted-foreground text-sm">No answers yet</p>;
	}
	return (
		<div className="space-y-2">
			<ul className="space-y-1.5 text-sm">
				{values.map((value) => (
					<li
						className="truncate border-border border-b pb-1.5 last:border-0"
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
		case "numeric_stats":
		case "rating":
			return <NumericStats data={summary.data} />;
		case "matrix":
			return <MatrixSummary data={summary.data} />;
		case "date_summary":
			return <DateSummary data={summary.data} />;
		default:
			return <TextSamples data={summary.data} />;
	}
}

export default function FieldSummaryCard({
	summary,
}: {
	summary: FieldSummary;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{summary.name}</CardTitle>
				<p className="text-muted-foreground text-xs">
					{summary.answeredCount} answered
				</p>
			</CardHeader>
			<CardContent>
				<SummaryBody summary={summary} />
			</CardContent>
		</Card>
	);
}
