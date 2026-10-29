import { ANALYTICS_PROVIDERS } from "@StryveForms/forms/settings";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import { InfoIcon } from "lucide-react";

import { useEditor } from "../state/editor-context";
import { SettingsFullRow, SettingsRow, SettingsSection } from "./settings-row";

const PROVIDER_LABEL: Record<(typeof ANALYTICS_PROVIDERS)[number], string> = {
	google_analytics: "Google Analytics",
	gtm: "Google Tag Manager",
	meta_pixel: "Meta Pixel",
};

export function AnalyticsSection() {
	const { patch, readOnly, state } = useEditor();
	const { analytics } = state.settings;

	return (
		<fieldset className="flex flex-col gap-8" disabled={readOnly}>
			<SettingsSection
				description="Send form views and submissions to an external analytics tool."
				title="Analytics"
			>
				<SettingsRow label="Provider">
					<NativeSelect
						onChange={(e) =>
							patch({
								analytics: {
									...analytics,
									provider: e.target.value
										? (e.target.value as (typeof ANALYTICS_PROVIDERS)[number])
										: null,
								},
							})
						}
						value={analytics.provider ?? ""}
					>
						<NativeSelectOption value="">None</NativeSelectOption>
						{ANALYTICS_PROVIDERS.map((provider) => (
							<NativeSelectOption key={provider} value={provider}>
								{PROVIDER_LABEL[provider]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</SettingsRow>
				{analytics.provider ? (
					<SettingsRow label="Measurement ID">
						<Input
							onChange={(e) =>
								patch({
									analytics: { ...analytics, tracking_id: e.target.value },
								})
							}
							placeholder="G-XXXXXXX"
							value={analytics.tracking_id ?? ""}
						/>
					</SettingsRow>
				) : null}
				<SettingsFullRow>
					<div className="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-info text-sm">
						<InfoIcon className="mt-0.5 size-4 shrink-0" />
						<p>
							<span className="font-medium">Analytics events</span> — We send
							form_view, form_start, and form_submit events with no personal
							data attached.
						</p>
					</div>
				</SettingsFullRow>
			</SettingsSection>
		</fieldset>
	);
}
