# Backup / export / import contract

Owner: engineer P (backup core). See `/tmp/sf-scripts/BACKUP_DESIGN.md` for the agreed design this
implements. This file documents the real, implemented signatures in `services/backup/`. If a
signature changes after this was first published, the change is noted at the top of this section.

## Changes since first publish

- `writeInstanceArchive` returns `{ manifest, sizeBytes }` (not just `{ manifest }}`) — R's
  `instance-jobs.ts` already expects `sizeBytes`, this just matches it.
- `startWorkspaceExport`/`inspectWorkspaceArchive`/`startWorkspaceImport` take `uploadKey`/produce
  export jobs using a **bare id**, not a full storage path. The actual storage key is always
  `tmp/backups/<uploadKey>` for an upload, and `exports/<jobId>.stryve.zip` for a finished
  workspace export. This matches the convention `routers/backup-admin.ts` (R) already uses for
  instance backups — see "Storage layout" below.

## Storage layout

- `tmp/backups/<uploadKey>` — a file uploaded via `POST /api/backups/upload`, before it's been
  inspected/imported/restored. `<uploadKey>` is a bare opaque id (`newPublicId()`), returned by
  that route. Deleted by nobody automatically today (small known gap — see "Known gaps" in my
  final report; a future pass should purge `tmp/backups/*` after a job finishes or after ~24h,
  mirroring `purgeTemporaryUploads`).
- `exports/<jobId>.stryve.zip` — a finished workspace export, downloadable by its owner. Purged
  after `backup_job.expiresAt` (7 days) by `services/maintenance.ts` → `purgeExpiredBackupFiles`.
- An instance backup's finished file lives wherever its destination put it (`services/backup/destinations.ts`,
  owned by R) — `server` destinations use `backups/` in the instance's own storage.

## `services/backup/jobs.ts`

`backup_job` row helpers, shared by every job kind.

```ts
type BackupJobKind = "workspace_export" | "workspace_import" | "instance_backup" | "instance_restore";
type BackupJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
type BackupJobTrigger = "manual" | "scheduled" | "safety" | "cli";

interface BackupProgress {
  phase?: string;
  currentEntity?: string;
  bytesWritten?: number;
  entities: Record<string, { done: number; total: number }>;
}

class BackupJobReporter {
  constructor(db: Database, jobId: string);
  readonly jobId: string;
  readonly log: { at: string; level: "info"|"warn"|"error"; message: string }[];
  readonly progress: BackupProgress;
  add(level: "info"|"warn"|"error", message: string): void;
  setProgress(patch: Partial<BackupProgress>): void;
  entityProgress(entity: string, done: number, total: number): void;
  /** Writes log/progress to the row. Throttled to once/second unless `force`. */
  flush(force?: boolean): Promise<void>;
  /** Throws BackupJobCancelled if `cancelBackupJob` was called for this job. Call between steps. */
  checkCancelled(): void;
}
class BackupJobCancelled extends Error {}

function createBackupJob(db, input: {
  id?: string; kind: BackupJobKind; trigger?: BackupJobTrigger;
  userId?: string | null; workspaceId?: string | null; destinationId?: string | null;
  options?: Record<string, unknown>;
}): Promise<{ id: string }>;

function finishBackupJob(db, jobId: string, input?: {
  fileKey?: string | null; fileName?: string | null; sizeBytes?: number | null;
  expiresAt?: Date | null; result?: Record<string, unknown> | null;
}): Promise<void>;

function failBackupJob(db, jobId: string, error: string): Promise<void>;
function markBackupJobCancelled(db, jobId: string): Promise<void>;
function getBackupJob(db, jobId: string);
function listBackupJobs(db, filter?: { userId?: string|null; workspaceId?: string|null; kind?: BackupJobKind });
/** Flips the cancel signal a running job's `reporter.checkCancelled()` polls. Returns false if the job isn't running. */
function cancelBackupJob(db, jobId: string): Promise<boolean>;
/** Marks jobs left "running" by a server restart as failed — call once at boot, like `failInterruptedJobs`. */
function failInterruptedBackupJobs(db): Promise<void>;
```

