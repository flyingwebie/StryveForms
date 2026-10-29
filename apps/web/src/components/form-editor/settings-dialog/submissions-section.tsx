import { RETENTION_UNITS } from "@StryveForms/forms/settings";
import type { FormField } from "@StryveForms/forms/types";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";

import { useEditor } from "../state/editor-context";
import { RedirectBuilder } from "./redirect-builder";

export function SubmissionsSection() {
	const { patch, readOnly, state } = useEditor();
	const { settings } = state;
	const mentions = (settings.properties as FormField[]).map((field) => ({
		id: field.id,
		label: field.name,
	}));
	const isFocused = settings.presentationStyle === "focused";

	return (
		<fieldset className="flex flex-col gap-5" disabled={readOnly}>
			<Card>
				<CardHeader>
					<CardTitle>After submit</CardTitle>
					<CardDescription>
						What respondents see, and where they go, right after they submit.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Field>
						<FieldLabel htmlFor="submit-button-text">
							Submit button text
						</FieldLabel>
						<Input
							id="submit-button-text"
							onChange={(e) => patch({ submitButtonText: e.target.value })}
							placeholder="Submit"
							value={settings.submitButtonText ?? ""}
						/>
						<FieldDescription>
							Replaces the default "Submit" label on the final button.
						</FieldDescription>
					</Field>
					{isFocused && (
						<Field>
							<FieldLabel htmlFor="focused-next-text">
								Focused mode "Next" button text
							</FieldLabel>
							<Input
								id="focused-next-text"
								onChange={(e) =>
									patch({
										translations: {
											...settings.translations,
											focused_next_button_text: e.target.value,
										},
									})
								}
								placeholder="Next"
								value={settings.translations.focused_next_button_text ?? ""}
							/>
							<FieldDescription>
								Shown instead of "Next" when moving between
								one-question-at-a-time screens.
							</FieldDescription>
						</Field>
					)}
					<Field>
						<FieldLabel>Success message</FieldLabel>
						<RichTextEditor
							mentions={mentions}
							onChange={(html) => patch({ submittedText: html })}
							toolbar="basic"
							value={settings.submittedText ?? ""}
						/>
						<FieldDescription>
							Shown on the thank-you screen. Insert an answer with "@" to
							personalize it, e.g. "Thanks, @Name!".
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>Redirect after submit</FieldLabel>
						<RedirectBuilder />
					</Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Respondent options</CardTitle>
					<CardDescription>
						Extra actions offered to respondents on the thank-you screen.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Field orientation="horizontal">
						<Checkbox
							checked={settings.reFillable}
							id="refillable"
							onCheckedChange={(checked) =>
								patch({ reFillable: checked === true })
							}
						/>
						<div className="flex flex-col">
							<FieldLabel htmlFor="refillable">
								Offer a "fill again" button
							</FieldLabel>
							<FieldDescription>
								Lets a respondent submit another response without reopening the
								form link.
							</FieldDescription>
						</div>
					</Field>
					{settings.reFillable ? (
						<Field>
							<FieldLabel htmlFor="refill-text">Button text</FieldLabel>
							<Input
								id="refill-text"
								onChange={(e) => patch({ reFillButtonText: e.target.value })}
								value={settings.reFillButtonText ?? ""}
							/>
							<FieldDescription>
								Replaces the default "Fill again" label.
							</FieldDescription>
						</Field>
					) : null}
					<Field orientation="horizontal">
						<Checkbox
							checked={settings.editableSubmissions}
							id="editable-submissions"
							onCheckedChange={(checked) =>
								patch({ editableSubmissions: checked === true })
							}
						/>
						<div className="flex flex-col">
							<FieldLabel htmlFor="editable-submissions">
								Let respondents edit their submission
							</FieldLabel>
							<FieldDescription>
								Adds an "Edit" button that reopens the form pre-filled with
								their own answers.
							</FieldDescription>
						</div>
					</Field>
					{settings.editableSubmissions ? (
						<Field>
							<FieldLabel htmlFor="editable-submissions-text">
								Edit button text
							</FieldLabel>
							<Input
								id="editable-submissions-text"
								onChange={(e) =>
									patch({ editableSubmissionsButtonText: e.target.value })
								}
								value={settings.editableSubmissionsButtonText ?? ""}
							/>
							<FieldDescription>
								Replaces the default "Edit" label.
							</FieldDescription>
						</Field>
					) : null}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Submission behavior</CardTitle>
					<CardDescription>
						How answers are saved while someone is filling the form in.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Field orientation="horizontal">
						<Checkbox
							checked={settings.enablePartialSubmissions}
							id="partial-submissions"
							onCheckedChange={(checked) =>
								patch({ enablePartialSubmissions: checked === true })
							}
						/>
						<div className="flex flex-col">
							<FieldLabel htmlFor="partial-submissions">
								Save partial submissions
							</FieldLabel>
							<FieldDescription>
								Keeps a draft response even if someone leaves before finishing,
								so you can see where people drop off.
							</FieldDescription>
						</div>
					</Field>
					<Field orientation="horizontal">
						<Checkbox
							checked={settings.autoSave}
							id="auto-save"
							onCheckedChange={(checked) =>
								patch({ autoSave: checked === true })
							}
						/>
						<div className="flex flex-col">
							<FieldLabel htmlFor="auto-save">
								Auto-save answers as respondents type
							</FieldLabel>
							<FieldDescription>
								Saves progress in the background so nothing is lost on a refresh
								or lost connection.
							</FieldDescription>
						</div>
					</Field>
					<Field>
						<FieldLabel htmlFor="database-fields-update">
							Update existing records matching
						</FieldLabel>
						<Input
							id="database-fields-update"
							onChange={(e) =>
								patch({
									databaseFieldsUpdate: e.target.value
										? e.target.value.split(",").map((v) => v.trim())
										: null,
								})
							}
							placeholder="field_id_1, field_id_2"
							value={(settings.databaseFieldsUpdate ?? []).join(", ")}
						/>
						<FieldDescription>
							Comma-separated field ids used to find and update an existing
							submission instead of creating a new one.
						</FieldDescription>
					</Field>
					<Field orientation="horizontal">
						<Checkbox
							checked={settings.clearEmptyFieldsOnUpdate}
							id="clear-empty-on-update"
							onCheckedChange={(checked) =>
								patch({ clearEmptyFieldsOnUpdate: checked === true })
							}
						/>
						<div className="flex flex-col">
							<FieldLabel htmlFor="clear-empty-on-update">
								Clear fields left empty when updating
							</FieldLabel>
							<FieldDescription>
								When updating an existing record above, a field left blank
								overwrites the old answer instead of keeping it.
							</FieldDescription>
						</div>
					</Field>
					<Field orientation="horizontal">
						<Checkbox
							checked={settings.enableIpTracking}
							id="ip-tracking"
							onCheckedChange={(checked) =>
								patch({ enableIpTracking: checked === true })
							}
						/>
						<div className="flex flex-col">
							<FieldLabel htmlFor="ip-tracking">
								Record respondent IP addresses
							</FieldLabel>
							<FieldDescription>
								Stores the submitter's IP with each response. Check your local
								privacy rules before enabling this.
							</FieldDescription>
						</div>
					</Field>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Retention</CardTitle>
					<CardDescription>
						How long submissions are kept before they're automatically deleted.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldSet className="grid grid-cols-2 gap-2">
						<Field>
							<FieldLabel htmlFor="retention-value">
								Keep submissions for
							</FieldLabel>
							<Input
								id="retention-value"
								onChange={(e) =>
									patch({
										submissionRetentionValue: e.target.value
											? Number(e.target.value)
											: null,
									})
								}
								type="number"
								value={settings.submissionRetentionValue ?? ""}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="retention-unit">Unit</FieldLabel>
							<NativeSelect
								id="retention-unit"
								onChange={(e) =>
									patch({
										submissionRetentionUnit: e.target.value
											? (e.target.value as (typeof RETENTION_UNITS)[number])
											: null,
									})
								}
								value={settings.submissionRetentionUnit ?? ""}
							>
								<NativeSelectOption value="">Forever</NativeSelectOption>
								{RETENTION_UNITS.map((unit) => (
									<NativeSelectOption key={unit} value={unit}>
										{unit}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
					</FieldSet>
					<FieldDescription>
						Leave at "Forever" to keep every submission indefinitely. Otherwise,
						submissions older than this are deleted automatically.
					</FieldDescription>
				</CardContent>
			</Card>
		</fieldset>
	);
}
