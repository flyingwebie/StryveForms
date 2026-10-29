import type { FormDto } from "@StryveForms/api/lib/serialize";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import { Button } from "@StryveForms/ui/components/button";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

import ConditionPicker, {
	conditionToLogic,
	logicToCondition,
	type SimpleCondition,
} from "./condition-picker";
import {
	ChatFields,
	DiscordSettingsFields,
	EmailFields,
	type IntegrationData,
	type IntegrationSettings,
	type PdfTemplateOption,
	SlackSettingsFields,
	TelegramFields,
	TelegramSettingsFields,
	WebhookFields,
	WebhookLikeSettingsFields,
} from "./field-groups";
import { SetupHelpCard } from "./setup-help";
import { TestSendButton } from "./test-send-button";

export interface IntegrationRecord {
	data: IntegrationData;
	id: string;
	integrationId: string;
	logic: Record<string, unknown> | null;
	settings?: IntegrationSettings;
	status: "active" | "inactive";
}

const WEBHOOK_AUTOMATION_IDS = new Set([
	"webhook",
	"n8n",
	"zapier",
	"make",
	"pabbly",
	"activepieces",
	"albato",
]);

function FieldsFor({
	data,
	fields,
	integrationId,
	pdfTemplates,
	setData,
}: {
	data: IntegrationData;
	fields: FormField[];
	integrationId: string;
	pdfTemplates: PdfTemplateOption[];
	setData: (data: IntegrationData) => void;
}) {
	const mentions = fields.map((f) => ({ id: f.id, label: f.name }));

	if (integrationId === "email") {
		return (
			<EmailFields
				canLinkEditSubmission
				data={data}
				mentions={mentions}
				pdfTemplates={pdfTemplates}
				setData={setData}
			/>
		);
	}
	if (integrationId === "slack") {
		return (
			<ChatFields
				data={data}
				mentions={mentions}
				setData={setData}
				urlKey="slack_webhook_url"
				urlLabel="Slack webhook URL"
			/>
		);
	}
	if (integrationId === "discord") {
		return (
			<ChatFields
				data={data}
				mentions={mentions}
				setData={setData}
				urlKey="discord_webhook_url"
				urlLabel="Discord webhook URL"
			/>
		);
	}
	if (integrationId === "telegram") {
		return <TelegramFields data={data} mentions={mentions} setData={setData} />;
	}
	if (WEBHOOK_AUTOMATION_IDS.has(integrationId)) {
		return <WebhookFields data={data} setData={setData} />;
	}
	return null;
}

/** The "Security" / "Payload" / "Advanced" settings groups for an integration, if it has any. */
function SettingsFor({
	integrationId,
	setSettings,
	settings,
}: {
	integrationId: string;
	setSettings: (settings: IntegrationSettings) => void;
	settings: IntegrationSettings;
}) {
	if (WEBHOOK_AUTOMATION_IDS.has(integrationId)) {
		return (
			<WebhookLikeSettingsFields
				integrationId={integrationId}
				setSettings={setSettings}
				settings={settings}
			/>
		);
	}
	if (integrationId === "slack") {
		return (
			<SlackSettingsFields setSettings={setSettings} settings={settings} />
		);
	}
	if (integrationId === "discord") {
		return (
			<DiscordSettingsFields setSettings={setSettings} settings={settings} />
		);
	}
	if (integrationId === "telegram") {
		return (
			<TelegramSettingsFields setSettings={setSettings} settings={settings} />
		);
	}
	return null;
}

export default function IntegrationDialog({
	existing,
	form,
	integrationId,
	onOpenChange,
	open,
}: {
	existing: IntegrationRecord | null;
	form: FormDto;
	integrationId: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [data, setData] = useState<IntegrationData>({});
	const [settings, setSettings] = useState<IntegrationSettings>({});
	const [active, setActive] = useState(true);
	const [condition, setCondition] = useState<SimpleCondition | null>(null);

	const fields = answerFields(
		form.properties as FormField[],
		form.removedProperties as FormField[]
	);
	const pdfTemplatesQuery = useQuery(
		trpc.pdf.list.queryOptions({ formId: form.id })
	);
	const pdfTemplates: PdfTemplateOption[] = (pdfTemplatesQuery.data ?? []).map(
		(t) => ({ id: t.id, name: t.name })
	);

	useEffect(() => {
		setData(existing?.data ?? {});
		setSettings(existing?.settings ?? {});
		setActive((existing?.status ?? "active") === "active");
		setCondition(logicToCondition(existing?.logic ?? null));
	}, [existing]);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.integration.list.queryKey(),
		});

	const create = useMutation(
		trpc.integration.create.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Integration added");
				onOpenChange(false);
			},
		})
	);
	const update = useMutation(
		trpc.integration.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await invalidate();
				toast.success("Integration updated");
				onOpenChange(false);
			},
		})
	);

	const isPending = create.isPending || update.isPending;

	const save = () => {
		const logic = conditionToLogic(condition, fields);
		const status = active ? "active" : "inactive";
		if (existing) {
			update.mutate({
				data,
				formId: form.id,
				id: existing.id,
				logic,
				settings,
				status,
			});
		} else {
			create.mutate({
				data,
				formId: form.id,
				integrationId,
				logic,
				settings,
				status,
			});
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="capitalize">
						{integrationId} integration
					</DialogTitle>
				</DialogHeader>

				{integrationId === "email" ? null : (
					<SetupHelpCard integrationId={integrationId} />
				)}

				<FieldsFor
					data={data}
					fields={fields}
					integrationId={integrationId}
					pdfTemplates={pdfTemplates}
					setData={setData}
				/>

				<SettingsFor
					integrationId={integrationId}
					setSettings={setSettings}
					settings={settings}
				/>

				<div className="space-y-2 border-border border-t pt-4">
					<ConditionPicker
						condition={condition}
						fields={fields}
						onChange={setCondition}
					/>
				</div>

				{integrationId === "email" ? null : (
					<div className="border-border border-t pt-4">
						<TestSendButton
							data={data}
							formId={form.id}
							id={existing?.id}
							integrationId={integrationId}
							settings={settings}
						/>
					</div>
				)}

				<DialogFooter className="items-center justify-between sm:justify-between">
					<div className="flex items-center gap-2 text-sm">
						<Checkbox
							checked={active}
							id="integration-active"
							onCheckedChange={(c) => setActive(c === true)}
						/>
						<label htmlFor="integration-active">Active</label>
					</div>
					<Button disabled={isPending} onClick={save}>
						{isPending ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
