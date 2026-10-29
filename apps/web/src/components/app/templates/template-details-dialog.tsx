import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { cn } from "@StryveForms/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

/** Emoji choices, chosen to echo the design's clipboard/chat/calendar/… icon row. The
 * `icon` DB column caps at 10 chars, so these stay single glyphs rather than icon names. */
const TEMPLATE_ICONS = ["📋", "💬", "📅", "💼", "📈", "🎓", "❤️", "📁"] as const;

/** Accent colours offered for a template — a user choice, like a folder colour. */
const TEMPLATE_COLORS = [
	"#0f172a",
	"#22c55e",
	"#f97316",
	"#ef4444",
	"#3b82f6",
	"#a78bfa",
	"#14b8a6",
	"#ec4899",
] as const;

export interface TemplateDetailsTarget {
	category: string | null;
	color: string | null;
	description: string | null;
	icon: string | null;
	id: string;
	name: string;
}

/** Edit an existing workspace template's name, description, category, colour and icon. */
export default function TemplateDetailsDialog({
	onOpenChange,
	open,
	template,
	workspaceId,
}: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	template: TemplateDetailsTarget | null;
	workspaceId: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState("");
	const [color, setColor] = useState<string | undefined>();
	const [icon, setIcon] = useState<string | undefined>();

	useEffect(() => {
		if (open && template) {
			setName(template.name);
			setDescription(template.description ?? "");
			setCategory(template.category ?? "");
			setColor(template.color ?? undefined);
			setIcon(template.icon ?? undefined);
		}
	}, [open, template]);

	const update = useMutation(
		trpc.template.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.template.listMine.queryKey({ workspaceId }),
				});
				toast.success("Template updated");
				onOpenChange(false);
			},
		})
	);

	function handleSubmit() {
		if (!template) {
			return;
		}
		const trimmed = name.trim();
		if (!trimmed) {
			toast.error("Give the template a name");
			return;
		}
		update.mutate({
			id: template.id,
			name: trimmed,
			description: description.trim() || null,
			category: category.trim() || null,
			color: color ?? null,
			icon: icon ?? null,
		});
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Edit template details</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="template-edit-name">Name</Label>
						<Input
							id="template-edit-name"
							onChange={(event) => setName(event.target.value)}
							value={name}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="template-edit-description">Description</Label>
						<Textarea
							id="template-edit-description"
							onChange={(event) => setDescription(event.target.value)}
							rows={2}
							value={description}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="template-edit-category">Category</Label>
						<Input
							id="template-edit-category"
							onChange={(event) => setCategory(event.target.value)}
							placeholder="e.g. HR, Events, Marketing"
							value={category}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Icon</Label>
						<div className="flex flex-wrap gap-1.5">
							{TEMPLATE_ICONS.map((option) => (
								<button
									aria-pressed={option === icon}
									className={cn(
										"flex size-9 items-center justify-center rounded-lg border border-border text-base transition-colors hover:bg-muted",
										option === icon &&
											"border-ring bg-primary-soft ring-1 ring-ring"
									)}
									key={option}
									onClick={() => setIcon(option === icon ? undefined : option)}
									type="button"
								>
									{option}
								</button>
							))}
						</div>
					</div>
					<div className="space-y-1.5">
						<Label>Colour</Label>
						<div className="flex flex-wrap gap-2">
							{TEMPLATE_COLORS.map((option) => (
								<button
									aria-label={`Colour ${option}`}
									aria-pressed={option === color}
									className="flex size-8 items-center justify-center rounded-full ring-1 ring-border ring-offset-2 ring-offset-background data-selected:ring-2 data-selected:ring-foreground"
									data-selected={option === color}
									key={option}
									onClick={() =>
										setColor(option === color ? undefined : option)
									}
									style={{ backgroundColor: option }}
									type="button"
								>
									{option === color ? (
										<CheckIcon className="size-4 text-white" />
									) : null}
								</button>
							))}
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={update.isPending}
						onClick={handleSubmit}
						type="button"
					>
						<CheckIcon /> Save changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
