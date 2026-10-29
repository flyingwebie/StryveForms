/** @jsxImportSource react */
import { type EmailBranding, EmailLayout } from "../components/layout";
import {
	ActionButton,
	EmailHeading,
	Paragraph,
} from "../components/primitives";

export interface WorkspaceInviteProps {
	branding?: EmailBranding;
	inviterName?: string | null;
	inviteUrl: string;
	workspaceName: string;
}

export function WorkspaceInviteEmail({
	branding,
	inviteUrl,
	inviterName,
	workspaceName,
}: WorkspaceInviteProps) {
	const appName = branding?.appName ?? "StryveForms";
	return (
		<EmailLayout
			branding={branding}
			preview={`Join ${workspaceName} on ${appName}`}
		>
			<EmailHeading>
				Join {workspaceName} on {appName}
			</EmailHeading>
			<Paragraph>
				{inviterName ? `${inviterName} has` : "You have been"} invited you to
				the workspace “{workspaceName}”. {appName} is an open-source tool for
				building forms and collecting answers.
			</Paragraph>
			<ActionButton href={inviteUrl}>Accept invitation</ActionButton>
			<Paragraph>
				If you weren’t expecting this, you can ignore this email.
			</Paragraph>
		</EmailLayout>
	);
}

WorkspaceInviteEmail.PreviewProps = {
	inviteUrl: "http://localhost:3001/invites/abc",
	inviterName: "Ada",
	workspaceName: "Acme",
} satisfies WorkspaceInviteProps;

export default WorkspaceInviteEmail;
