import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import type { MentionItem } from "@StryveForms/ui/components/rich-text-editor";
import { RichTextEditor } from "@StryveForms/ui/components/rich-text-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { cn } from "@StryveForms/ui/lib/utils";
import type { ReactNode } from "react";

import { SettingsSection } from "./settings-section";

export interface PdfTemplateOption {
	id: string;
	name: string;
}

const NONE_VALUE = "none";

/** "Attach PDF": pick a PDF template (or none) to generate and attach for this submission. */
function AttachPdfField({
	data,
	pdfTemplates,
	setData,
}: {
	data: IntegrationData;
	pdfTemplates: PdfTemplateOption[];
	setData: (data: IntegrationData) => void;
}) {
	if (pdfTemplates.length === 0) {
		return null;
	}
	const value = str(data, "attach_pdf_template_id") || NONE_VALUE;
	return (
		<Field label="Attach PDF">
			<Select
				items={[
					{ label: "None", value: NONE_VALUE },
					...pdfTemplates.map((t) => ({ label: t.name, value: t.id })),
				]}
				onValueChange={(next) =>
					setData({
						...data,
						attach_pdf_template_id: next === NONE_VALUE ? "" : next,
					})
				}
				value={value}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NONE_VALUE}>None</SelectItem>
					{pdfTemplates.map((t) => (
						<SelectItem key={t.id} value={t.id}>
							{t.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}

export type IntegrationData = Record<string, unknown>;

function str(data: IntegrationData, key: string) {
	return typeof data[key] === "string" ? (data[key] as string) : "";
}
function bool(data: IntegrationData, key: string) {
	return data[key] === true;
}

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

/** A small segmented control for a short set of mutually-exclusive options. */
function OptionButtons<T extends string>({
	onChange,
	options,
	value,
}: {
	onChange: (value: T) => void;
	options: readonly { label: string; value: T }[];
	value: T;
}) {
	return (
		<div className="flex flex-wrap gap-2">
			{options.map((option) => (
				<Button
					key={option.value}
					onClick={() => onChange(option.value)}
					size="sm"
					type="button"
					variant={value === option.value ? "default" : "outline"}
				>
					{option.label}
				</Button>
			))}
		</div>
	);
}

export function EmailFields({
	canLinkEditSubmission,
	data,
	mentions,
	pdfTemplates,
	setData,
}: {
	canLinkEditSubmission: boolean;
	data: IntegrationData;
	mentions: MentionItem[];
	pdfTemplates: PdfTemplateOption[];
	setData: (data: IntegrationData) => void;
}) {
	return (
		<div className="space-y-4">
			<Field label="Send to">
				<Textarea
					onChange={(event) =>
						setData({ ...data, send_to: event.target.value })
					}
					placeholder="One email per line, or comma-separated"
					value={str(data, "send_to")}
				/>
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label="Sender name">
					<Input
						onChange={(event) =>
							setData({ ...data, sender_name: event.target.value })
						}
						value={str(data, "sender_name")}
					/>
				</Field>
				<Field label="Reply-to">
					<Input
						onChange={(event) =>
							setData({ ...data, reply_to: event.target.value })
						}
						value={str(data, "reply_to")}
					/>
				</Field>
			</div>
			<Field label="Subject">
				<Input
					onChange={(event) =>
						setData({ ...data, subject: event.target.value })
					}
					value={str(data, "subject")}
				/>
			</Field>
			<Field label="Message">
				<RichTextEditor
					mentions={mentions}
					onChange={(html) => setData({ ...data, email_content: html })}
					toolbar="basic"
					value={str(data, "email_content")}
				/>
			</Field>
			<CheckField
				checked={bool(data, "include_submission_data")}
				label="Include submission data"
				onChange={(v) => setData({ ...data, include_submission_data: v })}
			/>
			<CheckField
				checked={bool(data, "include_hidden_fields_submission_data")}
				label="Include hidden fields"
				onChange={(v) =>
					setData({ ...data, include_hidden_fields_submission_data: v })
				}
			/>
			{canLinkEditSubmission ? (
				<CheckField
					checked={bool(data, "link_edit_submission")}
					label="Include a link to edit the submission"
					onChange={(v) => setData({ ...data, link_edit_submission: v })}
				/>
			) : null}
			<AttachPdfField
				data={data}
				pdfTemplates={pdfTemplates}
				setData={setData}
			/>
		</div>
	);
}

export function WebhookFields({
	data,
	setData,
}: {
	data: IntegrationData;
	setData: (data: IntegrationData) => void;
}) {
	return (
		<div className="space-y-4">
			<Field label="Webhook URL">
				<Input
					onChange={(event) =>
						setData({ ...data, webhook_url: event.target.value })
					}
					placeholder="https://"
					value={str(data, "webhook_url")}
				/>
			</Field>
			<Field label="Signing secret (optional)">
				<Input
					onChange={(event) =>
						setData({ ...data, webhook_secret: event.target.value })
					}
					value={str(data, "webhook_secret")}
				/>
			</Field>
			<Field label="Extra headers (one per line, key: value)">
				<Textarea
					onChange={(event) =>
						setData({ ...data, webhook_headers: event.target.value })
					}
					placeholder="X-Custom-Header: value"
					value={str(data, "webhook_headers")}
				/>
			</Field>
		</div>
	);
}

export function ChatFields({
	data,
	mentions,
	setData,
	urlKey,
	urlLabel,
}: {
	data: IntegrationData;
	mentions: MentionItem[];
	setData: (data: IntegrationData) => void;
	urlKey: string;
	urlLabel: string;
}) {
	return (
		<div className="space-y-4">
			<Field label={urlLabel}>
				<Input
					onChange={(event) =>
						setData({ ...data, [urlKey]: event.target.value })
					}
					placeholder="https://"
					value={str(data, urlKey)}
				/>
			</Field>
			<Field label="Message">
				<RichTextEditor
					mentions={mentions}
					onChange={(html) => setData({ ...data, message: html })}
					toolbar="none"
					value={str(data, "message")}
				/>
			</Field>
			<CheckField
				checked={bool(data, "include_submission_data")}
				label="Include submission data"
				onChange={(v) => setData({ ...data, include_submission_data: v })}
			/>
			<CheckField
				checked={bool(data, "link_open_form")}
				label="Include a link to open the form"
				onChange={(v) => setData({ ...data, link_open_form: v })}
			/>
			<CheckField
				checked={bool(data, "link_edit_form")}
				label="Include a link to edit the form"
				onChange={(v) => setData({ ...data, link_edit_form: v })}
			/>
		</div>
	);
}

export function TelegramFields({
	data,
	mentions,
	setData,
}: {
	data: IntegrationData;
	mentions: MentionItem[];
	setData: (data: IntegrationData) => void;
}) {
	return (
		<div className="space-y-4">
			<Field label="Chat ID">
				<Input
					onChange={(event) =>
						setData({ ...data, chat_id: event.target.value })
					}
					value={str(data, "chat_id")}
				/>
			</Field>
			<Field label="Message">
				<RichTextEditor
					mentions={mentions}
					onChange={(html) => setData({ ...data, message: html })}
					toolbar="none"
					value={str(data, "message")}
				/>
			</Field>
		</div>
	);
}

/* ------------------------------ Settings groups --------------------------- */
/** "Security" / "Payload" / "Advanced" settings, stored separately from the
 * fields above in `formIntegration.settings`. One set of components per
 * integration family, shared across every dialog that needs them. */

export type IntegrationSettings = Record<string, unknown>;

function num(settings: IntegrationSettings, key: string, fallback: number) {
	const value = settings[key];
	return typeof value === "number" ? value : fallback;
}

const AUTH_TYPE_OPTIONS = [
	{ label: "None", value: "none" },
	{ label: "Bearer", value: "bearer" },
	{ label: "Basic", value: "basic" },
	{ label: "API key", value: "api_key" },
] as const;

const SLACK_FORMAT_OPTIONS = [
	{ label: "Rich", value: "blocks" },
	{ label: "Simple", value: "simple" },
] as const;

const PAYLOAD_SHAPE_OPTIONS = [
	{
		label: "Classic (OpnForm)",
		preview: '{ "data":\n  { "email": "…" } }',
		value: "classic",
	},
	{
		label: "Nested",
		preview: '{ "email":\n  { "value": "…" } }',
		value: "nested",
	},
	{ label: "Flat", preview: '{ "email":\n  "jamie@…" }', value: "flat" },
] as const;

/** The "Payload shape" radio tiles: a label, a short JSON preview, and a
 * selection ring — matches the field-data-shape picker shown for every
 * webhook-like integration. */
function PayloadShapeField({
	onChange,
	value,
}: {
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<div className="space-y-2">
			<div className="grid gap-2 sm:grid-cols-3">
				{PAYLOAD_SHAPE_OPTIONS.map((option) => (
					<button
						className={cn(
							"flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
							value === option.value
								? "border-primary ring-1 ring-primary"
								: "border-border hover:border-foreground/20"
						)}
						key={option.value}
						onClick={() => onChange(option.value)}
						type="button"
					>
						<span className="flex items-center gap-2 font-medium text-sm">
							<span
								className={cn(
									"size-3.5 shrink-0 rounded-full border",
									value === option.value
										? "border-primary bg-primary"
										: "border-input"
								)}
							/>
							{option.label}
						</span>
						<pre className="whitespace-pre-wrap rounded-md bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground leading-tight">
							{option.preview}
						</pre>
					</button>
				))}
			</div>
			<p className="text-muted-foreground text-xs">
				Flat is the easiest shape for no-code tools like Zapier or Make to map
				fields from.
			</p>
		</div>
	);
}

/** Security / Payload / Advanced for webhook, n8n, Zapier, Make, Pabbly,
 * Activepieces, Albato — they're all a plain JSON POST, so one settings UI
 * covers all seven. */
export function WebhookLikeSettingsFields({
	integrationId,
	setSettings,
	settings,
}: {
	integrationId: string;
	setSettings: (settings: IntegrationSettings) => void;
	settings: IntegrationSettings;
}) {
	const authType = str(settings, "auth_type") || "none";
	return (
		<div className="-mx-2 divide-y divide-border">
			<SettingsSection
				description="Lets the receiving end verify a request really came from this form."
				title="Security"
			>
				<Field label="Authentication">
					<OptionButtons
						onChange={(value) => setSettings({ ...settings, auth_type: value })}
						options={AUTH_TYPE_OPTIONS}
						value={authType}
					/>
				</Field>
				{authType === "bearer" ? (
					<Field label="Bearer token">
						<Input
							onChange={(event) =>
								setSettings({ ...settings, auth_token: event.target.value })
							}
							placeholder="Sent as Authorization: Bearer <token>"
							value={str(settings, "auth_token")}
						/>
					</Field>
				) : null}
				{authType === "basic" ? (
					<div className="grid grid-cols-2 gap-3">
						<Field label="Username">
							<Input
								onChange={(event) =>
									setSettings({
										...settings,
										auth_username: event.target.value,
									})
								}
								value={str(settings, "auth_username")}
							/>
						</Field>
						<Field label="Password">
							<Input
								onChange={(event) =>
									setSettings({
										...settings,
										auth_password: event.target.value,
									})
								}
								type="password"
								value={str(settings, "auth_password")}
							/>
						</Field>
					</div>
				) : null}
				{authType === "api_key" ? (
					<div className="grid grid-cols-2 gap-3">
						<Field label="Header name">
							<Input
								onChange={(event) =>
									setSettings({
										...settings,
										auth_header_name: event.target.value,
									})
								}
								placeholder="X-API-Key"
								value={str(settings, "auth_header_name")}
							/>
						</Field>
						<Field label="Header value">
							<Input
								onChange={(event) =>
									setSettings({
										...settings,
										auth_header_value: event.target.value,
									})
								}
								value={str(settings, "auth_header_value")}
							/>
						</Field>
					</div>
				) : null}
				<p className="text-muted-foreground text-xs">
					Setting a signing secret above also adds an HMAC signature header —
					configure its name, algorithm and whether to include a timestamp here.
				</p>
				<div className="grid grid-cols-2 gap-3">
					<Field label="Signature header name">
						<Input
							onChange={(event) =>
								setSettings({
									...settings,
									hmac_header_name: event.target.value,
								})
							}
							placeholder="X-Webhook-Signature"
							value={str(settings, "hmac_header_name")}
						/>
					</Field>
					<Field label="Signature algorithm">
						<Select
							items={[
								{ label: "SHA-256", value: "sha256" },
								{ label: "SHA-1", value: "sha1" },
							]}
							onValueChange={(value) =>
								setSettings({ ...settings, hmac_algorithm: value })
							}
							value={str(settings, "hmac_algorithm") || "sha256"}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="sha256">SHA-256</SelectItem>
								<SelectItem value="sha1">SHA-1</SelectItem>
							</SelectContent>
						</Select>
					</Field>
				</div>
				<CheckField
					checked={bool(settings, "hmac_include_timestamp")}
					label="Include a timestamp header (helps the receiver reject old/replayed requests)"
					onChange={(v) =>
						setSettings({ ...settings, hmac_include_timestamp: v })
					}
				/>
			</SettingsSection>

			<SettingsSection
				description="Controls the shape of the JSON body this form sends."
				title="Payload shape"
			>
				<PayloadShapeField
					onChange={(value) =>
						setSettings({ ...settings, payload_style: value })
					}
					value={
						str(settings, "payload_style") ||
						(integrationId === "webhook" ? "classic" : "nested")
					}
				/>
				<CheckField
					checked={settings.include_metadata !== false}
					label="Include metadata (e.g. UTM/referrer attribution), when available"
					onChange={(v) => setSettings({ ...settings, include_metadata: v })}
				/>
			</SettingsSection>

			<SettingsSection
				description="Delivery timing — rarely needs changing."
				title="Advanced"
			>
				<Field label="Timeout (seconds)">
					<Input
						max={60}
						min={1}
						onChange={(event) =>
							setSettings({
								...settings,
								timeout_seconds: Number(event.target.value) || 10,
							})
						}
						type="number"
						value={String(num(settings, "timeout_seconds", 10))}
					/>
				</Field>
				<CheckField
					checked={bool(settings, "retry_on_failure")}
					label="Retry once after a short delay if the first attempt fails"
					onChange={(v) => setSettings({ ...settings, retry_on_failure: v })}
				/>
			</SettingsSection>
		</div>
	);
}

/** Slack: payload format only — the webhook URL is the only credential, and
 * channel/username/icon can't be overridden per Slack's own docs. */
export function SlackSettingsFields({
	setSettings,
	settings,
}: {
	setSettings: (settings: IntegrationSettings) => void;
	settings: IntegrationSettings;
}) {
	return (
		<div className="-mx-2">
			<SettingsSection
				description="How the message is formatted in Slack."
				title="Message format"
			>
				<OptionButtons
					onChange={(value) => setSettings({ ...settings, format: value })}
					options={SLACK_FORMAT_OPTIONS}
					value={str(settings, "format") || "blocks"}
				/>
				<p className="text-muted-foreground text-xs">
					Rich shows each answer as a block; Simple sends one plain-text line
					per field. Slack fixes the posting channel, name and icon to whatever
					was chosen when this webhook was created — they can't be overridden
					here.
				</p>
			</SettingsSection>
		</div>
	);
}

/** Discord: username/avatar/thread overrides are genuinely supported (unlike Slack). */
export function DiscordSettingsFields({
	setSettings,
	settings,
}: {
	setSettings: (settings: IntegrationSettings) => void;
	settings: IntegrationSettings;
}) {
	return (
		<div className="-mx-2 divide-y divide-border">
			<SettingsSection
				description="How the message is formatted in Discord."
				title="Payload"
			>
				<Field label="Format">
					<Select
						items={[
							{ label: "Rich embed", value: "embed" },
							{ label: "Simple (plain text)", value: "simple" },
						]}
						onValueChange={(value) =>
							setSettings({ ...settings, format: value })
						}
						value={str(settings, "format") || "embed"}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="embed">Rich embed</SelectItem>
							<SelectItem value="simple">Simple (plain text)</SelectItem>
						</SelectContent>
					</Select>
				</Field>
				<div className="grid grid-cols-2 gap-3">
					<Field label="Bot name override">
						<Input
							onChange={(event) =>
								setSettings({ ...settings, username: event.target.value })
							}
							placeholder="Defaults to this app's name"
							value={str(settings, "username")}
						/>
					</Field>
					<Field label="Avatar URL override">
						<Input
							onChange={(event) =>
								setSettings({ ...settings, avatar_url: event.target.value })
							}
							placeholder="https://"
							value={str(settings, "avatar_url")}
						/>
					</Field>
				</div>
			</SettingsSection>
			<SettingsSection
				description="Post into a specific thread."
				title="Advanced"
			>
				<Field label="Thread ID (optional)">
					<Input
						onChange={(event) =>
							setSettings({ ...settings, thread_id: event.target.value })
						}
						placeholder="Posts into this channel's default location if empty"
						value={str(settings, "thread_id")}
					/>
				</Field>
			</SettingsSection>
		</div>
	);
}

/** Telegram: parse mode and silent delivery. */
export function TelegramSettingsFields({
	setSettings,
	settings,
}: {
	setSettings: (settings: IntegrationSettings) => void;
	settings: IntegrationSettings;
}) {
	return (
		<div className="-mx-2 divide-y divide-border">
			<SettingsSection
				description="How the message text is formatted."
				title="Payload"
			>
				<Field label="Formatting">
					<Select
						items={[
							{ label: "MarkdownV2", value: "MarkdownV2" },
							{ label: "HTML", value: "HTML" },
							{ label: "Plain text", value: "None" },
						]}
						onValueChange={(value) =>
							setSettings({ ...settings, parse_mode: value })
						}
						value={str(settings, "parse_mode") || "MarkdownV2"}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
							<SelectItem value="HTML">HTML</SelectItem>
							<SelectItem value="None">Plain text</SelectItem>
						</SelectContent>
					</Select>
				</Field>
			</SettingsSection>
			<SettingsSection description="Delivery behavior." title="Advanced">
				<CheckField
					checked={bool(settings, "silent")}
					label="Send silently (no notification sound)"
					onChange={(v) => setSettings({ ...settings, silent: v })}
				/>
			</SettingsSection>
		</div>
	);
}
