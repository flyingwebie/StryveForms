import { Button } from "@StryveForms/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@StryveForms/ui/components/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, FileTextIcon, PaperclipIcon } from "lucide-react";

import { useTRPC } from "@/utils/trpc";

const NO_FORM = "none";

/**
 * Lets the user attach, switch, or detach the form the assistant is
 * focused on, without starting a new chat. Changing it updates the chat's
 * `formId` so the next message's system prompt is grounded in the new
 * form (or in none), and leaves a note in the transcript.
 */
export function FormContextPicker({
	formId,
	onChange,
	workspaceId,
}: {
	formId: string | null;
	onChange: (formId: string | null) => void;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const forms = useQuery(trpc.form.list.queryOptions({ workspaceId }));

	const items = [
		{ label: "No form (general questions)", value: NO_FORM },
		...(forms.data ?? []).map((form) => ({
			label: form.title,
			value: form.id,
		})),
	];

	return (
		<Select
			items={items}
			onValueChange={(value) => onChange(value === NO_FORM ? null : value)}
			value={formId ?? NO_FORM}
		>
			<SelectTrigger className="max-w-56" size="sm">
				<FileTextIcon />
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/**
 * The composer's "Attach form" trigger: a plain text link (matching the
 * design's `📎 Attach form` caption) that opens a menu of this workspace's
 * forms — the no-frills counterpart to `FormContextPicker` for the message bar.
 */
export function ComposerAttachFormButton({
	formId,
	onChange,
	workspaceId,
}: {
	formId: string | null;
	onChange: (formId: string | null) => void;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const forms = useQuery(trpc.form.list.queryOptions({ workspaceId }));

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						className="text-muted-foreground"
						size="sm"
						type="button"
						variant="ghost"
					/>
				}
			>
				<PaperclipIcon /> Attach form
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
				<DropdownMenuItem onClick={() => onChange(null)}>
					{formId === null ? <CheckIcon /> : <span className="size-4" />}
					No form (general questions)
				</DropdownMenuItem>
				{(forms.data ?? []).map((form) => (
					<DropdownMenuItem key={form.id} onClick={() => onChange(form.id)}>
						{formId === form.id ? <CheckIcon /> : <span className="size-4" />}
						{form.title}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
