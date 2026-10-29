/** @jsxImportSource react */
import { type EmailBranding, EmailLayout } from "../components/layout";
import { ActionButton, Panel, Paragraph } from "../components/primitives";

export interface BackupFailedProps {
	adminUrl: string;
	branding?: EmailBranding;
	error: string;
	/** "manual" | "scheduled" | "safety" | "cli" — shown as plain words. */
	trigger: string;
}

const TRIGGER_WORDS: Record<string, string> = {
	cli: "a backup started from the command line",
	manual: "a backup you started",
	safety: "the automatic safety backup taken before a restore",
	scheduled: "a scheduled backup",
};

export function BackupFailedEmail({
	adminUrl,
	branding,
	error,
	trigger,
}: BackupFailedProps) {
	const what = TRIGGER_WORDS[trigger] ?? "an instance backup";
	return (
		<EmailLayout branding={branding} preview="An instance backup failed">
			<Paragraph>Hello,</Paragraph>
			<Paragraph>
				{what} on this StryveForms instance failed. Here is the error we got:
			</Paragraph>
			<Panel>{error}</Panel>
			<Paragraph>
				Check Admin → Backups for details, and consider taking a manual backup
				once the problem is fixed.
			</Paragraph>
			<ActionButton href={adminUrl}>Open Admin → Backups</ActionButton>
		</EmailLayout>
	);
}

BackupFailedEmail.PreviewProps = {
	adminUrl: "http://localhost:3002/dashboard/admin?tab=backups",
	error:
		"Could not reach the configured S3 destination (DNS resolution failed).",
	trigger: "scheduled",
} satisfies BackupFailedProps;

export default BackupFailedEmail;
