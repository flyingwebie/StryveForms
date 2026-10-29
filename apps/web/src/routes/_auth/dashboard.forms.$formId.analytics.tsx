import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@StryveForms/ui/components/chart";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@StryveForms/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	CheckCircle2Icon,
	EyeIcon,
	InboxIcon,
	type LucideIcon,
	TimerIcon,
} from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute(
	"/_auth/dashboard/forms/$formId/analytics"
)({
	component: RouteComponent,
});

const CHART_CONFIG = {
	submissions: { color: "var(--chart-2)", label: "Submissions" },
	views: { color: "var(--chart-1)", label: "Views" },
};

const RANGES = [7, 30, 90] as const;

function Tile({
	icon: Icon,
	label,
	value,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
}) {
	return (
		<Card>
			<CardContent className="flex items-start justify-between gap-3">
				<div className="space-y-1.5">
					<p className="text-muted-foreground text-xs">{label}</p>
					<p className="font-semibold text-2xl">{value}</p>
				</div>
				<Icon className="size-4 text-muted-foreground" />
			</CardContent>
		</Card>
	);
}

function ChartLegendSwatch({
	colorVar,
	label,
}: {
	colorVar: string;
	label: string;
}) {
	return (
		<span className="flex items-center gap-1.5 text-sm">
			<span
				aria-hidden="true"
				className="size-2.5 rounded-sm"
				style={{ background: colorVar }}
			/>
			{label}
		</span>
	);
}

/** One row of the Traffic sources / Countries lists: label, count+percentage, a progress bar. */
function TrafficRow({
	count,
	percentage,
	value,
}: {
	count: number;
	percentage: number;
	value: string;
}) {
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between gap-2 text-sm">
				<span className="truncate">{value}</span>
				<span className="shrink-0">
					{count.toLocaleString()}{" "}
					<span className="text-muted-foreground">{percentage}%</span>
				</span>
			</div>
			<div className="h-1.5 w-full rounded-full bg-muted">
				<div
					className="h-full rounded-full bg-primary"
					style={{ width: `${percentage}%` }}
				/>
			</div>
		</div>
	);
}

function TrafficList({
	items,
}: {
	items: { count: number; percentage: number; value: string }[];
}) {
	if (items.length === 0) {
		return <p className="text-muted-foreground text-sm">No data yet</p>;
	}
	return (
		<div className="space-y-3">
			{items.map((item) => (
				<TrafficRow key={item.value} {...item} />
			))}
		</div>
	);
}

function RouteComponent() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const [days, setDays] = useState<(typeof RANGES)[number]>(30);

	const overview = useQuery(trpc.stats.overview.queryOptions({ formId }));
	const timeline = useQuery(trpc.stats.timeline.queryOptions({ days, formId }));
	const traffic = useQuery(trpc.stats.traffic.queryOptions({ formId }));

	return (
		<div className="space-y-6">
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Tile
					icon={EyeIcon}
					label="Views"
					value={String(overview.data?.views ?? "—")}
				/>
				<Tile
					icon={InboxIcon}
					label="Submissions"
					value={String(overview.data?.submissions ?? "—")}
				/>
				<Tile
					icon={CheckCircle2Icon}
					label="Completion rate"
					value={overview.data ? `${overview.data.completionRate}%` : "—"}
				/>
				<Tile
					icon={TimerIcon}
					label="Avg. completion time"
					value={
						overview.data?.averageCompletionSeconds
							? `${Math.round(overview.data.averageCompletionSeconds / 60)} min`
							: "—"
					}
				/>
			</div>

			<Card>
				<CardHeader className="flex-row items-center justify-between">
					<CardTitle>Traffic over time</CardTitle>
					<Tabs
						onValueChange={(value) =>
							setDays(Number(value) as (typeof RANGES)[number])
						}
						value={String(days)}
					>
						<TabsList>
							{RANGES.map((range) => (
								<TabsTrigger key={range} value={String(range)}>
									{range} days
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center gap-4">
						<ChartLegendSwatch
							colorVar={CHART_CONFIG.views.color}
							label="Views"
						/>
						<ChartLegendSwatch
							colorVar={CHART_CONFIG.submissions.color}
							label="Submissions"
						/>
					</div>
					{/* biome-ignore lint/suspicious/noUnnecessaryConditions: isLoading is a runtime query-status flag */}
					{timeline.isLoading ? (
						<Skeleton className="h-64 w-full" />
					) : (
						<ChartContainer
							className="aspect-auto h-64 w-full"
							config={CHART_CONFIG}
						>
							<BarChart data={timeline.data ?? []}>
								<CartesianGrid vertical={false} />
								<XAxis
									axisLine={false}
									dataKey="date"
									tickFormatter={(value: string) =>
										new Date(value).toLocaleDateString(undefined, {
											day: "numeric",
											month: "short",
										})
									}
									tickLine={false}
								/>
								<ChartTooltip
									content={<ChartTooltipContent indicator="dot" />}
								/>
								<Bar
									dataKey="views"
									fill="var(--color-views)"
									radius={[4, 4, 0, 0]}
								/>
								<Bar
									dataKey="submissions"
									fill="var(--color-submissions)"
									radius={[4, 4, 0, 0]}
								/>
							</BarChart>
						</ChartContainer>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Traffic sources</CardTitle>
					</CardHeader>
					<CardContent>
						<TrafficList items={traffic.data?.sources ?? []} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Countries</CardTitle>
					</CardHeader>
					<CardContent>
						<TrafficList items={traffic.data?.countries ?? []} />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
