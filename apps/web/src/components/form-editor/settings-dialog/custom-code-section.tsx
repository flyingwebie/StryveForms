import { Textarea } from "@StryveForms/ui/components/textarea";

import { useEditor } from "../state/editor-context";
import { SettingsFullRow, SettingsSection } from "./settings-row";

export function CustomCodeSection() {
	const { patch, readOnly, state } = useEditor();
	const { settings } = state;

	return (
		<fieldset className="flex flex-col gap-8" disabled={readOnly}>
			<SettingsSection
				description="Add custom CSS and head HTML. Use with care — invalid code can break your form."
				title="Custom code"
			>
				<SettingsFullRow htmlFor="custom-css" label="Custom CSS">
					<Textarea
						className="min-h-32 font-mono"
						id="custom-css"
						onChange={(e) => patch({ customCss: e.target.value })}
						value={settings.customCss ?? ""}
					/>
				</SettingsFullRow>
				<SettingsFullRow htmlFor="custom-head-code" label="Head HTML">
					<Textarea
						className="min-h-32 font-mono"
						id="custom-head-code"
						onChange={(e) => patch({ customCode: e.target.value })}
						value={settings.customCode ?? ""}
					/>
				</SettingsFullRow>
			</SettingsSection>
		</fieldset>
	);
}
