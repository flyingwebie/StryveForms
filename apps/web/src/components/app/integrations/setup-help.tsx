import { ExternalLinkIcon } from "lucide-react";

export interface SetupHelp {
	/** Link text + URL to the integration's own setup docs. */
	docs: { label: string; url: string };
	steps: string[];
}

/** Short "how to connect this" steps per integration, from vendor docs. */
const SETUP_HELP: Record<string, SetupHelp> = {
	activepieces: {
		docs: {
			label: "Open Activepieces webhook docs",
			url: "https://www.activepieces.com/pieces/webhook",
		},
		steps: [
			'In Activepieces, start a new flow and add the Webhook piece\'s "Catch Webhook" trigger.',
			"Copy the trigger's URL and paste it below as the webhook URL.",
			"Use Send test below so Activepieces has a sample payload to reference in later steps.",
		],
	},
	albato: {
		docs: {
			label: "Open Albato webhook docs",
			url: "https://albato.com/app-webhooks",
		},
		steps: [
			'In Albato, create a Scenario and choose the Webhook app\'s "Incoming webhook" trigger.',
			"Copy the generated URL and paste it below.",
			"Run Albato's own test (or Send test below) before activating the scenario.",
		],
	},
	discord: {
		docs: {
			label: "Open Discord webhook docs",
			url: "https://docs.discord.com/developers/resources/webhook",
		},
		steps: [
			"In your Discord server, open channel Settings → Integrations → Webhooks → New Webhook.",
			"Name it, pick a channel, then copy the Webhook URL and paste it below.",
			"Optionally set a username/avatar override and a thread to post into under Payload/Advanced.",
		],
	},
	make: {
		docs: {
			label: "Open Make webhook docs",
			url: "https://developers.make.com/custom-apps-documentation/app-components/webhooks",
		},
		steps: [
			'In Make, add a "Custom webhook" module and create a new webhook to get its URL.',
			"Paste that URL below, then use Send test — Make can't map fields until it has one sample call.",
			"Back in Make, confirm the data structure was detected before building the rest of the scenario.",
		],
	},
	n8n: {
		docs: {
			label: "Open n8n Webhook node docs",
			url: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
		},
		steps: [
			"In n8n, add a Webhook node and copy its Test URL (or Production URL once the workflow is active).",
			"Paste that URL below.",
			'Click "Listen for test event" in n8n, then use Send test here — n8n only receives test calls while listening.',
		],
	},
	pabbly: {
		docs: {
			label: "Open Pabbly Connect guide",
			url: "https://www.pabbly.com/pabbly-connect-documentation-complete-integration-guide/",
		},
		steps: [
			'In Pabbly Connect, create a workflow with "Webhook" as the trigger app.',
			"Copy the generated webhook URL and paste it below.",
			'Use Pabbly\'s "Save and Send Test Request" (or Send test below) to capture a sample for field mapping.',
		],
	},
	slack: {
		docs: {
			label: "Open Slack incoming webhooks docs",
			url: "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks",
		},
		steps: [
			'In your Slack app\'s settings, enable Incoming Webhooks, then "Add New Webhook to Workspace".',
			"Pick a channel and copy the generated https://hooks.slack.com/... URL below.",
			"Note: Slack fixes the channel/name/icon to what you picked here — they can't be overridden per message.",
		],
	},
	telegram: {
		docs: {
			label: "Open Telegram Bot API docs",
			url: "https://core.telegram.org/bots/api#sendmessage",
		},
		steps: [
			"Message @BotFather on Telegram to create a bot and get a bot token (set as TELEGRAM_BOT_TOKEN on the server).",
			"Add the bot to your chat/channel/group, then find its numeric chat id (e.g. via @userinfobot or the Bot API's getUpdates).",
			"Paste the chat id below.",
		],
	},
	webhook: {
		docs: {
			label: "Open webhook security reference",
			url: "https://docs.stripe.com/webhooks",
		},
		steps: [
			"Paste any URL you control below — it receives a JSON POST on every submission.",
			"If your receiver can verify a signature, set a signing secret under Security; otherwise use a bearer token, basic auth, or an API-key header.",
			"Use Send test to confirm the receiver accepts the payload before relying on it.",
		],
	},
	zapier: {
		docs: {
			label: "Open Zapier Webhooks docs",
			url: "https://help.zapier.com/hc/en-us/articles/8496288690317",
		},
		steps: [
			'In Zapier, create a Zap with "Webhooks by Zapier" → "Catch Hook" as the trigger.',
			"Copy the generated https://hooks.zapier.com/... URL and paste it below.",
			"Use Send test (or Zapier's own Test step) so Zapier can map the incoming fields.",
		],
	},
};

/** Setup help for an integration, or null if there's none written yet. */
export function getSetupHelp(integrationId: string): SetupHelp | null {
	return SETUP_HELP[integrationId] ?? null;
}

export function SetupHelpCard({ integrationId }: { integrationId: string }) {
	const help = getSetupHelp(integrationId);
	if (!help) {
		return null;
	}
	return (
		<div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3">
			<p className="font-medium text-sm">Setup</p>
			<ol className="list-decimal space-y-1 pl-4 text-muted-foreground text-xs">
				{help.steps.map((step) => (
					<li key={step}>{step}</li>
				))}
			</ol>
			<a
				className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
				href={help.docs.url}
				rel="noopener noreferrer"
				target="_blank"
			>
				{help.docs.label} <ExternalLinkIcon className="size-3" />
			</a>
		</div>
	);
}
