import { createElement, type ReactElement } from "react";

import { AuthLinkEmail, type AuthLinkProps } from "./templates/auth-link";
import {
	BackupFailedEmail,
	type BackupFailedProps,
} from "./templates/backup-failed";
import {
	ExportReadyEmail,
	type ExportReadyProps,
} from "./templates/export-ready";
import {
	FormCreatedEmail,
	type FormCreatedProps,
} from "./templates/form-created";
import {
	ImportFinishedEmail,
	type ImportFinishedProps,
} from "./templates/import-finished";
import {
	IntegrationFailedEmail,
	type IntegrationFailedProps,
} from "./templates/integration-failed";
import {
	SubmissionNotificationEmail,
	type SubmissionNotificationProps,
} from "./templates/submission-notification";
import {
	TwoFactorOtpEmail,
	type TwoFactorOtpProps,
} from "./templates/two-factor-otp";
import {
	WorkspaceInviteEmail,
	type WorkspaceInviteProps,
} from "./templates/workspace-invite";

/** Builders that return ready-to-send React Email elements, so callers don't need React. */
export const emails = {
	authLink: (props: AuthLinkProps): ReactElement =>
		createElement(AuthLinkEmail, props),
	backupFailed: (props: BackupFailedProps): ReactElement =>
		createElement(BackupFailedEmail, props),
	exportReady: (props: ExportReadyProps): ReactElement =>
		createElement(ExportReadyEmail, props),
	formCreated: (props: FormCreatedProps): ReactElement =>
		createElement(FormCreatedEmail, props),
	importFinished: (props: ImportFinishedProps): ReactElement =>
		createElement(ImportFinishedEmail, props),
	integrationFailed: (props: IntegrationFailedProps): ReactElement =>
		createElement(IntegrationFailedEmail, props),
	submissionNotification: (props: SubmissionNotificationProps): ReactElement =>
		createElement(SubmissionNotificationEmail, props),
	twoFactorOtp: (props: TwoFactorOtpProps): ReactElement =>
		createElement(TwoFactorOtpEmail, props),
	workspaceInvite: (props: WorkspaceInviteProps): ReactElement =>
		createElement(WorkspaceInviteEmail, props),
};
