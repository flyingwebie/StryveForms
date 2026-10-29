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
import { Textarea } from "@StryveForms/ui/components/textarea";
import { UploadButton } from "../shared/upload-button";
import { useEditor } from "../state/editor-context";

export function SeoSection() {
	const { patch, readOnly, state } = useEditor();
	const seo = state.settings.seoMeta;

	function patchSeo(update: Partial<typeof seo>) {
		patch({ seoMeta: { ...seo, ...update } });
	}

	return (
		<fieldset className="flex flex-col gap-5" disabled={readOnly}>
			<Card>
				<CardHeader>
					<CardTitle>Search &amp; social preview</CardTitle>
					<CardDescription>
						What shows up when this form is shared or found in search.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Field>
						<FieldLabel htmlFor="seo-title">Page title</FieldLabel>
						<Input
							id="seo-title"
							onChange={(e) => patchSeo({ page_title: e.target.value })}
							value={seo.page_title ?? ""}
						/>
						<FieldDescription>
							The bold headline shown in search results and the browser tab.
							Defaults to the form's title.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="seo-description">Description</FieldLabel>
						<Textarea
							id="seo-description"
							onChange={(e) => patchSeo({ page_description: e.target.value })}
							value={seo.page_description ?? ""}
						/>
						<FieldDescription>
							The short summary shown under the title in search results and link
							previews (Slack, X, etc.).
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>Thumbnail</FieldLabel>
						<UploadButton
							accept="image/*"
							label={
								seo.page_thumbnail ? "Replace thumbnail" : "Upload thumbnail"
							}
							onUploaded={(url) => patchSeo({ page_thumbnail: url })}
						/>
						<FieldDescription>
							The image shown when this form's link is shared on social media or
							chat apps.
						</FieldDescription>
					</Field>
					<Field>
						<FieldLabel>Favicon</FieldLabel>
						<UploadButton
							accept="image/*"
							label={seo.page_favicon ? "Replace favicon" : "Upload favicon"}
							onUploaded={(url) => patchSeo({ page_favicon: url })}
						/>
						<FieldDescription>
							The small icon shown in the browser tab for this form's public
							page.
						</FieldDescription>
					</Field>
				</CardContent>
			</Card>
		</fieldset>
	);
}
