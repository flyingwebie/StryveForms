import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@StryveForms/ui/components/input-group";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Switch } from "@StryveForms/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@StryveForms/ui/components/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import PasswordInput from "@/components/app/auth/password-input";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

const FREQUENCY_OPTIONS = [
	{ label: "Weekly", value: "weekly" },
	{ label: "Daily", value: "daily" },
] as const;

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
const FALLBACK_TIMEZONES = ["UTC"];

function supportedTimezones(): string[] {
	try {
		return Intl.supportedValuesOf("timeZone");
	} catch {
		return FALLBACK_TIMEZONES;
	}
}

/** Label + helper on the left, control on the right, hairline below. */
function Row({
	children,
	description,
	htmlFor,
	label,
}: {
	children: ReactNode;
	description: string;
	htmlFor?: string;
	label: string;
}) {
	return (
		<div className="flex flex-col gap-3 border-border border-b py-5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-start">
			<div className="sm:w-70 sm:shrink-0">
				<Label className="text-[13px]" htmlFor={htmlFor}>
					{label}
				</Label>
				<p className="mt-0.5 text-subtle-foreground text-xs">{description}</p>
			</div>
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	);
}

interface ScheduleState {
	destinationId: string | null;
	enabled: boolean;
	frequency: "daily" | "weekly";
	keepLast: number;
	time: string;
	timezone: string;
	weekday: string;
}

