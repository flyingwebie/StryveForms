import type { FormDto } from "@StryveForms/api/lib/serialize";
import { mentionHtml } from "@StryveForms/forms/mentions";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@StryveForms/ui/components/collapsible";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import type { AiToolbarConfig } from "@StryveForms/ui/components/rich-text-editor";
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Separator } from "@StryveForms/ui/components/separator";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { Switch } from "@StryveForms/ui/components/switch";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, ChevronDownIcon, SaveIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/app/confirm-dialog";
import ConditionPicker, {
	conditionToLogic,
	logicToCondition,
	type SimpleCondition,
} from "@/components/app/integrations/condition-picker";
import SenderSelect from "@/components/app/settings/sender-select";
import { uploadAsset } from "@/lib/upload-asset";
import { useTRPC } from "@/utils/trpc";

import type { NotificationRecord } from "./notification-row";

const NONE_VALUE = "none";
const DEBOUNCE_MS = 400;

/** The "email" integration's `data` jsonb shape, as edited by this tab. */
export interface EmailNotificationData {
	attach_pdf_template_id?: string;
	email_content?: string;
	include_hidden_fields_submission_data?: boolean;
	include_submission_data?: boolean;
	link_edit_submission?: boolean;
	reply_to?: string;
	send_to?: string;
	sender_name?: string;
	/** Picked via `SenderSelect`; null means "workspace default sender". */
	senderId?: string | null;
	subject?: string;
	// Index signature: matches `formIntegration.data`'s `Record<string, unknown>`
	// and the server's passthrough zod schema, so this can be passed straight
	// to `integration.create/update` and `writer.*` without reshaping.
	[key: string]: unknown;
}

type SetData = (
	updater: (data: EmailNotificationData) => EmailNotificationData
) => void;

/** How long to wait for the editors to settle before tracking changes. */
const BASELINE_MS = 400;

function Field({ children, label }: { children: ReactNode; label: string }) {
	return (
		<div className="space-y-1.5">
			<Label>{label}</Label>
			{children}
		</div>
	);
}

function CheckField({
	checked,
	label,
	onChange,
}: {
	checked: boolean;
	label: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center gap-2 text-sm">
			<Checkbox
				checked={checked}
				onCheckedChange={(c) => onChange(c === true)}
			/>
			<Label>{label}</Label>
		</div>
	);
}