## `services/backup/streams.ts`

```ts
interface ArchiveSink {
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: (reason?: unknown) => Promise<void>;
}
type ArchiveSource = ReadableStream<Uint8Array>;

function storageSink(storage: StorageDriver, key: string): ArchiveSink;
function storageSource(storage: StorageDriver, key: string): Promise<ArchiveSource>;
function readableFromAsyncGenerator<T>(gen: AsyncGenerator<T>): ReadableStream<T>;
function readAll(source: ArchiveSource): Promise<Uint8Array>;
function sourceFromBytes(bytes: Uint8Array): ArchiveSource;
function memorySink(): ArchiveSink & { bytes: () => Uint8Array };
```

## `services/backup/crypto.ts`

```ts
const MIN_PASSPHRASE_LENGTH = 12;
class WeakPassphraseError extends Error {}
class WrongPassphraseError extends Error {}         // bad passphrase, OR tampered/corrupt ciphertext
class TruncatedContainerError extends Error {}       // stream ended before the final-chunk marker

function assertPassphraseStrength(passphrase: string): void;

// secrets.enc (one-shot, small)
function encryptSecretsMap(passphrase: string, map: Record<string,string>): Promise<Uint8Array>;
function decryptSecretsMap(passphrase: string, bytes: Uint8Array): Promise<Record<string,string>>; // throws WrongPassphraseError

// .stryve-backup streaming container
const CONTAINER_MAGIC = "STRYVEBK";
const CONTAINER_VERSION = 1;
function encryptStream(source: ArchiveSource, passphrase: string): ArchiveSource;
function decryptStream(source: ArchiveSource, passphrase: string): ArchiveSource; // throws WrongPassphraseError / TruncatedContainerError
function readContainerHeader(source: ArchiveSource): Promise<{ version: number; chunkSize: number }>;
```

AES-256-GCM throughout; key derived via scrypt (N=2^17, r=8, p=1, random 16-byte salt) — **not**
BETTER_AUTH_SECRET. The unattended scheduled-backup passphrase (R's `scheduler.ts`/`destinations.ts`)
is the opposite case and should keep reusing `services/ai/crypto.ts`'s `encryptApiKey`/`decryptApiKey`
(BETTER_AUTH_SECRET-derived) — don't duplicate that here.

Container format: plaintext header `magic(8) | version(1) | salt(16) | baseNonce(12) | chunkSize(4,
LE)` (53 bytes), then a stream of chunks `flag(1) | ciphertextLen(4,LE) | ciphertext | authTag(16)`.
`flag=1` marks an empty final chunk — a stream that ends without one is truncated.

## `services/backup/index.ts` — the public API

```ts
function startWorkspaceExport(db, services, {
  userId, workspaceId, includeUploads, passphrase?, trigger?: "manual"|"cli"
}): Promise<{ jobId: string }>;

function inspectWorkspaceArchive(db, services, {
  userId, uploadKey, passphrase?
}): Promise<WorkspaceArchiveOverview>;
// WorkspaceArchiveOverview = { manifest, counts, sizeBytes, warnings: string[], includesSecrets,
//   passphraseOk?: boolean, members: {email,role,hasAccount,invited}[], customDomains: string[],
//   slugChanges: {from,to}[] }

function startWorkspaceImport(db, services, {
  userId, uploadKey, passphrase?, members: {email,role}[], sendInvites
}): Promise<{ jobId: string }>;

// Instance scope — called by R's instance-jobs.ts (ArchiveBackend)
function writeInstanceArchive(db, services, {
  passphrase, sink: ArchiveSink, reporter: BackupJobReporter
}): Promise<{ manifest, sizeBytes: number }>;

function inspectInstanceBackup(db, services, {
  source: ArchiveSource, passphrase
}): Promise<{ manifest }>;    // throws WrongPassphraseError / TruncatedContainerError

function restoreInstanceArchive(db, services, {
  source: ArchiveSource, passphrase, reporter: BackupJobReporter
}): Promise<{ manifest }>;    // wipes + restores in one DB transaction; ids kept as-is

// Also re-exported from here: everything in jobs.ts, plus WrongPassphraseError/
// TruncatedContainerError/MIN_PASSPHRASE_LENGTH from crypto.ts, plus ArchiveSink/ArchiveSource types.
```

Instance-scope secrets note: unlike a workspace export, `writeInstanceArchive` does **not** blank
or `secretRef`-indirect any integration/SMTP/AI secrets — they travel in plaintext inside the inner
ZIP. The outer `.stryve-backup` AES-256-GCM container (mandatory passphrase) is the only protection,
per BACKUP_DESIGN.md's "Always encrypted… because password hashes are inside". `restoreInstanceArchive`
restores every table's rows with their **original ids** (no remap — the design says ids stay the
same after a full restore).

