/** @jsxImportSource react */
import { type EmailBranding, EmailLayout } from "../components/layout";
import { ActionButton, Panel, Paragraph } from "../components/primitives";

export interface IntegrationFailedProps {
	branding?: EmailBranding;
	error: string;
	formTitle: string;
	formUrl: string;
	integrationName: string;
}

export function IntegrationFailedEmail({
	branding,
	error,
	formTitle,
	formUrl,
	integrationName,
}: IntegrationFailedProps) {
	return (
		<EmailLayout
			branding={branding}
			preview={`${integrationName} failed for “${formTitle}”`}
		>
			<Paragraph>Hello,</Paragraph>
			<Paragraph>
				We tried to run the <b>{integrationName}</b> integration for your form “
				{formTitle}”, but it failed. Here is the error we got:
			</Paragraph>
			<Panel>{error}</Panel>
			<ActionButton href={formUrl}>Open integration settings</ActionButton>
		</EmailLayout>
	);
}

IntegrationFailedEmail.PreviewProps = {
	error: "Webhook responded with HTTP 500",
	formTitle: "Contact us",
	formUrl: "http://localhost:3001",
	integrationName: "Webhook",
} satisfies IntegrationFailedProps;

export default IntegrationFailedEmail;
