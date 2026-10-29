import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@StryveForms/ui/components/alert-dialog";
import type { ReactNode } from "react";

/** A controlled confirm dialog for destructive actions (delete, remove, etc.). */
export default function ConfirmDialog({
	children,
	confirmLabel = "Delete",
	description,
	loading = false,
	onConfirm,
	onOpenChange,
	open,
	title,
}: {
	children?: ReactNode;
	confirmLabel?: string;
	description: ReactNode;
	loading?: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	title: string;
}) {
	const actionLabel = loading ? "Working…" : confirmLabel;

	return (
		<AlertDialog onOpenChange={onOpenChange} open={open}>
			{children}
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						disabled={loading}
						onClick={onConfirm}
						variant="destructive"
					>
						{actionLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
