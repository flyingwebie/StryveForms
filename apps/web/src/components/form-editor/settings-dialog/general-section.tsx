import { VISIBILITIES } from "@StryveForms/forms/settings";
import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
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
	FieldSet,
} from "@StryveForms/ui/components/field";
import { Input } from "@StryveForms/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@StryveForms/ui/components/native-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";
import { VISIBILITY_META } from "../shared/visibility";
import { useEditor } from "../state/editor-context";

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
		<Field>
			<FieldLabel htmlFor="form-tags">Tags</FieldLabel>
			<div className="flex flex-wrap gap-1.5">
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
			<FieldDescription>
				Keywords to organize and filter forms in your dashboard. Respondents
				never see these.
			</FieldDescription>
		</Field>
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
		<Field>
			<FieldLabel htmlFor="form-slug">Link</FieldLabel>
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
			<FieldDescription>
				The URL respondents use to open this form: {meta.shareUrl}. Changing it
				breaks any copies of the old link you've already shared.
			</FieldDescription>
		</Field>
	);
}

export function GeneralSection() {
	const { patch, readOnly, state } = useEditor();
	const { visibility } = state.settings;

	return (
		<fieldset className="flex flex-col gap-5" disabled={readOnly}>
			<Card>
				<CardHeader>
					<CardTitle>Basics</CardTitle>
					<CardDescription>Identity and access for this form.</CardDescription>
				</CardHeader>
				<CardContent>
					<FieldSet>
						<Field>
							<FieldLabel htmlFor="form-title">Title</FieldLabel>
							<Input
								id="form-title"
								onChange={(e) => patch({ title: e.target.value })}
								value={state.settings.title}
							/>
							<FieldDescription>
								Shown in your dashboard and as the public page's heading.
							</FieldDescription>
						</Field>
						<TagEditor />
						<Field>
							<FieldLabel htmlFor="form-visibility">Visibility</FieldLabel>
							<NativeSelect
								id="form-visibility"
								onChange={(e) =>
									patch({
										visibility: e.target.value as (typeof VISIBILITIES)[number],
									})
								}
								value={visibility}
							>
								{VISIBILITIES.map((option) => (
									<NativeSelectOption key={option} value={option}>
										{VISIBILITY_META[option].label}
									</NativeSelectOption>
								))}
							</NativeSelect>
							<FieldDescription>
								{VISIBILITY_META[visibility].description}
							</FieldDescription>
						</Field>
						<SlugEditor />
					</FieldSet>
				</CardContent>
			</Card>
		</fieldset>
	);
}