Workspace scope always creates **new** ids (`RemapTable` in `rewrite.ts`) and rewrites every
storage key/URL it finds inside JSON values (`rewriteValueReferences`) — see `rewrite.ts` for the
substring-replace approach and its unit tests.

## `routers/backup.ts` (tRPC, registered as `backup`)

- `exportWorkspace({ workspaceId, includeUploads, passphrase? })` — mutation, requires the
  `export_workspace` capability in that workspace.
- `inspectImport({ uploadKey, passphrase? })` — mutation (any signed-in user).
- `startImport({ uploadKey, passphrase?, members, sendInvites })` — mutation (any signed-in user —
  same rule as `workspace.create`).
- `job({ id })` — query, the caller's own job (any kind, 404s otherwise).
- `jobs({ workspaceId? })` — query, the caller's own export/import jobs.
- `cancel({ id })` — mutation, the caller's own job only.

## HTTP (`apps/server/src/index.ts`)

- `POST /api/backups/upload` — authenticated (any signed-in user). Streams the raw request body
  into `tmp/backups/<uploadKey>` (uploadKey = `newPublicId()`, returned in the response). Body-limited
  to `BACKUP_MAX_UPLOAD_MB` (env, default 20480). Returns `{ uploadKey, sizeBytes }`. **uploadKey is a
  bare id — callers that need the actual storage key build `tmp/backups/<uploadKey>` themselves**
  (this is what `backup-admin.ts`'s `inspect`/`restore` procedures already do, and what
  `services/backup/index.ts` does internally for workspace import).
- `GET /api/backups/jobs/:id/download` — authenticated; the job's owner, or (for
  `instance_backup`/`instance_restore` jobs) any instance admin. Streams `storage.getStream(job.fileKey)`.

## Known gaps (see my final report for the full list)

- `tmp/backups/*` uploads are never purged automatically (only `exports/*` and instance-backup
  destination files are). Low risk today (small dev workspaces) but should get a maintenance sweep.
- Workspace export/import carries folders, forms+versions, submissions, integrations (secrets
  blanked/`secretRef`'d), PDF templates (+source file), workspace templates, the workspace's AI
  credential, stored files (assets always, uploads/signatures behind the toggle), members+invites.
  It does **not** carry `formStatistic`/`formView` (view counts) or `formIntegrationEvent` (delivery
  logs — intentionally excluded per the design) — view counts reset to zero after an import.
- `scanWorkspaceArchive` (the `inspectWorkspaceArchive` preview) and `readWorkspaceArchiveMetadata`
  (import's first pass) both let their underlying zip-read pump finish in the background even after
  they've read everything they need — slightly wasteful I/O on a very large archive, never incorrect.
- `readZipEntries`'s per-entry `ReadableStream` isn't strictly backpressured against the producer
  (see the comment in `zip.ts`) — fine for workspace/instance archive sizes in practice, called out
  for whoever next works on very large archives.
