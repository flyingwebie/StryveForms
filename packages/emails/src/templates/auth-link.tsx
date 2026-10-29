/** @jsxImportSource react */
import { type EmailBranding, EmailLayout } from "../components/layout";
import {
	ActionButton,
	EmailHeading,
	Paragraph,
} from "../components/primitives";

export interface AuthLinkProps {
	branding?: EmailBranding;
	kind: "verify-email" | "reset-password";
	name?: string | null;
	url: string;
}

const COPY = {
	"reset-password": {
		action: "Reset password",
		body: "We received a request to reset your password. Click the button below to choose a new one. The link expires in 1 hour.",
		heading: "Reset your password",
	},
	"verify-email": {
		action: "Verify email",
		body: "Please confirm your email address to finish setting up your account.",
		heading: "Confirm your email",
	},
} as const;

export function AuthLinkEmail({ branding, kind, name, url }: AuthLinkProps) {
	const copy = COPY[kind];
	return (
		<EmailLayout branding={branding} preview={copy.heading}>
			<EmailHeading>{copy.heading}</EmailHeading>
			<Paragraph>Hello{name ? ` ${name}` : ""},</Paragraph>
			<Paragraph>{copy.body}</Paragraph>
			<ActionButton href={url}>{copy.action}</ActionButton>
			<Paragraph>
				If you didn’t request this, you can ignore this email.
			</Paragraph>
		</EmailLayout>
	);
}

AuthLinkEmail.PreviewProps = {
	kind: "verify-email",
	name: "Ada",
	url: "http://localhost:3001/verify?token=abc",
} satisfies AuthLinkProps;

export default AuthLinkEmail;
