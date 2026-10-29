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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute(
	"/_auth/dashboard/forms/$formId/analytics"
)({
	component: RouteComponent,
});

const CHART_CONFIG = {
	submissions: { color: "var(--chart-1)", label: "Submissions" },
	views: { color: "var(--chart-2)", label: "Views" },
};

const RANGES = [7, 30, 90] as const;

function Tile({ label, value }: { label: string; value: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-muted-foreground text-xs">{label}</CardTitle>
			</CardHeader>
			<CardContent className="font-semibold text-2xl">{value}</CardContent>
		</Card>
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
				<Tile label="Views" value={String(overview.data?.views ?? "—")} />
				<Tile
					label="Submissions"
					value={String(overview.data?.submissions ?? "—")}
				/>
				<Tile
					label="Completion rate"
					value={overview.data ? `${overview.data.completionRate}%` : "—"}
				/>
				<Tile
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
					<Select
						items={RANGES.map((range) => ({
							label: `Last ${range} days`,
							value: String(range),
						}))}
						onValueChange={(value) =>
							setDays(Number(value) as (typeof RANGES)[number])
						}
						value={String(days)}
					>
						<SelectTrigger className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{RANGES.map((range) => (
								<SelectItem key={range} value={String(range)}>
									Last {range} days
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardHeader>
				<CardContent>
					{/* biome-ignore lint/suspicious/noUnnecessaryConditions: isLoading is a runtime query-status flag */}
					{timeline.isLoading ? (
						<Skeleton className="h-64 w-full" />
					) : (
						<ChartContainer
							className="aspect-auto h-64 w-full"
							config={CHART_CONFIG}
						>
							<AreaChart data={timeline.data ?? []}>
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
								<ChartTooltip content={<ChartTooltipContent />} />
								<Area
									dataKey="views"
									fill="var(--color-views)"
									fillOpacity={0.15}
									stroke="var(--color-views)"
									type="monotone"
								/>
								<Area
									dataKey="submissions"
									fill="var(--color-submissions)"
									fillOpacity={0.3}
									stroke="var(--color-submissions)"
									type="monotone"
								/>
							</AreaChart>
						</ChartContainer>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Traffic sources</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						{(traffic.data?.sources ?? []).map((source) => (
							<div
								className="flex items-center justify-between text-sm"
								key={source.value}
							>
								<span>{source.value}</span>
								<span className="text-muted-foreground">
									{source.count} ({source.percentage}%)
								</span>
							</div>
						))}
						{traffic.data?.sources.length === 0 ? (
							<p className="text-muted-foreground text-sm">No data yet</p>
						) : null}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Countries</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						{(traffic.data?.countries ?? []).map((country) => (
							<div
								className="flex items-center justify-between text-sm"
								key={country.value}
							>
								<span>{country.value}</span>
								<span className="text-muted-foreground">
									{country.count} ({country.percentage}%)
								</span>
							</div>
						))}
						{traffic.data?.countries.length === 0 ? (
							<p className="text-muted-foreground text-sm">No data yet</p>
						) : null}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
