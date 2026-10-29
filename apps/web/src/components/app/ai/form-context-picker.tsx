import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import { FileTextIcon } from "lucide-react";

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
