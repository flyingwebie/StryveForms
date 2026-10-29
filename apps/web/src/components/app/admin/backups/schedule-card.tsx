import { Button } from "@StryveForms/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

const FREQUENCY_OPTIONS = [
	{ label: "Daily", value: "daily" },
	{ label: "Weekly", value: "weekly" },
];

const WEEKDAY_OPTIONS = [
	{ label: "Sunday", value: "0" },
	{ label: "Monday", value: "1" },
	{ label: "Tuesday", value: "2" },
	{ label: "Wednesday", value: "3" },
	{ label: "Thursday", value: "4" },
	{ label: "Friday", value: "5" },
	{ label: "Saturday", value: "6" },
];

const MIN_PASSPHRASE_LENGTH = 12;

/** Automatic backups: on/off, frequency, time, timezone, retention — plus the passphrase scheduled backups run with unattended. */
export default function ScheduleCard() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.backupAdmin.schedule.get.queryOptions());
	const destinations = useQuery(
		trpc.backupAdmin.destinations.list.queryOptions()
	);
	const passphraseStatus = useQuery(
		trpc.backupAdmin.passphrase.status.queryOptions()
	);

	const [enabled, setEnabled] = useState(false);
	const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
	const [weekday, setWeekday] = useState("0");
	const [time, setTime] = useState("03:00");
	const [timezone, setTimezone] = useState("UTC");
	const [destinationId, setDestinationId] = useState<string | null>(null);
	const [keepLast, setKeepLast] = useState(7);
	const [passphrase, setPassphrase] = useState("");

	useEffect(() => {
		if (!settings.data) {
			return;
		}
		setEnabled(settings.data.schedule.enabled);
		setFrequency(settings.data.schedule.frequency);
		setWeekday(String(settings.data.schedule.weekday));
		setTime(settings.data.schedule.time);
		setTimezone(settings.data.schedule.timezone);
		setDestinationId(settings.data.schedule.destinationId);
		setKeepLast(settings.data.retention.keepLast);
	}, [settings.data]);

	const saveSchedule = useMutation(
		trpc.backupAdmin.schedule.set.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.backupAdmin.schedule.get.queryKey(),
				});
				toast.success("Schedule saved");
			},
		})
	);

	const savePassphrase = useMutation(
		trpc.backupAdmin.passphrase.set.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				setPassphrase("");
				await queryClient.invalidateQueries({
					queryKey: trpc.backupAdmin.passphrase.status.queryKey(),
				});
				toast.success("Backup passphrase saved");
			},
		})
	);

	function handleSaveSchedule() {
		saveSchedule.mutate({
			retention: { keepLast },
			schedule: {
				destinationId,
				enabled,
				frequency,
				time,
				timezone,
				weekday: Number(weekday),
			},
		});
	}

	return (
		<Card className="rounded-xl">
			<CardHeader>
				<CardTitle>Scheduled backups</CardTitle>
				<CardDescription>
					Take a full instance backup automatically, on a daily or weekly
					schedule, in the instance's own timezone.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
					<span className="space-y-0.5">
						<Label className="text-sm">Turn on scheduled backups</Label>
						<p className="text-muted-foreground text-xs">
							Needs at least one destination and a saved passphrase below.
						</p>
					</span>
					<Switch checked={enabled} onCheckedChange={setEnabled} />
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-2">
						<Label htmlFor="schedule-frequency">Frequency</Label>
						<Select
							items={FREQUENCY_OPTIONS}
							onValueChange={(value) =>
								setFrequency(value as "daily" | "weekly")
							}
							value={frequency}
						>
							<SelectTrigger className="w-full" id="schedule-frequency">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FREQUENCY_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{frequency === "weekly" ? (
						<div className="space-y-2">
							<Label htmlFor="schedule-weekday">Day</Label>
							<Select
								items={WEEKDAY_OPTIONS}
								onValueChange={(value) => value && setWeekday(value)}
								value={weekday}
							>
								<SelectTrigger className="w-full" id="schedule-weekday">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{WEEKDAY_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					) : null}
					<div className="space-y-2">
						<Label htmlFor="schedule-time">Time</Label>
						<Input
							id="schedule-time"
							onChange={(event) => setTime(event.target.value)}
							type="time"
							value={time}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="schedule-timezone">Timezone</Label>
						<Input
							id="schedule-timezone"
							onChange={(event) => setTimezone(event.target.value)}
							placeholder="UTC"
							value={timezone}
						/>
						<p className="text-muted-foreground text-xs">
							An IANA name, e.g. "Europe/Dublin" or "America/New_York".
						</p>
					</div>
				</div>

				<div className="space-y-2">
					<Label htmlFor="schedule-destination">Destination</Label>
					<Select
						items={(destinations.data ?? []).map((d) => ({
							label: d.label,
							value: d.id,
						}))}
						onValueChange={setDestinationId}
						value={destinationId ?? undefined}
					>
						<SelectTrigger className="w-full" id="schedule-destination">
							<SelectValue placeholder="Choose a destination" />
						</SelectTrigger>
						<SelectContent>
							{(destinations.data ?? []).map((d) => (
								<SelectItem key={d.id} value={d.id}>
									{d.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-2">
					<Label htmlFor="schedule-retention">Keep the last</Label>
					<Input
						id="schedule-retention"
						max={365}
						min={1}
						onChange={(event) => setKeepLast(Number(event.target.value) || 1)}
						type="number"
						value={keepLast}
					/>
					<p className="text-muted-foreground text-xs">
						Older backups at this destination are deleted automatically after
						each successful run.
					</p>
				</div>
			</CardContent>
			<CardFooter>
				<Button
					disabled={saveSchedule.isPending}
					onClick={handleSaveSchedule}
					type="button"
				>
					{saveSchedule.isPending ? "Saving…" : "Save schedule"}
				</Button>
			</CardFooter>

			<CardHeader className="border-t pt-6">
				<CardTitle>Unattended backup passphrase</CardTitle>
				<CardDescription>
					Scheduled and automatic safety backups run with no one around to type
					a passphrase, so one is saved here instead (encrypted, the same way as
					other instance secrets). Manual backups can use this one or a one-off
					passphrase.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				<Label htmlFor="backup-passphrase">
					{passphraseStatus.data?.isSet
						? "Replace the saved passphrase"
						: "Set a passphrase"}
				</Label>
				<Input
					id="backup-passphrase"
					onChange={(event) => setPassphrase(event.target.value)}
					placeholder={
						passphraseStatus.data?.isSet
							? "Leave empty to keep the current one"
							: `At least ${MIN_PASSPHRASE_LENGTH} characters`
					}
					type="password"
					value={passphrase}
				/>
				<p className="text-destructive text-xs">
					If you lose this passphrase, backups made with it can't be opened. We
					can't recover it for you — store it somewhere safe.
				</p>
			</CardContent>
			<CardFooter>
				<Button
					disabled={
						passphrase.length < MIN_PASSPHRASE_LENGTH ||
						savePassphrase.isPending
					}
					onClick={() => savePassphrase.mutate({ passphrase })}
					type="button"
				>
					{savePassphrase.isPending ? "Saving…" : "Save passphrase"}
				</Button>
			</CardFooter>
		</Card>
	);
}
