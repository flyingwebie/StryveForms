import { ANALYTICS_PROVIDERS } from "@StryveForms/forms/settings";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@StryveForms/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldLabel,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";

import { useEditor } from "../state/editor-context";

const PROVIDER_LABEL: Record<(typeof ANALYTICS_PROVIDERS)[number], string> = {
	google_analytics: "Google Analytics",
	gtm: "Google Tag Manager",
	meta_pixel: "Meta Pixel",
};

export function AnalyticsSection() {
	const { patch, readOnly, state } = useEditor();
	const { analytics } = state.settings;

	return (
		<fieldset className="flex flex-col gap-5" disabled={readOnly}>
			<Card>
				<CardHeader>
					<CardTitle>Analytics</CardTitle>
					<CardDescription>
						Track views and submissions for this form in an external analytics
						tool.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Field>
						<FieldLabel htmlFor="analytics-provider">Provider</FieldLabel>
						<NativeSelect
							id="analytics-provider"
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
						<FieldDescription>
							Sends a page-view event when this form loads, and a conversion
							event on each successful submission.
						</FieldDescription>
					</Field>
					{analytics.provider ? (
						<Field>
							<FieldLabel htmlFor="analytics-tracking-id">
								Tracking id
							</FieldLabel>
							<Input
								id="analytics-tracking-id"
								onChange={(e) =>
									patch({
										analytics: { ...analytics, tracking_id: e.target.value },
									})
								}
								value={analytics.tracking_id ?? ""}
							/>
							<FieldDescription>
								The measurement / pixel / container id from the provider above,
								e.g. "G-XXXXXXX" for Google Analytics.
							</FieldDescription>
						</Field>
					) : null}
				</CardContent>
			</Card>
		</fieldset>
	);
}