/**
 * Scheduled backups (destination, frequency, day/time, timezone, retention)
 * and the unattended passphrase scheduled/safety backups run with — one
 * settings section with a single Discard/Save changes footer.
 */
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

	const timezones = useMemo(supportedTimezones, []);

	const [state, setState] = useState<ScheduleState>({
		destinationId: null,
		enabled: false,
		frequency: "weekly",
		keepLast: 7,
		time: "03:00",
		timezone: "UTC",
		weekday: "0",
	});
	const [passphrase, setPassphrase] = useState("");

	const original = useMemo<ScheduleState | null>(
		() =>
			settings.data
				? {
						destinationId: settings.data.schedule.destinationId,
						enabled: settings.data.schedule.enabled,
						frequency: settings.data.schedule.frequency,
						keepLast: settings.data.retention.keepLast,
						time: settings.data.schedule.time,
						timezone: settings.data.schedule.timezone,
						weekday: String(settings.data.schedule.weekday),
					}
				: null,
		[settings.data]
	);

	useEffect(() => {
		if (original) {
			setState(original);
		}
	}, [original]);

	const saveSchedule = useMutation(
		trpc.backupAdmin.schedule.set.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.backupAdmin.schedule.get.queryKey(),
				});
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
			},
		})
	);

	const scheduleDirty =
		original !== null && JSON.stringify(original) !== JSON.stringify(state);
	const passphraseTooShort =
		passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE_LENGTH;
	const dirty = scheduleDirty || passphrase.length > 0;
	const saving = saveSchedule.isPending || savePassphrase.isPending;

	function discard() {
		if (original) {
			setState(original);
		}
		setPassphrase("");
	}

	function save() {
		if (passphraseTooShort) {
			return;
		}
		if (scheduleDirty) {
			saveSchedule.mutate({
				retention: { keepLast: state.keepLast },
				schedule: {
					destinationId: state.destinationId,
					enabled: state.enabled,
					frequency: state.frequency,
					time: state.time,
					timezone: state.timezone,
					weekday: Number(state.weekday),
				},
			});
		}
		if (passphrase.length >= MIN_PASSPHRASE_LENGTH) {
			savePassphrase.mutate({ passphrase });
		}
		toast.success("Backup schedule saved");
	}

	return (
		<section className="space-y-1">
			<div>
				<h3 className="font-semibold text-base">Scheduled backups</h3>
				<p className="text-[13px] text-subtle-foreground">
					Automatic full-instance backups, and the passphrase they're encrypted
					with when no one's around to type one in.
				</p>
			</div>

			<div className="mt-4">
				<Row
					description="Needs at least one destination and a saved passphrase below."
					htmlFor="schedule-enabled"
					label="Scheduled backups"
				>
					<Switch
						checked={state.enabled}
						id="schedule-enabled"
						onCheckedChange={(enabled) =>
							setState((prev) => ({ ...prev, enabled }))
						}
					/>
				</Row>

				<Row description="How often scheduled backups run." label="Frequency">
					<Tabs
						onValueChange={(value) =>
							value &&
							setState((prev) => ({
								...prev,
								frequency: value as "daily" | "weekly",
							}))
						}
						value={state.frequency}
					>
						<TabsList>
							{FREQUENCY_OPTIONS.map((option) => (
								<TabsTrigger key={option.value} value={option.value}>
									{option.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</Row>

				<Row
					description={
						state.frequency === "weekly"
							? "When the weekly backup starts."
							: "When the daily backup starts."
					}
					label={state.frequency === "weekly" ? "Day & time" : "Time"}
				>
					<div className="flex flex-wrap items-center gap-2">
						{state.frequency === "weekly" ? (
							<Select
								items={WEEKDAY_OPTIONS}
								onValueChange={(value) =>
									value && setState((prev) => ({ ...prev, weekday: value }))
								}
								value={state.weekday}
							>
								<SelectTrigger aria-label="Day of the week">
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
						) : null}
						<Input
							aria-label="Time"
							className="w-32 font-mono"
							onChange={(event) =>
								setState((prev) => ({ ...prev, time: event.target.value }))
							}
							type="time"
							value={state.time}
						/>
					</div>
				</Row>

				<Row description="Used to schedule the backup window." label="Timezone">
					<Select
						items={timezones.map((tz) => ({ label: tz, value: tz }))}
						onValueChange={(value) =>
							value && setState((prev) => ({ ...prev, timezone: value }))
						}
						value={state.timezone}
					>
						<SelectTrigger className="w-full sm:w-64">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{timezones.map((tz) => (
								<SelectItem key={tz} value={tz}>
									{tz}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Row>

				<Row
					description="Where scheduled backups are sent."
					label="Destination"
				>
					<Select
						items={(destinations.data ?? []).map((d) => ({
							label: d.label,
							value: d.id,
						}))}
						onValueChange={(value) =>
							setState((prev) => ({ ...prev, destinationId: value }))
						}
						value={state.destinationId ?? undefined}
					>
						<SelectTrigger className="w-full sm:w-64">
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
				</Row>

				<Row
					description="Older backups beyond this count are deleted."
					htmlFor="schedule-retention"
					label="Keep last"
				>
					<InputGroup className="w-40">
						<InputGroupInput
							id="schedule-retention"
							max={365}
							min={1}
							onChange={(event) =>
								setState((prev) => ({
									...prev,
									keepLast: Number(event.target.value) || 1,
								}))
							}
							type="number"
							value={state.keepLast}
						/>
						<InputGroupAddon align="inline-end">
							<InputGroupText>backups</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
				</Row>

				<Row
					description="Encrypts scheduled backups without prompting you."
					htmlFor="backup-passphrase"
					label="Unattended passphrase"
				>
					<PasswordInput
						autoComplete="new-password"
						id="backup-passphrase"
						onChange={setPassphrase}
						placeholder={
							passphraseStatus.data?.isSet
								? "Leave empty to keep the current one"
								: `At least ${MIN_PASSPHRASE_LENGTH} characters`
						}
						value={passphrase}
					/>
					{passphraseTooShort ? (
						<p className="mt-1.5 text-destructive text-xs">
							At least {MIN_PASSPHRASE_LENGTH} characters.
						</p>
					) : (
						<p className="mt-1.5 text-subtle-foreground text-xs">
							If you lose this passphrase, backups made with it can't be opened.
							We can't recover it for you — store it somewhere safe.
						</p>
					)}
				</Row>
			</div>

			{dirty ? (
				<div className="flex items-center justify-end gap-2 border-border border-t pt-5">
					<Button onClick={discard} type="button" variant="outline">
						Discard
					</Button>
					<Button
						disabled={saving || passphraseTooShort}
						onClick={save}
						type="button"
					>
						{saving ? "Saving…" : "Save changes"}
					</Button>
				</div>
			) : null}
		</section>
	);
}
