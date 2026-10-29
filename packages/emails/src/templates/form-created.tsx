/** @jsxImportSource react */
import { type EmailBranding, EmailLayout } from "../components/layout";
import {
	ActionButton,
	EmailHeading,
	Panel,
	Paragraph,
} from "../components/primitives";

export interface FormCreatedProps {
	branding?: EmailBranding;
	embedCode: string;
	formTitle: string;
	shareUrl: string;
}

export function FormCreatedEmail({
	branding,
	embedCode,
	formTitle,
	shareUrl,
}: FormCreatedProps) {
	return (
		<EmailLayout
			branding={branding}
			preview={`Your form “${formTitle}” is ready`}
		>
			<EmailHeading>Your form is live 🎉</EmailHeading>
			<Paragraph>
				Your form “{formTitle}” was created. Share it with this link:
			</Paragraph>
			<Panel>{shareUrl}</Panel>
			<Paragraph>To embed it on your website, paste this code:</Paragraph>
			<Panel>{embedCode}</Panel>
			<ActionButton href={shareUrl}>Open your form</ActionButton>
		</EmailLayout>
	);
}

FormCreatedEmail.PreviewProps = {
	embedCode:
		'<iframe src="http://localhost:3001/forms/contact-abc123"></iframe>',
	formTitle: "Contact us",
	shareUrl: "http://localhost:3001/forms/contact-abc123",
} satisfies FormCreatedProps;

export default FormCreatedEmail;
