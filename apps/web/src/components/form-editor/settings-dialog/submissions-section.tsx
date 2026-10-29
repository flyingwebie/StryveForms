import { RETENTION_UNITS } from "@StryveForms/forms/settings";
import type { FormField } from "@StryveForms/forms/types";
import { FieldLabel } from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import { Switch } from "@StryveForms/ui/components/switch";
import { useState } from "react";

import { useEditor } from "../state/editor-context";
import { RedirectBuilder } from "./redirect-builder";
import { SettingsFullRow, SettingsRow, SettingsSection } from "./settings-row";

/**
 * "Redirect after submit" is purely a UI affordance: toggling it off hides
 * (and clears) the redirect URL, matching the design's single on/off switch;
 * toggling it back on just reveals an empty builder again. No new backend
 * concept — `redirectUrl` truthy already meant "redirect instead of the
 * thank-you screen" before this switch existed.
 */
function RedirectSection() {
	const { patch, state } = useEditor();
	const { settings } = state;
	const [enabled, setEnabled] = useState(Boolean(settings.redirectUrl));

	return (
		<SettingsRow
			description="Send respondents to a URL instead of the thank-you screen."
			expanded={enabled ? <RedirectBuilder /> : null}
			label="Redirect after submit"
		>
			<div className="flex justify-end">
				<Switch
					checked={enabled}
					onCheckedChange={(checked) => {
						setEnabled(checked);
						if (!checked) {
							patch({ redirectUrl: null });
						}
					}}
				/>
			</div>
		</SettingsRow>
	);
}

export function SubmissionsSection() {
	const { patch, readOnly, state } = useEditor();
	const { settings } = state;
	const mentions = (settings.properties as FormField[]).map((field) => ({
		id: field.id,
		label: field.name,
	}));
	const isFocused = settings.presentationStyle === "focused";

	return (
		<fieldset className="flex flex-col gap-8" disabled={readOnly}>
			<SettingsSection title="After submit">
				<SettingsRow
					description='Replaces the default "Submit" label on the final button.'
					htmlFor="submit-button-text"
					label="Submit button text"
				>
					<Input
						id="submit-button-text"
						onChange={(e) => patch({ submitButtonText: e.target.value })}
						placeholder="Submit"
						value={settings.submitButtonText ?? ""}
					/>
				</SettingsRow>
				{isFocused && (
					<SettingsRow
						description='Shown instead of "Next" between one-question-at-a-time screens.'
						htmlFor="focused-next-text"
						label='Focused mode "Next" text'
					>
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
					</SettingsRow>
				)}
				<SettingsRow
					description='Shown on the thank-you screen. Insert an answer with "@".'
					label="Success message"
				>
					<RichTextEditor
						mentions={mentions}
						onChange={(html) => patch({ submittedText: html })}
						toolbar="basic"
						value={settings.submittedText ?? ""}
					/>
				</SettingsRow>
				<RedirectSection />
			</SettingsSection>

			<SettingsSection title="Respondent options">
				<SettingsRow
					description="Lets a respondent submit another response without reopening the link."
					expanded={
						settings.reFillable ? (
							<div className="flex max-w-sm flex-col gap-1.5">
								<FieldLabel htmlFor="refill-button-text">
									Button text
								</FieldLabel>
								<Input
									id="refill-button-text"
									onChange={(e) => patch({ reFillButtonText: e.target.value })}
									placeholder="Fill again"
									value={settings.reFillButtonText ?? ""}
								/>
							</div>
						) : null
					}
					label="Allow filling again"
				>
					<div className="flex justify-end">
						<Switch
							checked={settings.reFillable}
							id="refillable"
							onCheckedChange={(checked) => patch({ reFillable: checked })}
						/>
					</div>
				</SettingsRow>
				<SettingsRow
					description='Adds an "Edit" button that reopens the form pre-filled.'
					expanded={
						settings.editableSubmissions ? (
							<div className="flex max-w-sm flex-col gap-1.5">
								<FieldLabel htmlFor="edit-button-text">Button text</FieldLabel>
								<Input
									id="edit-button-text"
									onChange={(e) =>
										patch({ editableSubmissionsButtonText: e.target.value })
									}
									placeholder="Edit"
									value={settings.editableSubmissionsButtonText ?? ""}
								/>
							</div>
						) : null
					}
					label="Let respondents edit their answers"
				>
					<div className="flex justify-end">
						<Switch
							checked={settings.editableSubmissions}
							id="editable-submissions"
							onCheckedChange={(checked) =>
								patch({ editableSubmissions: checked })
							}
						/>
					</div>
				</SettingsRow>
			</SettingsSection>

			<SettingsSection title="Submission behavior">
				<SettingsRow label="Allow partial submissions">
					<div className="flex justify-end">
						<Switch
							checked={settings.enablePartialSubmissions}
							id="partial-submissions"
							onCheckedChange={(checked) =>
								patch({ enablePartialSubmissions: checked })
							}
						/>
					</div>
				</SettingsRow>
				<SettingsRow label="Autosave progress">
					<div className="flex justify-end">
						<Switch
							checked={settings.autoSave}
							id="auto-save"
							onCheckedChange={(checked) => patch({ autoSave: checked })}
						/>
					</div>
				</SettingsRow>
				<SettingsRow
					description="Comma-separated field ids used to find and update an existing record."
					htmlFor="database-fields-update"
					label="Update existing records matching"
				>
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
				</SettingsRow>
				<SettingsRow label="Clear fields left empty when updating">
					<div className="flex justify-end">
						<Switch
							checked={settings.clearEmptyFieldsOnUpdate}
							id="clear-empty-on-update"
							onCheckedChange={(checked) =>
								patch({ clearEmptyFieldsOnUpdate: checked })
							}
						/>
					</div>
				</SettingsRow>
				<SettingsRow label="Record IP addresses">
					<div className="flex justify-end">
						<Switch
							checked={settings.enableIpTracking}
							id="ip-tracking"
							onCheckedChange={(checked) =>
								patch({ enableIpTracking: checked })
							}
						/>
					</div>
				</SettingsRow>
			</SettingsSection>

			<SettingsFullRow
				description="How long submissions are kept."
				label="Retention"
			>
				<div className="flex items-center gap-2">
					<Input
						className="w-28"
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
					<NativeSelect
						onChange={(e) =>
							patch({
								submissionRetentionUnit: e.target.value
									? (e.target.value as (typeof RETENTION_UNITS)[number])
									: null,
							})
						}
						value={settings.submissionRetentionUnit ?? ""}
					>
						<NativeSelectOption value="">Keep forever</NativeSelectOption>
						{RETENTION_UNITS.map((unit) => (
							<NativeSelectOption key={unit} value={unit}>
								{unit}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</div>
			</SettingsFullRow>
		</fieldset>
	);
}
