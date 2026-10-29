import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/utils/trpc";

import { ShareContent } from "./share-content";

/**
 * Share dialog for a form: link, social, QR code, pre-fill, embed.
 * Opened from the form header, editor, and forms list.
 */
export interface ShareDialogProps {
	formId: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export default function ShareDialog({
	formId,
	onOpenChange,
	open,
}: ShareDialogProps) {
	const trpc = useTRPC();
	const formQuery = useQuery({
		...trpc.form.get.queryOptions({ id: formId }),
		enabled: open,
	});

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] min-w-0 overflow-y-auto overflow-x-hidden sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>Share this form</DialogTitle>
					<DialogDescription>
						Send the link, share it on social, or embed it anywhere.
					</DialogDescription>
				</DialogHeader>
				{formQuery.data ? (
					<ShareContent form={formQuery.data} />
				) : (
					<div className="space-y-4">
						<Skeleton className="h-9 w-full" />
						<Skeleton className="h-40 w-full" />
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
