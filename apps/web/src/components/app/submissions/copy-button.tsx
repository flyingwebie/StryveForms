import { Button } from "@StryveForms/ui/components/button";
import { cn } from "@StryveForms/ui/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** A small icon button that copies `text` to the clipboard, with a brief check mark and toast. */
export default function CopyButton({
	className,
	label = "Copy",
	text,
}: {
	className?: string;
	/** Plain-language label for the toast and screen readers, e.g. "Copy submission id". */
	label?: string;
	text: string;
}) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			toast.success(`${label} copied`);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("Couldn't copy to clipboard");
		}
	};

	return (
		<Button
			className={cn("shrink-0 text-muted-foreground", className)}
			onClick={copy}
			size="icon-xs"
			type="button"
			variant="ghost"
		>
			{copied ? (
				<CheckIcon className="size-3.5" />
			) : (
				<CopyIcon className="size-3.5" />
			)}
			<span className="sr-only">{label}</span>
		</Button>
	);
}
