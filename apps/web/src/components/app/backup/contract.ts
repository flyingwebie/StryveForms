/**
 * Local types matching `packages/api/src/services/backup/{jobs,index}.ts`
 * (real since P's `backup` tRPC router landed — see `backup-rpc.ts`). Kept
 * here rather than importing P's server-side types directly, since several
 * (job rows, `WorkspaceArchiveOverview`) aren't exported through the tRPC
 * router's inferred output in a shape worth re-deriving by hand.
 */

export type BackupJobKind =
	| "workspace_export"
	| "workspace_import"
	| "instance_backup"
	| "instance_restore";

export type BackupJobStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "cancelled";

export interface BackupJobLogEntry {
	at: string;
	level: "info" | "warn" | "error" | string;
	message: string;
}

/**
 * Matches `BackupProgress` in `services/backup/jobs.ts`: a done/total pair
 * per entity kind under `entities`, plus a couple of flat scalar fields.
 */
export interface BackupJobProgress {
	bytesWritten?: number;
	currentEntity?: string;
	entities?: Record<string, { done: number; total: number }>;
	phase?: string;
}

export interface BackupJob {
	createdAt: string;
	error?: string | null;
	expiresAt?: string | null;
	fileKey?: string | null;
	fileName?: string | null;
	finishedAt?: string | null;
	id: string;
	kind: BackupJobKind;
	log: BackupJobLogEntry[];
	options: Record<string, unknown>;
	progress: BackupJobProgress;
	/** The job's final summary once completed — shape depends on `kind`. */
	result?: Record<string, unknown> | null;
	sizeBytes?: number | null;
	startedAt?: string | null;
	status: BackupJobStatus;
	userId?: string | null;
	workspaceId?: string | null;
}

/** `startWorkspaceImport`'s `result` once the job completes. */
export interface WorkspaceImportResult {
	membersAdded: number;
	membersInvited: number;
	/** Integrations created switched off because their secret wasn't restored. */
	reconnectCount?: number;
	/** Form links that actually changed (older jobs don't have this). */
	slugChanges?: SlugChange[];
	workspaceId: string;
	workspaceName?: string;
}

export interface ArchiveMemberRow {
	email: string;
	/** Whether a user account with this email already exists on this instance. */
	hasAccount: boolean;
	/** Whether this row was a pending invite in the source workspace, not a member. */
	invited: boolean;
	role: "admin" | "user" | "readonly" | string;
}

/** Matches `inspectWorkspaceArchive`'s `slugChanges` entries exactly (`from`/`to`, no form title). */
export interface SlugChange {
	from: string;
	to: string;
}

/** Matches `ArchiveManifest` in `services/backup/manifest.ts`. */
export interface ArchiveManifest {
	appVersion: string;
	counts: Record<string, number>;
	createdAt: string;
	customDomains?: string[];
	includesSecrets: boolean;
	includesUploads: boolean;
	source: { instanceName: string; url: string };
	workspaces: { id: string; name: string }[];
}

export interface WorkspaceArchiveOverview {
	counts: Record<string, number>;
	customDomains: string[];
	includesSecrets: boolean;
	manifest: ArchiveManifest;
	members: ArchiveMemberRow[];
	/** Set once a passphrase has been tried; absent before the first attempt. */
	passphraseOk?: boolean;
	sizeBytes: number;
	slugChanges: SlugChange[];
	warnings: string[];
}

/**
 * The summary shown on the final step. Members, real link changes and the
 * reconnect count come from the job `result`; custom domains come from the
 * overview captured earlier in the same flow (assembled in
 * `stryveforms-import-flow.tsx`).
 */
export interface WorkspaceImportSummary {
	customDomains: string[];
	invitesCreated: number;
	membersAdded: number;
	reconnectCount: number;
	slugChanges: SlugChange[];
	workspaceId: string;
	workspaceName?: string;
}

export interface MemberDecision {
	email: string;
	imported: boolean;
	role: "admin" | "user" | "readonly";
}
