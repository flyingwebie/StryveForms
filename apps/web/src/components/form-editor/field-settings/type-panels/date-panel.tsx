import type { FormField } from "@StryveForms/forms/types";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";

import { useEditor } from "../../state/editor-context";

export function DatePanel({ field }: { field: FormField }) {
	const { updateField } = useEditor();

	return (
		<FieldSet>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.date_range)}
					id={`${field.id}-range`}
					onCheckedChange={(checked) =>
						updateField(field.id, { date_range: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-range`}>
						Ask for a date range
					</FieldLabel>
					<FieldDescription>
						Respondents pick a start and end date instead of a single date.
					</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.with_time)}
					id={`${field.id}-with-time`}
					onCheckedChange={(checked) =>
						updateField(field.id, { with_time: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-with-time`}>
						Include a time
					</FieldLabel>
					<FieldDescription>
						Adds a time picker alongside the date.
					</FieldDescription>
				</FieldContent>
			</Field>
			{field.with_time ? (
				<Field>
					<FieldLabel htmlFor={`${field.id}-time-format`}>
						Time format
					</FieldLabel>
					<NativeSelect
						id={`${field.id}-time-format`}
						onChange={(e) =>
							updateField(field.id, {
								time_format: e.target.value as "12" | "24",
							})
						}
						value={field.time_format ?? "24"}
					>
						<NativeSelectOption value="24">24-hour</NativeSelectOption>
						<NativeSelectOption value="12">12-hour (AM/PM)</NativeSelectOption>
					</NativeSelect>
					<FieldDescription>Clock style for the time picker.</FieldDescription>
				</Field>
			) : null}
			<Field>
				<FieldLabel htmlFor={`${field.id}-date-format`}>Date format</FieldLabel>
				<NativeSelect
					id={`${field.id}-date-format`}
					onChange={(e) =>
						updateField(field.id, {
							date_format: e.target.value as "dd/MM/yyyy" | "MM-dd-yyyy",
						})
					}
					value={field.date_format ?? "dd/MM/yyyy"}
				>
					<NativeSelectOption value="dd/MM/yyyy">DD/MM/YYYY</NativeSelectOption>
					<NativeSelectOption value="MM-dd-yyyy">MM-DD-YYYY</NativeSelectOption>
				</NativeSelect>
				<FieldDescription>
					How the date is displayed to respondents.
				</FieldDescription>
			</Field>
			<Field>
				<FieldLabel htmlFor={`${field.id}-timezone`}>Timezone</FieldLabel>
				<NativeSelect
					id={`${field.id}-timezone`}
					onChange={(e) => updateField(field.id, { timezone: e.target.value })}
					value={field.timezone ?? "UTC"}
				>
					<NativeSelectOption value="UTC">UTC</NativeSelectOption>
					<NativeSelectOption value="respondent">
						Respondent's local time
					</NativeSelectOption>
				</NativeSelect>
				<FieldDescription>
					Which timezone the stored date/time is interpreted in.
				</FieldDescription>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.disable_past_dates)}
					id={`${field.id}-disable-past`}
					onCheckedChange={(checked) =>
						updateField(field.id, { disable_past_dates: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-disable-past`}>
						Disable past dates
					</FieldLabel>
					<FieldDescription>
						Dates before today can't be picked.
					</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.disable_future_dates)}
					id={`${field.id}-disable-future`}
					onCheckedChange={(checked) =>
						updateField(field.id, { disable_future_dates: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-disable-future`}>
						Disable future dates
					</FieldLabel>
					<FieldDescription>
						Dates after today can't be picked.
					</FieldDescription>
				</FieldContent>
			</Field>
			<Field orientation="horizontal">
				<Checkbox
					checked={Boolean(field.prefill_today)}
					id={`${field.id}-prefill-today`}
					onCheckedChange={(checked) =>
						updateField(field.id, { prefill_today: checked === true })
					}
				/>
				<FieldContent>
					<FieldLabel htmlFor={`${field.id}-prefill-today`}>
						Prefill with today's date
					</FieldLabel>
					<FieldDescription>
						Starts the field with today's date already filled in.
					</FieldDescription>
				</FieldContent>
			</Field>
		</FieldSet>
	);
}
