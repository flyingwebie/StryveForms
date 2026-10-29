import { render } from "@react-email/render";
import { createElement, type ReactElement } from "react";
import { z } from "zod";

import type { EmailBranding } from "./components/layout";
import { resolveTheme } from "./components/theme";
import { AuthLinkEmail } from "./templates/auth-link";
import { FormCreatedEmail } from "./templates/form-created";
import { ImportFinishedEmail } from "./templates/import-finished";
import { IntegrationFailedEmail } from "./templates/integration-failed";
import { SubmissionNotificationEmail } from "./templates/submission-notification";
import { WorkspaceInviteEmail } from "./templates/workspace-invite";

export const EMAIL_TEMPLATE_IDS = [
	"auth-link",
	"form-created",
	"import-finished",
	"integration-failed",
	"submission-notification",
	"workspace-invite",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export const emailTemplateIdSchema = z.enum(EMAIL_TEMPLATE_IDS);

export interface EmailTemplateInfo {
	description: string;
	id: EmailTemplateId;
	name: string;
	sampleSubject: string;
}

/** Shown in the admin UI's template switcher. */
export const EMAIL_TEMPLATE_CATALOG: EmailTemplateInfo[] = [
	{
		description: "Sent to confirm an email address or reset a password.",
		id: "auth-link",
		name: "Verify email / reset password",
		sampleSubject: "Confirm your email",
	},
	{
		description: "Sent to a form owner once their form is published.",
		id: "form-created",
		name: "Form created",
		sampleSubject: "Your form is live",
	},
	{
		description: "Sent when an OpnForm import job finishes.",
		id: "import-finished",
		name: "Import finished",
		sampleSubject: "Your OpnForm import is done",
	},
	{
		description: "Sent to a form owner when one of their integrations fails.",
		id: "integration-failed",
		name: "Integration failed",
		sampleSubject: "Integration issue with your form",
	},
	{
		description:
			"Sent to form owners (and optionally respondents) on a new submission.",
		id: "submission-notification",
		name: "Submission notification",
		sampleSubject: "New form submission",
	},
	{
		description: "Sent when someone is invited to a workspace.",
		id: "workspace-invite",
		name: "Workspace invite",
		sampleSubject: "Join Acme on StryveForms",
	},
];

interface PreviewPayload {
	element: ReactElement;
	preheader: string;
	subject: string;
}

/** Builds the React element + sample subject/preheader for a template, with `branding` applied. */
export function emailPreviewElement(
	id: EmailTemplateId,
	branding: EmailBranding
): PreviewPayload {
	const appName = branding.appName ?? "StryveForms";
	switch (id) {
		case "auth-link": {
			const props = { ...AuthLinkEmail.PreviewProps, branding };
			return {
				element: createElement(AuthLinkEmail, props),
				preheader: "Confirm your email",
				subject: "Confirm your email",
			};
		}
		case "form-created": {
			const props = { ...FormCreatedEmail.PreviewProps, branding };
			return {
				element: createElement(FormCreatedEmail, props),
				preheader: `Your form "${props.formTitle}" is ready`,
				subject: `Your form "${props.formTitle}" is ready`,
			};
		}
		case "import-finished": {
			const props = { ...ImportFinishedEmail.PreviewProps, branding };
			return {
				element: createElement(ImportFinishedEmail, props),
				preheader: "Your OpnForm import is done",
				subject: "Your OpnForm import is done",
			};
		}
		case "integration-failed": {
			const props = { ...IntegrationFailedEmail.PreviewProps, branding };
			return {
				element: createElement(IntegrationFailedEmail, props),
				preheader: `${props.integrationName} failed for "${props.formTitle}"`,
				subject: `Integration issue with your form "${props.formTitle}"`,
			};
		}
		case "submission-notification": {
			const props = {
				...SubmissionNotificationEmail.PreviewProps,
				branding,
				preview: "New form submission",
			};
			return {
				element: createElement(SubmissionNotificationEmail, props),
				preheader: "New form submission",
				subject: "New submission: Contact us",
			};
		}
		case "workspace-invite": {
			const props = { ...WorkspaceInviteEmail.PreviewProps, branding };
			return {
				element: createElement(WorkspaceInviteEmail, props),
				preheader: `Join ${props.workspaceName} on ${appName}`,
				subject: `Join ${props.workspaceName} on ${appName}`,
			};
		}
		default: {
			const _exhaustive: never = id;
			throw new Error(`Unknown email template: ${_exhaustive}`);
		}
	}
}

/**
 * Swaps every light-palette field for its resolved dark counterpart, so the
 * admin's "preview in dark mode" toggle can render a real dark pass server-side
 * instead of trying to fake `prefers-color-scheme` inside a sandboxed iframe.
 * A no-op when the admin turned dark mode support off ("light-only").
 */
export function asDarkPreviewBranding(branding: EmailBranding): EmailBranding {
	const theme = resolveTheme(branding);
	if (!theme.darkModeEnabled) {
		return branding;
	}
	return {
		...branding,
		accentColor: theme.dark.accentColor,
		backgroundColor: theme.dark.backgroundColor,
		contentBackgroundColor: theme.dark.contentBackgroundColor,
		headingColor: theme.dark.headingColor,
		logoUrl: branding.logoDarkUrl ?? branding.logoUrl,
		mutedColor: theme.dark.mutedColor,
		textColor: theme.dark.textColor,
	};
}

const DARK_MEDIA_QUERY = "@media (prefers-color-scheme: dark)";

/** Renders a template's HTML + plain-text, for the admin preview endpoint. */
export async function renderEmailPreview(
	id: EmailTemplateId,
	branding: EmailBranding,
	opts?: { colorScheme?: "light" | "dark" }
): Promise<{ html: string; preheader: string; subject: string; text: string }> {
	const effectiveBranding =
		opts?.colorScheme === "dark" ? asDarkPreviewBranding(branding) : branding;
	const { element, preheader, subject } = emailPreviewElement(
		id,
		effectiveBranding
	);
	const [rendered, text] = await Promise.all([
		render(element),
		render(element, { plainText: true }),
	]);
	// The preview picks light or dark itself, so the client-side dark-mode
	// rule must not follow the admin's own browser theme.
	const html = opts?.colorScheme
		? rendered.replaceAll(DARK_MEDIA_QUERY, "@media not all")
		: rendered;
	return { html, preheader, subject, text };
}

/**
 * Same dark-mode flip as `renderEmailPreview` above, but for a caller that
 * already built its own React Email element (e.g. the notifications tab's
 * live email preview, which composes `emails.submissionNotification` itself
 * with notification-specific branding/content). Apply `asDarkPreviewBranding`
 * to your branding *before* building the element — the flip has to happen
 * before the element exists, since the colours are baked in at render time.
 */
export async function renderCustomEmailPreview(
	element: ReactElement,
	opts?: { colorScheme?: "light" | "dark" }
): Promise<{ html: string; text: string }> {
	const [rendered, text] = await Promise.all([
		render(element),
		render(element, { plainText: true }),
	]);
	const html = opts?.colorScheme
		? rendered.replaceAll(DARK_MEDIA_QUERY, "@media not all")
		: rendered;
	return { html, text };
}
