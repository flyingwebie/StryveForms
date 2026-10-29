import { Button } from "@StryveForms/ui/components/button";
import { Link } from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";

/**
 * Drop-in entry point to the AI assistant. Used from a form's editor/toolbar
 * to jump straight into a chat about that form; omit `formId` for a general
 * assistant link (e.g. from the dashboard or an empty state).
 */
export function AskAiButton({
	formId,
	size = "sm",
	variant = "outline",
}: {
	formId?: string;
	size?: "default" | "sm" | "icon";
	variant?: "default" | "outline" | "ghost" | "secondary";
}) {
	return (
		<Button
			render={
				<Link search={formId ? { formId } : {}} to="/dashboard/assistant" />
			}
			size={size}
			variant={variant}
		>
			<SparklesIcon /> Ask AI
		</Button>
	);
}
