import { Badge } from "@StryveForms/ui/components/badge";
import { Button } from "@StryveForms/ui/components/button";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemMedia,
	ItemTitle,
} from "@StryveForms/ui/components/item";
import { Link } from "@tanstack/react-router";
import {
	EyeIcon,
	FileSearchIcon,
	FileTextIcon,
	FlaskConicalIcon,
	HelpCircleIcon,
	ListIcon,
	Loader2Icon,
	MailIcon,
	PencilIcon,
	PlugIcon,
	SendIcon,
	TrashIcon,
	TriangleAlertIcon,
	UsersIcon,
	WandSparklesIcon,
} from "lucide-react";

/** Friendly label shown while the card is loading or when output has no better summary. */
const TOOL_LABELS: Record<string, string> = {
	create_email_notification: "Create email notification",
	create_form: "Create form",
	create_integration: "Create integration",
	delete_email_notification: "Delete email notification",
	delete_integration: "Delete integration",
	explain_form_logic: "Explain form logic",
	get_form: "Read form",
	get_submission_stats: "Submission stats",
	list_email_notifications: "List email notifications",
	list_forms: "List forms",
	list_integration_types: "List integration types",
	list_integrations: "List integrations",
	list_senders: "List senders",
	preview_email_notification: "Preview email notification",
	search_submissions: "Search submissions",
	send_test_email_notification: "Send test email",
	test_integration: "Test integration",
	update_email_notification: "Update email notification",
	update_form_fields: "Update form fields",
	update_integration: "Update integration",
};

const TOOL_ICONS: Record<string, typeof FileTextIcon> = {
	create_email_notification: MailIcon,
	create_form: WandSparklesIcon,
	create_integration: PlugIcon,
	delete_email_notification: TrashIcon,
	delete_integration: TrashIcon,
	explain_form_logic: HelpCircleIcon,
	get_form: FileTextIcon,
	get_submission_stats: FileSearchIcon,
	list_email_notifications: MailIcon,
	list_forms: ListIcon,
	list_integration_types: HelpCircleIcon,
	list_integrations: PlugIcon,
	list_senders: UsersIcon,
	preview_email_notification: EyeIcon,
	search_submissions: FileSearchIcon,
	send_test_email_notification: SendIcon,
	test_integration: FlaskConicalIcon,
	update_email_notification: PencilIcon,
	update_form_fields: PencilIcon,
	update_integration: PencilIcon,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const countOf = (output: Record<string, unknown>) =>
	Array.isArray(output) ? output.length : "some";

/** One formatter per tool name, keyed the same as TOOL_LABELS/TOOL_ICONS — a
 * lookup table instead of a big switch, so this stays simple to extend. */
const OUTPUT_DESCRIBERS: Record<
	string,
	(output: Record<string, unknown>) => string
> = {
	create_email_notification: () => "Created email notification",
	create_form: (output) => `Created form "${String(output.title ?? "")}"`,
	create_integration: (output) =>
		`Created ${String(output.integrationId ?? "")} integration`,
	explain_form_logic: (output) =>
		output.hasLogic
			? "This form has conditional logic"
			: "No conditional logic on this form",
	get_form: (output) => `Read form "${String(output.title ?? "")}"`,
	get_submission_stats: (output) =>
		`${String(output.completedSubmissions ?? 0)} completed, ${String(output.partialSubmissions ?? 0)} partial`,
	list_email_notifications: (output) =>
		`Found ${countOf(output)} email notification(s)`,
	list_forms: (output) => `Found ${countOf(output)} form(s)`,
	list_integrations: (output) => `Found ${countOf(output)} integration(s)`,
	list_senders: (output) => `Found ${countOf(output)} sender(s)`,
	preview_email_notification: (output) =>
		`Preview: ${String(output.subject ?? "")}`,
	search_submissions: (output) => `Found ${countOf(output)} submission(s)`,
	send_test_email_notification: (output) =>
		`Test email sent to ${String(output.to ?? "")}`,
	test_integration: (output) =>
		output.ok
			? "Test send succeeded"
			: `Test send failed: ${String(output.error ?? "")}`,
	update_form_fields: (output) =>
		`Updated ${String(output.fieldsCount ?? "")} field(s)`,
};

/** What to show once the tool call has a result, per tool. Falls back to the friendly label. */
function describeOutput(name: string, output: unknown): string {
	if (!isRecord(output)) {
		return TOOL_LABELS[name] ?? name;
	}
	return OUTPUT_DESCRIBERS[name]?.(output) ?? TOOL_LABELS[name] ?? name;
}

/** A link to open the affected form, when the tool result carries a form id. */
function openFormLink(name: string, output: unknown) {
	if (!isRecord(output)) {
		return null;
	}
	if (name === "create_form" && typeof output.id === "string") {
		return output.id;
	}
	if (name === "update_form_fields" && typeof output.formId === "string") {
		return output.formId;
	}
	return null;
}

export function ToolCallCard({
	compact,
	input,
	name,
	output,
	state,
}: {
	/** Smaller padding/text — for the narrow editor AI tab. */
	compact?: boolean;
	input?: unknown;
	name: string;
	output?: unknown;
	state: string;
}) {
	const Icon = TOOL_ICONS[name] ?? FileTextIcon;
	// ToolCallState: 'awaiting-input' | 'input-streaming' | 'input-complete' |
	// 'approval-requested' | 'approval-responded' | 'complete' | 'error'.
	const isError = state === "error";
	const isDone = state === "complete" || isError;
	const formId = isDone ? openFormLink(name, output) : null;

	return (
		<Item
			className={compact ? "bg-muted/40 text-xs" : "bg-muted/40"}
			size="sm"
			variant="outline"
		>
			<ItemMedia variant="icon">
				{isDone ? (
					<Icon className={isError ? "text-destructive" : undefined} />
				) : (
					<Loader2Icon className="animate-spin" />
				)}
			</ItemMedia>
			<ItemContent>
				<ItemTitle className={compact ? "text-xs" : undefined}>
					{isDone ? describeOutput(name, output) : (TOOL_LABELS[name] ?? name)}
					{isError ? (
						<Badge variant="destructive">
							<TriangleAlertIcon /> failed
						</Badge>
					) : null}
				</ItemTitle>
				{isError && typeof output === "string" ? (
					<ItemDescription>{output}</ItemDescription>
				) : null}
				{!isDone && isRecord(input) ? (
					<ItemDescription>Working…</ItemDescription>
				) : null}
			</ItemContent>
			{formId && !compact ? (
				<ItemActions>
					<Button
						render={<Link params={{ formId }} to="/editor/$formId" />}
						size="sm"
						variant="outline"
					>
						Open in editor
					</Button>
				</ItemActions>
			) : null}
		</Item>
	);
}