/** Sender picker plus a collapsed "Advanced" section for per-notification overrides. */
function SenderFields({
	data,
	setData,
	workspaceId,
}: {
	data: EmailNotificationData;
	setData: SetData;
	workspaceId: string;
}) {
	const [advancedOpen, setAdvancedOpen] = useState(false);
	return (
		<div className="space-y-2">
			<Label>Sender</Label>
			<SenderSelect
				onChange={(senderId) => setData((d) => ({ ...d, senderId }))}
				value={data.senderId ?? null}
				workspaceId={workspaceId}
			/>
			<Collapsible onOpenChange={setAdvancedOpen} open={advancedOpen}>
				<CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground">
					<ChevronDownIcon
						className={advancedOpen ? "size-3 rotate-180" : "size-3"}
					/>
					Advanced: override sender name / reply-to
				</CollapsibleTrigger>
				<CollapsibleContent className="grid grid-cols-2 gap-3 pt-2">
					<Field label="Sender name override">
						<Input
							aria-label="Sender name override"
							onChange={(event) =>
								setData((d) => ({ ...d, sender_name: event.target.value }))
							}
							value={data.sender_name ?? ""}
						/>
					</Field>
					<Field label="Reply-to override">
						<Input
							aria-label="Reply-to override"
							onChange={(event) =>
								setData((d) => ({ ...d, reply_to: event.target.value }))
							}
							value={data.reply_to ?? ""}
						/>
					</Field>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

interface PdfTemplateOption {
	id: string;
	name: string;
}

/** "Attach PDF": pick a PDF template to render and attach to this notification. */
function AttachPdfField({
	data,
	setData,
	templates,
}: {
	data: EmailNotificationData;
	setData: SetData;
	templates: PdfTemplateOption[];
}) {
	if (templates.length === 0) {
		return null;
	}
	const value = data.attach_pdf_template_id || NONE_VALUE;
	return (
		<Field label="Attach PDF">
			<Select
				items={[
					{ label: "None", value: NONE_VALUE },
					...templates.map((t) => ({ label: t.name, value: t.id })),
				]}
				onValueChange={(next) =>
					setData((d) => ({
						...d,
						attach_pdf_template_id: next && next !== NONE_VALUE ? next : "",
					}))
				}
				value={value}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NONE_VALUE}>None</SelectItem>
					{templates.map((t) => (
						<SelectItem key={t.id} value={t.id}>
							{t.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

interface PreviewData {
	fromAddress?: string;
	html: string;
	recipients: string[];
	senderName: string;
	subject: string;
}

/** Right-hand column: a live, real render of the email, with a light/dark toggle and "send test". */
function PreviewPanel({
	attachedTemplateName,
	colorScheme,
	data,
	formId,
	onColorSchemeChange,
	preview,
	sendTest,
}: {
	attachedTemplateName?: string;
	colorScheme: "light" | "dark";
	data: EmailNotificationData;
	formId: string;
	onColorSchemeChange: (scheme: "light" | "dark") => void;
	preview: PreviewData | undefined;
	/** Only the bits of the `writer.sendTest` mutation this panel needs — kept
	 * loose so it doesn't have to repeat tRPC's inferred error type. */
	sendTest: {
		isPending: boolean;
		mutate: (input: { data: EmailNotificationData; formId: string }) => void;
	};
}) {
	return (
		<div className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-muted/20 lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100svh-10rem)] lg:w-[440px] lg:shrink-0 lg:overflow-y-auto xl:w-[480px]">
			<div className="flex items-center justify-between gap-2 border-border border-b p-4">
				<p className="font-medium text-sm">Live preview</p>
				<div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
					<Button
						onClick={() => onColorSchemeChange("light")}
						size="sm"
						variant={colorScheme === "light" ? "secondary" : "ghost"}
					>
						Light
					</Button>
					<Button
						onClick={() => onColorSchemeChange("dark")}
						size="sm"
						variant={colorScheme === "dark" ? "secondary" : "ghost"}
					>
						Dark
					</Button>
				</div>
			</div>

			<div className="space-y-4 p-4">
				<div className="overflow-hidden rounded-xl border border-border">
					<div className="space-y-1 border-border border-b bg-background p-3 text-xs">
						<p>
							<span className="text-muted-foreground">From: </span>
							{preview?.fromAddress
								? `${preview.senderName} <${preview.fromAddress}>`
								: "Workspace default sender"}
						</p>
						<p>
							<span className="text-muted-foreground">To: </span>
							{preview?.recipients.length
								? preview.recipients.join(", ")
								: "No recipients set yet"}
						</p>
						<p>
							<span className="text-muted-foreground">Subject: </span>
							{preview?.subject ?? "…"}
						</p>
					</div>
					{preview ? (
						<iframe
							className="h-[min(560px,calc(100svh-24rem))] w-full border-0 bg-white"
							key={colorScheme}
							sandbox=""
							srcDoc={preview.html}
							title="Email preview"
						/>
					) : (
						<Skeleton className="h-[480px] w-full rounded-none" />
					)}
				</div>

				{attachedTemplateName ? (
					<p className="text-muted-foreground text-xs">
						📎 Attaches{" "}
						<span className="font-medium">{attachedTemplateName}</span>
						.pdf
					</p>
				) : null}

				<Button
					className="w-full"
					disabled={sendTest.isPending}
					onClick={() => sendTest.mutate({ data, formId })}
					variant="outline"
				>
					{sendTest.isPending ? "Sending…" : "Send test email to me"}
				</Button>
				<p className="text-muted-foreground text-xs">
					Uses the form's latest submission (or sample values if there isn't one
					yet) and always sends to your own address, regardless of "Send to"
					above.
				</p>
			</div>
		</div>
	);
}

/**
 * Add/edit view for one email notification, shown inside the form's
 * "Email notifications" tab: a header with Back / Active / Save, settings on
 * the left and a live preview of the real rendered email on the right.
 */
export default function NotificationEditor({
	existing,
	form,
	onClose,
}: {
	existing: NotificationRecord | null;
	form: FormDto;
	/** Leaves the editor (after saving, or when going back). */
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [data, setData] = useState<EmailNotificationData>({});
	const [debounced, setDebounced] = useState<EmailNotificationData>({});
	const [active, setActive] = useState(true);
	const [condition, setCondition] = useState<SimpleCondition | null>(null);
	const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");
	const [confirmLeave, setConfirmLeave] = useState(false);
	// What the editor looked like once it settled, to spot unsaved changes.
	// Taken a moment after loading because the rich-text fields tidy their
	// HTML on mount, which would otherwise count as an edit.
	const [baseline, setBaseline] = useState<string | null>(null);
	const snapshot = JSON.stringify([data, active, condition]);
	const snapshotRef = useRef(snapshot);
	snapshotRef.current = snapshot;

	const fields = answerFields(
		form.properties as FormField[],
		form.removedProperties as FormField[]
	);
	const mentionsAll = fields.map((f) => ({ id: f.id, label: f.name }));
	const emailFields = fields.filter((f) => f.type === "email");
	const mentionsEmail = emailFields.map((f) => ({ id: f.id, label: f.name }));

	useEffect(() => {
		const next = existing ? (existing.data as EmailNotificationData) : {};
		const nextActive = (existing?.status ?? "active") === "active";
		const nextCondition = logicToCondition(existing?.logic ?? null);
		setData(next);
		setDebounced(next);
		setActive(nextActive);
		setCondition(nextCondition);
		setBaseline(null);
		const id = setTimeout(() => setBaseline(snapshotRef.current), BASELINE_MS);
		return () => clearTimeout(id);
	}, [existing]);

	const dirty = baseline !== null && snapshot !== baseline;

	useEffect(() => {
		const id = setTimeout(() => setDebounced(data), DEBOUNCE_MS);
		return () => clearTimeout(id);
	}, [data]);

	const pdfTemplatesQuery = useQuery(
		trpc.pdf.list.queryOptions({ formId: form.id })
	);
	const pdfTemplates = pdfTemplatesQuery.data ?? [];

	const aiCredentialQuery = useQuery(
		trpc.ai.credential.get.queryOptions({ workspaceId: form.workspaceId })
	);
	const aiGenerate = useMutation(trpc.writer.ai.generate.mutationOptions({}));
	const ai: AiToolbarConfig = {
		available: Boolean(aiCredentialQuery.data?.hasKey),
		hint: (
			<span>
				No AI provider is configured for this workspace.{" "}
				<Link search={{ tab: "ai" }} to="/dashboard/settings">
					Set one up in Settings
				</Link>
				.
			</span>
		),
		onAction: async ({ action, html, instruction }) => {
			const result = await aiGenerate.mutateAsync({
				action,
				html,
				instruction,
				workspaceId: form.workspaceId,
			});
			return result.html;
		},
	};

	const previewQuery = useQuery({
		...trpc.writer.notificationPreview.queryOptions({
			colorScheme,
			data: debounced,
			formId: form.id,
		}),
		// Keep showing the last render while typing or switching light/dark,
		// instead of flashing to a skeleton on every debounced refetch.
		placeholderData: keepPreviousData,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.integration.list.queryKey(),
		});

	const create = useMutation(
		trpc.integration.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Notification added");
				onClose();
			},
		})
	);
	const update = useMutation(
		trpc.integration.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Notification updated");
				onClose();
			},
		})
	);
	const sendTest = useMutation(
		trpc.writer.sendTest.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: (result) =>
				toast.success(
					result.loggedOnly
						? `SMTP isn't configured — logged on the server instead of sent to ${result.to}`
						: `Test email sent to ${result.to}`
				),
		})
	);

	const isPending = create.isPending || update.isPending;

	const save = () => {
		const logic = conditionToLogic(condition, fields);
		const status = active ? "active" : "inactive";
		if (existing) {
			update.mutate({ data, formId: form.id, id: existing.id, logic, status });
		} else {
			create.mutate({
				data,
				formId: form.id,
				integrationId: "email",
				logic,
				status,
			});
		}
	};

	const goBack = () => {
		if (dirty) {
			setConfirmLeave(true);
			return;
		}
		onClose();
	};

	// Cmd/Ctrl+S saves while the editor is open.
	const saveRef = useRef(save);
	saveRef.current = save;
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				saveRef.current();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	// Warn before closing the tab with unsaved changes.
	useEffect(() => {
		if (!dirty) {
			return;
		}
		const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [dirty]);

	const insertRespondentEmail = () => {
		const [field] = emailFields;
		if (!field) {
			return;
		}
		const mention = mentionHtml({ id: field.id, name: field.name });
		setData((d) => ({
			...d,
			send_to: d.send_to ? `${d.send_to}, ${mention}` : mention,
		}));
	};

	const attachedTemplate = pdfTemplates.find(
		(t) => t.id === data.attach_pdf_template_id
	);

	return (
		<div className="space-y-4">
			<div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 border-border border-b bg-background/95 px-1 py-3 backdrop-blur">
				<div className="flex min-w-0 items-center gap-3">
					<Button onClick={goBack} size="icon-sm" title="Back" variant="ghost">
						<ArrowLeftIcon />
					</Button>
					<Separator className="h-6" orientation="vertical" />
					<div className="min-w-0">
						<h3 className="truncate font-semibold text-sm">
							{existing
								? "Edit submission notification"
								: "New submission notification"}
						</h3>
						<p className="truncate text-muted-foreground text-xs">
							Sent automatically whenever this form is submitted (unless a
							condition below says otherwise).
						</p>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<label
						className="flex items-center gap-2 text-sm"
						htmlFor="notification-active"
					>
						<Switch
							checked={active}
							id="notification-active"
							onCheckedChange={setActive}
						/>
						Active
					</label>
					{dirty ? (
						<span className="hidden items-center gap-1.5 text-warning text-xs sm:inline-flex">
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-warning"
							/>
							Unsaved changes
						</span>
					) : null}
					<Button disabled={isPending} onClick={goBack} variant="outline">
						Cancel
					</Button>
					<Button disabled={isPending} onClick={save}>
						<SaveIcon /> {isPending ? "Saving…" : "Save"}
					</Button>
				</div>
			</div>

			<div className="flex flex-col gap-6 lg:flex-row lg:items-start">
				<div className="min-w-0 flex-1 rounded-xl border border-border">
					<div className="space-y-6 p-6 pb-10">
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label>Send to</Label>
								{emailFields.length > 0 ? (
									<Button
										onClick={insertRespondentEmail}
										size="sm"
										type="button"
										variant="ghost"
									>
										Insert respondent's email
									</Button>
								) : null}
							</div>
							<RichTextEditor
								aria-label="Send to"
								mentions={mentionsEmail}
								onChange={(html) => setData((d) => ({ ...d, send_to: html }))}
								placeholder="name@example.com, or @ to insert an email field"
								singleLine
								value={data.send_to ?? ""}
							/>
							<p className="text-muted-foreground text-xs">
								One or more addresses (comma-separated), or insert one of the
								form's email fields with @ to confirm the respondent.
							</p>
						</div>

						<SenderFields
							data={data}
							setData={setData}
							workspaceId={form.workspaceId}
						/>

						<Field label="Subject">
							<RichTextEditor
								aria-label="Subject"
								mentions={mentionsAll}
								onChange={(html) => setData((d) => ({ ...d, subject: html }))}
								placeholder="New submission: {Form title}"
								singleLine
								value={data.subject ?? ""}
							/>
						</Field>

						<Field label="Message">
							<RichTextEditor
								ai={ai}
								aria-label="Message"
								mentions={mentionsAll}
								minHeight={260}
								onChange={(html) =>
									setData((d) => ({ ...d, email_content: html }))
								}
								onImageUpload={uploadAsset}
								toolbar="full"
								value={data.email_content ?? ""}
							/>
							<p className="text-muted-foreground text-xs">
								Drag the handle at the bottom edge to resize. "@" inserts a form
								field; "AI" writes or rewrites the message for you.
							</p>
						</Field>

						<CheckField
							checked={data.include_submission_data ?? true}
							label="Include submission data"
							onChange={(v) =>
								setData((d) => ({ ...d, include_submission_data: v }))
							}
						/>
						<CheckField
							checked={data.include_hidden_fields_submission_data ?? false}
							label="Include hidden fields"
							onChange={(v) =>
								setData((d) => ({
									...d,
									include_hidden_fields_submission_data: v,
								}))
							}
						/>
						<CheckField
							checked={data.link_edit_submission ?? false}
							label="Include a link to edit the submission"
							onChange={(v) =>
								setData((d) => ({ ...d, link_edit_submission: v }))
							}
						/>

						<AttachPdfField
							data={data}
							setData={setData}
							templates={pdfTemplates}
						/>

						<div className="space-y-2 border-border border-t pt-4">
							<ConditionPicker
								condition={condition}
								fields={fields}
								onChange={setCondition}
							/>
							<p className="text-muted-foreground text-xs">
								Leave unset to send on every submission.
							</p>
						</div>
					</div>
				</div>

				<PreviewPanel
					attachedTemplateName={attachedTemplate?.name}
					colorScheme={colorScheme}
					data={data}
					formId={form.id}
					onColorSchemeChange={setColorScheme}
					preview={previewQuery.data}
					sendTest={sendTest}
				/>
			</div>

			<ConfirmDialog
				confirmLabel="Discard changes"
				description="Your changes to this notification haven't been saved."
				onConfirm={() => {
					setConfirmLeave(false);
					onClose();
				}}
				onOpenChange={setConfirmLeave}
				open={confirmLeave}
				title="Discard unsaved changes?"
			/>
		</div>
	);
}
