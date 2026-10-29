import { VISIBILITIES } from "@StryveForms/forms/settings";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";
import { SegmentedControl } from "../design/segmented-control";
import { VISIBILITY_META } from "../shared/visibility";
import { useEditor } from "../state/editor-context";
import { SettingsRow, SettingsSection } from "./settings-row";

function TagEditor() {
	const { patch, state } = useEditor();
	const [draft, setDraft] = useState("");

	function addTag() {
		const tag = draft.trim();
		if (tag && !state.settings.tags.includes(tag)) {
			patch({ tags: [...state.settings.tags, tag] });
		}
		setDraft("");
	}

	return (
		<SettingsRow
			description="Organize this form in search and filters."
			htmlFor="form-tags"
			label="Tags"
		>
			<div className="flex flex-wrap items-center gap-1.5">
				{state.settings.tags.map((tag) => (
					<Badge key={tag} variant="secondary">
						{tag}
						<button
							onClick={() =>
								patch({ tags: state.settings.tags.filter((t) => t !== tag) })
							}
							type="button"
						>
							<XIcon className="size-3" />
						</button>
					</Badge>
				))}
			</div>
			<Input
				id="form-tags"
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						addTag();
					}
				}}
				placeholder="Add a tag and press Enter"
				value={draft}
			/>
		</SettingsRow>
	);
}

function SlugEditor() {
	const { meta } = useEditor();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [slug, setSlug] = useState(meta.slug);
	const setSlugMutation = useMutation(
		trpc.form.setSlug.mutationOptions({
			onError: (error) =>
				toast.error("Couldn't update the link", {
					description: error.message,
				}),
			onSuccess: async (result) => {
				setSlug(result.slug);
				toast.success("Link updated");
				await queryClient.invalidateQueries({
					queryKey: trpc.form.get.queryKey({ id: meta.id }),
				});
			},
		})
	);

	return (
		<SettingsRow
			description="Your form's public URL."
			htmlFor="form-slug"
			label="Link"
		>
			<div className="flex gap-2">
				<Input
					id="form-slug"
					onChange={(e) => setSlug(e.target.value)}
					value={slug}
				/>
				<Button
					disabled={setSlugMutation.isPending || slug === meta.slug}
					onClick={() => setSlugMutation.mutate({ id: meta.id, slug })}
					size="sm"
					type="button"
					variant="outline"
				>
					Update
				</Button>
			</div>
			<p className="text-muted-foreground text-xs">
				{meta.shareUrl}. Changing it breaks any copies of the old link you've
				already shared.
			</p>
		</SettingsRow>
	);
}

export function GeneralSection() {
	const { patch, readOnly, state } = useEditor();
	const { visibility } = state.settings;

	return (
		<fieldset className="flex flex-col gap-8" disabled={readOnly}>
			<SettingsSection title="General">
				<SettingsRow
					description="Shown in the editor and browser tab."
					htmlFor="form-title"
					label="Form title"
				>
					<Input
						id="form-title"
						onChange={(e) => patch({ title: e.target.value })}
						value={state.settings.title}
					/>
				</SettingsRow>
				<SettingsRow
					description="Who can open the public link."
					label="Visibility"
				>
					<SegmentedControl
						ariaLabel="Visibility"
						onChange={(next) => patch({ visibility: next })}
						options={VISIBILITIES.map((option) => ({
							label: VISIBILITY_META[option].label,
							value: option,
						}))}
						value={visibility}
					/>
					<p className="text-muted-foreground text-xs">
						{VISIBILITY_META[visibility].description}
					</p>
				</SettingsRow>
				<SlugEditor />
				<TagEditor />
			</SettingsSection>
		</fieldset>
	);
}
