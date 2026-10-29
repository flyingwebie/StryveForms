import type { FormField } from "@StryveForms/forms/types";
import { Button } from "@StryveForms/ui/components/button";
import { Calendar } from "@StryveForms/ui/components/calendar";
import { Input } from "@StryveForms/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@StryveForms/ui/components/popover";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import type { FieldComponentProps } from "../types";

function formatDisplay(field: FormField, date: Date): string {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return field.date_format === "MM-dd-yyyy"
		? `${month}-${day}-${date.getFullYear()}`
		: `${day}/${month}/${date.getFullYear()}`;
}

function timeOf(date: Date | undefined): string {
	if (!date) {
		return "";
	}
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function withTime(date: Date, time: string): Date {
	const [hours, minutes] = time.split(":").map(Number);
	const next = new Date(date);
	next.setHours(hours || 0, minutes || 0, 0, 0);
	return next;
}

function parseIso(value: unknown): Date | undefined {
	if (typeof value !== "string" || value === "") {
		return;
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function boundsDisabled(field: FormField) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return (date: Date) => {
		if (field.disable_past_dates && date < today) {
			return true;
		}
		return Boolean(field.disable_future_dates && date > today);
	};
}

function SingleDate({
	disabled,
	error,
	field,
	id,
	onChange,
	required,
	value,
}: FieldComponentProps) {
	const date = parseIso(value);
	const [open, setOpen] = useState(false);

	function pick(next: Date | undefined) {
		if (!next) {
			onChange(undefined);
			return;
		}
		const final = field.with_time
			? withTime(next, timeOf(date) || "00:00")
			: next;
		onChange(final.toISOString());
		setOpen(false);
	}

	return (
		<div className="flex gap-2">
			<Popover onOpenChange={setOpen} open={open}>
				<PopoverTrigger
					render={
						<Button
							aria-invalid={Boolean(error)}
							disabled={disabled}
							id={id}
							type="button"
							variant="outline"
						/>
					}
				>
					<CalendarIcon className="size-4" />
					{date
						? formatDisplay(field, date)
						: field.placeholder || "Select a date"}
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0">
					<Calendar
						disabled={boundsDisabled(field)}
						mode="single"
						onSelect={pick}
						required={required}
						selected={date}
					/>
				</PopoverContent>
			</Popover>
			{field.with_time ? (
				<Input
					aria-label={`${field.name} time`}
					className="w-32"
					disabled={disabled}
					onChange={(e) => {
						const base = date ?? new Date();
						onChange(withTime(base, e.target.value).toISOString());
					}}
					type="time"
					value={timeOf(date)}
				/>
			) : null}
		</div>
	);
}

function RangeDate({
	disabled,
	error,
	field,
	id,
	onChange,
	value,
}: FieldComponentProps) {
	const [start, end] = Array.isArray(value) ? value : [undefined, undefined];
	const range = { from: parseIso(start), to: parseIso(end) };
	const [open, setOpen] = useState(false);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger
				render={
					<Button
						aria-invalid={Boolean(error)}
						disabled={disabled}
						id={id}
						type="button"
						variant="outline"
					/>
				}
			>
				<CalendarIcon className="size-4" />
				{range.from
					? `${formatDisplay(field, range.from)} – ${range.to ? formatDisplay(field, range.to) : "…"}`
					: field.placeholder || "Select a date range"}
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0">
				<Calendar
					disabled={boundsDisabled(field)}
					mode="range"
					onSelect={(next) => {
						onChange([
							next?.from ? next.from.toISOString() : undefined,
							next?.to ? next.to.toISOString() : undefined,
						]);
						if (next?.from && next?.to) {
							setOpen(false);
						}
					}}
					selected={range}
				/>
			</PopoverContent>
		</Popover>
	);
}

export function DateField(props: FieldComponentProps) {
	return props.field.date_range ? (
		<RangeDate {...props} />
	) : (
		<SingleDate {...props} />
	);
}
