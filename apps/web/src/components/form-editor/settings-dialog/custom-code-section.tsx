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
import { Textarea } from "@StryveForms/ui/components/textarea";

import { useEditor } from "../state/editor-context";

export function CustomCodeSection() {
	const { patch, readOnly, state } = useEditor();
	const { settings } = state;

	return (
		<fieldset className="flex flex-col gap-5" disabled={readOnly}>
			<Card>
				<CardHeader>
					<CardTitle>Custom code</CardTitle>
					<CardDescription>
						Advanced: only use this if you know what you're doing. Runs exactly
						as written on your form's public page, for every visitor.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Field>
						<FieldLabel htmlFor="custom-css">Custom CSS</FieldLabel>
						<Textarea
							className="min-h-32 font-mono"
							id="custom-css"
							onChange={(e) => patch({ customCss: e.target.value })}
							value={settings.customCss ?? ""}
						/>
						<FieldDescription>
							Extra CSS rules injected after the form's theme, to tweak styling
							the built-in design options don't cover.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="custom-head-code">Custom head code</FieldLabel>
						<Textarea
							className="min-h-32 font-mono"
							id="custom-head-code"
							onChange={(e) => patch({ customCode: e.target.value })}
							value={settings.customCode ?? ""}
						/>
						<FieldDescription>
							Raw HTML (scripts, meta tags, style blocks) inserted into the
							page's &lt;head&gt;. Treat this like code you trust — it runs for
							every respondent.
						</FieldDescription>
					</Field>
				</CardContent>
			</Card>
		</fieldset>
	);
}
