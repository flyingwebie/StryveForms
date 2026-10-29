import { Input } from "@StryveForms/ui/components/input";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { ImageIcon } from "lucide-react";
import { UploadButton } from "../shared/upload-button";
import { useEditor } from "../state/editor-context";
import { SettingsFullRow, SettingsRow, SettingsSection } from "./settings-row";

const PROTOCOL_PREFIX = /^https?:\/\//;

function SearchPreview({
	description,
	title,
	url,
}: {
	description: string;
	title: string;
	url: string;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
			<span className="text-muted-foreground text-xs">
				Search result preview
			</span>
			<span className="truncate text-muted-foreground text-xs">{url}</span>
			<span className="truncate font-medium text-primary text-sm">{title}</span>
			<p className="line-clamp-2 text-muted-foreground text-xs">
				{description}
			</p>
		</div>
	);
}

export function SeoSection() {
	const { meta, patch, readOnly, state } = useEditor();
	const seo = state.settings.seoMeta;

	function patchSeo(update: Partial<typeof seo>) {
		patch({ seoMeta: { ...seo, ...update } });
	}

	const title = seo.page_title || state.settings.title;
	const description = seo.page_description || "";
	const url = meta.shareUrl.replace(PROTOCOL_PREFIX, "");

	return (
		<fieldset className="flex flex-col gap-8" disabled={readOnly}>
			<SettingsSection title="SEO">
				<SettingsFullRow>
					<SearchPreview description={description} title={title} url={url} />
				</SettingsFullRow>
				<SettingsRow
					description="Shown in browser tabs and search results."
					htmlFor="seo-title"
					label="Meta title"
				>
					<Input
						id="seo-title"
						onChange={(e) => patchSeo({ page_title: e.target.value })}
						value={seo.page_title ?? ""}
					/>
				</SettingsRow>
				<SettingsRow
					description="Appears below the title in search results."
					htmlFor="seo-description"
					label="Meta description"
				>
					<Textarea
						id="seo-description"
						onChange={(e) => patchSeo({ page_description: e.target.value })}
						value={seo.page_description ?? ""}
					/>
				</SettingsRow>
				<SettingsRow
					description="Shown when the link is shared."
					label="Social thumbnail"
				>
					<div className="flex justify-end">
						{seo.page_thumbnail ? (
							<img
								alt=""
								className="size-14 rounded-lg border border-border object-cover"
								height={56}
								src={seo.page_thumbnail}
								width={56}
							/>
						) : (
							<div className="flex size-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#4338CA]">
								<ImageIcon className="size-5 text-white" />
							</div>
						)}
					</div>
					<div className="flex justify-end">
						<UploadButton
							accept="image/*"
							label={
								seo.page_thumbnail ? "Replace thumbnail" : "Upload thumbnail"
							}
							onUploaded={(url_) => patchSeo({ page_thumbnail: url_ })}
						/>
					</div>
				</SettingsRow>
				<SettingsRow description="Shown in the browser tab." label="Favicon">
					<div className="flex justify-end">
						<UploadButton
							accept="image/*"
							label={seo.page_favicon ? "Replace favicon" : "Upload favicon"}
							onUploaded={(url_) => patchSeo({ page_favicon: url_ })}
						/>
					</div>
				</SettingsRow>
			</SettingsSection>
		</fieldset>
	);
}
