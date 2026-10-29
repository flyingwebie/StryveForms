/**
 * Where a backup file can be sent to: StryveForms' own storage (local disk or
 * whatever `STORAGE_DRIVER` is set to), or any S3-compatible bucket —
 * Cloudflare R2, RustFS, MinIO and a handful of other providers get a preset
 * with sensible defaults and per-field help text; "Custom" covers anything
 * else that speaks the S3 API.
 *
 * A destination's secret access key is encrypted at rest with
 * BETTER_AUTH_SECRET, exactly like the AI provider key — this reuses
 * services/ai/crypto.ts's `encryptApiKey`/`decryptApiKey` rather than
 * duplicating that scheme, per CONTRACT.md. Not the user's backup
 * passphrase: scheduled backups run unattended, with no one around to type
 * a passphrase for the destination itself (the passphrase still encrypts
 * the backup *contents*).
 *
 * `sink`/`source` below return P's real `ArchiveSink`/`ArchiveSource` types
 * (services/backup/streams.ts), so an opened destination plugs straight into
 * `writeInstanceArchive`/`restoreInstanceArchive`.
 */
import { DecryptionError, decryptApiKey, encryptApiKey } from "../ai/crypto";
import type { StorageDriver } from "../storage";
import type { ArchiveSink, ArchiveSource } from "./streams";

export class DestinationSecretError extends Error {
	constructor(cause?: unknown) {
		super(
			"Could not decrypt this destination's secret key. It may have been saved with a different BETTER_AUTH_SECRET.",
			{ cause }
		);
	}
}

/** Encrypts a destination's secret access key for storage in `instance_settings.backup_settings`. */
export function encryptDestinationSecret(
	instanceSecret: string,
	plaintext: string
): string {
	return encryptApiKey(instanceSecret, plaintext);
}

/** Decrypts a value produced by {@link encryptDestinationSecret}. */
export function decryptDestinationSecret(
	instanceSecret: string,
	encoded: string
): string {
	try {
		return decryptApiKey(instanceSecret, encoded);
	} catch (cause) {
		if (cause instanceof DecryptionError) {
			// biome-ignore lint/style/useErrorCause: forwarded via the subclass's super() call
			throw new DestinationSecretError(cause);
		}
		throw cause;
	}
}

/** `•••• last4` — safe to send to the browser once a destination is saved. */
export function maskSecret(plaintext: string): string {
	const tail = plaintext.slice(-4);
	return tail.length === 4 ? `•••• ${tail}` : "••••";
}

/* -------------------------------------------------------------------------- */
/*                                  Presets                                  */
/* -------------------------------------------------------------------------- */

export const S3_PRESET_IDS = [
	"aws-s3",
	"cloudflare-r2",
	"rustfs",
	"minio",
	"backblaze-b2",
	"wasabi",
	"hetzner",
	"digitalocean-spaces",
	"custom",
] as const;

export type S3PresetId = (typeof S3_PRESET_IDS)[number];

export interface S3FieldHelp {
	/** One short, plain-language line shown under the field. */
	help: string;
	/** Placeholder text shown in the empty input. */
	placeholder?: string;
}

export interface S3Preset {
	/** Sensible starting values for a fresh destination using this preset. */
	defaults: {
		bucket?: string;
		endpoint?: string;
		pathStyle: boolean;
		region: string;
	};
	fields: {
		accessKeyId: S3FieldHelp;
		bucket: S3FieldHelp;
		endpoint: S3FieldHelp;
		region: S3FieldHelp;
		secretAccessKey: S3FieldHelp;
	};
	id: S3PresetId;
	/** Plain-language description of the provider, shown above its fields. */
	intro: string;
	/** Where to create an access key / secret key pair for this provider. */
	keysUrl: string;
	label: string;
}

const R2_ENDPOINT_HELP =
	"From your Cloudflare dashboard: R2 → your bucket → Settings. Replace <ACCOUNT_ID> with your Cloudflare account id.";

export const S3_PRESETS: Record<S3PresetId, S3Preset> = {
	"aws-s3": {
		defaults: { pathStyle: false, region: "us-east-1" },
		fields: {
			accessKeyId: {
				help: "The access key id from an IAM user with S3 read/write/delete access to this bucket.",
			},
			bucket: { help: "The S3 bucket name. It must already exist." },
			endpoint: {
				help: "Leave empty for real AWS S3 — it's only needed for an S3-compatible service.",
				placeholder: "(leave empty for AWS S3)",
			},
			region: {
				help: "The AWS region your bucket was created in, e.g. us-east-1.",
			},
			secretAccessKey: {
				help: "The secret access key that pairs with the access key id above.",
			},
		},
		id: "aws-s3",
		intro: "Amazon's own object storage.",
		keysUrl: "https://console.aws.amazon.com/iam/home#/users",
		label: "AWS S3",
	},
	"cloudflare-r2": {
		defaults: {
			endpoint: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
			pathStyle: false,
			region: "auto",
		},
		fields: {
			accessKeyId: {
				help: "Created with the bucket's R2 API token — see the link below.",
			},
			bucket: { help: "The R2 bucket name. It must already exist." },
			endpoint: {
				help: R2_ENDPOINT_HELP,
				placeholder: "https://<ACCOUNT_ID>.r2.cloudflarestorage.com",
			},
			region: { help: 'R2 doesn\'t use regions; leave this as "auto".' },
			secretAccessKey: {
				help: "Created together with the access key id, shown only once — save it then.",
			},
		},
		id: "cloudflare-r2",
		intro:
			"Cloudflare's S3-compatible storage. Zero egress fees, and the cheapest option for frequent backups.",
		keysUrl: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
		label: "Cloudflare R2",
	},
	rustfs: {
		defaults: { pathStyle: true, region: "us-east-1" },
		fields: {
			accessKeyId: {
				help: "The access key configured for your RustFS instance (default `rustfsadmin` unless changed).",
			},
			bucket: {
				help: "The bucket name. RustFS creates it on first write if it doesn't exist.",
			},
			endpoint: {
				help: "Your RustFS server's URL, e.g. https://backups.example.com:9000.",
				placeholder: "https://your-rustfs-host:9000",
			},
			region: {
				help: 'RustFS accepts any region string; "us-east-1" works unless you set one yourself.',
			},
			secretAccessKey: {
				help: "The secret key configured for your RustFS instance.",
			},
		},
		id: "rustfs",
		intro:
			"A self-hosted, S3-compatible object store — a good fit if you want backups to stay on your own infrastructure.",
		keysUrl: "https://rustfs.com/docs/",
		label: "RustFS",
	},
	minio: {
		defaults: { pathStyle: true, region: "us-east-1" },
		fields: {
			accessKeyId: {
				help: "The MinIO root user, or an access key created in the MinIO console.",
			},
			bucket: {
				help: 'The bucket name. Create it in the MinIO console first, or let "Test connection" create it.',
			},
			endpoint: {
				help: "Your MinIO server's URL, e.g. https://minio.example.com:9000.",
				placeholder: "https://your-minio-host:9000",
			},
			region: {
				help: 'MinIO accepts any region string; "us-east-1" is the usual default.',
			},
			secretAccessKey: {
				help: "The MinIO root password, or the matching secret for the access key above.",
			},
		},
		id: "minio",
		intro:
			"A self-hosted, S3-compatible object store — common for homelab and on-prem setups.",
		keysUrl:
			"https://min.io/docs/minio/linux/administration/identity-access-management/minio-user-management.html",
		label: "MinIO",
	},
	"backblaze-b2": {
		defaults: { pathStyle: false, region: "us-west-004" },
		fields: {
			accessKeyId: { help: 'The "keyID" from a B2 application key.' },
			bucket: { help: "The B2 bucket name. It must already exist." },
			endpoint: {
				help: "Your B2 bucket's S3 endpoint, shown on the bucket's details page (e.g. s3.us-west-004.backblazeb2.com).",
				placeholder: "s3.us-west-004.backblazeb2.com",
			},
			region: { help: "The region in your B2 endpoint, e.g. us-west-004." },
			secretAccessKey: {
				help: 'The "applicationKey" shown once when the key was created.',
			},
		},
		id: "backblaze-b2",
		intro: "Backblaze's low-cost object storage with an S3-compatible API.",
		keysUrl: "https://secure.backblaze.com/app_keys.htm",
		label: "Backblaze B2",
	},
	wasabi: {
		defaults: { pathStyle: false, region: "us-east-1" },
		fields: {
			accessKeyId: { help: "The access key from a Wasabi access key pair." },
			bucket: { help: "The Wasabi bucket name. It must already exist." },
			endpoint: {
				help: "Your Wasabi region's endpoint, e.g. s3.us-east-1.wasabisys.com.",
				placeholder: "s3.us-east-1.wasabisys.com",
			},
			region: { help: "The region your Wasabi bucket was created in." },
			secretAccessKey: {
				help: "The secret key that pairs with the access key above.",
			},
		},
		id: "wasabi",
		intro: "Wasabi's flat-rate, S3-compatible object storage.",
		keysUrl: "https://console.wasabisys.com/#/access_keys",
		label: "Wasabi",
	},
	hetzner: {
		defaults: { pathStyle: false, region: "fsn1" },
		fields: {
			accessKeyId: {
				help: "The access key created for your Hetzner Object Storage project.",
			},
			bucket: { help: "The bucket name. It must already exist." },
			endpoint: {
				help: "Your Hetzner location's endpoint, e.g. fsn1.your-objectstorage.com.",
				placeholder: "fsn1.your-objectstorage.com",
			},
			region: { help: "Your Hetzner location code, e.g. fsn1, nbg1 or hel1." },
			secretAccessKey: {
				help: "The secret key that pairs with the access key above.",
			},
		},
		id: "hetzner",
		intro:
			"Hetzner's S3-compatible object storage, billed alongside the rest of your Hetzner account.",
		keysUrl: "https://console.hetzner.com/",
		label: "Hetzner Object Storage",
	},
	"digitalocean-spaces": {
		defaults: { pathStyle: false, region: "nyc3" },
		fields: {
			accessKeyId: { help: "The access key from a Spaces access key pair." },
			bucket: { help: "The Space's name. It must already exist." },
			endpoint: {
				help: "Your Space's region endpoint, e.g. nyc3.digitaloceanspaces.com.",
				placeholder: "nyc3.digitaloceanspaces.com",
			},
			region: { help: "The region your Space was created in, e.g. nyc3." },
			secretAccessKey: {
				help: "The secret key that pairs with the access key above.",
			},
		},
		id: "digitalocean-spaces",
		intro: "DigitalOcean's S3-compatible object storage.",
		keysUrl: "https://cloud.digitalocean.com/account/api/spaces",
		label: "DigitalOcean Spaces",
	},
	custom: {
		defaults: { pathStyle: true, region: "us-east-1" },
		fields: {
			accessKeyId: {
				help: "The access key id your S3-compatible provider gave you.",
			},
			bucket: { help: "The bucket name. It must already exist." },
			endpoint: {
				help: "The full URL of your provider's S3-compatible endpoint.",
				placeholder: "https://s3.your-provider.example.com",
			},
			region: {
				help: "Whatever region string your provider expects; many accept any value.",
			},
			secretAccessKey: {
				help: "The secret access key that pairs with the access key id above.",
			},
		},
		id: "custom",
		intro: "Any other S3-compatible service not listed above.",
		keysUrl: "",
		label: "Custom S3-compatible",
	},
};

/* -------------------------------------------------------------------------- */
/*                               Destination config                          */
/* -------------------------------------------------------------------------- */

export interface ServerDestinationConfig {
	id: string;
	kind: "server";
	label: string;
	/** Key prefix inside the instance's own storage. Default "backups/". */
	prefix: string;
}

export interface S3DestinationConfig {
	accessKeyId: string;
	bucket: string;
	/** The endpoint URL, with any `<ACCOUNT_ID>`-style placeholder already filled in. */
	endpoint: string;
	id: string;
	kind: "s3";
	label: string;
	/** Whether to address the bucket as part of the path (true, needed by most non-AWS providers) or as a subdomain (false, AWS/R2 style). */
	pathStyle: boolean;
	/** Key prefix inside the bucket. Default "backups/". */
	prefix: string;
	preset: S3PresetId;
	region: string;
	/** Encrypted with {@link encryptDestinationSecret}; decrypt before use. */
	secretAccessKeyEncrypted: string;
}

export type DestinationConfig = ServerDestinationConfig | S3DestinationConfig;

const DEFAULT_PREFIX = "backups/";

/** A fresh destination for the given preset, with sensible defaults filled in and empty credential fields. */
export function createS3DestinationDraft(
	preset: S3PresetId,
	id: string,
	label: string
): Omit<S3DestinationConfig, "secretAccessKeyEncrypted"> & {
	secretAccessKey: string;
} {
	const p = S3_PRESETS[preset];
	return {
		accessKeyId: "",
		bucket: p.defaults.bucket ?? "",
		endpoint: p.defaults.endpoint ?? "",
		id,
		kind: "s3",
		label,
		pathStyle: p.defaults.pathStyle,
		prefix: DEFAULT_PREFIX,
		preset,
		region: p.defaults.region,
		secretAccessKey: "",
	};
}

export function serverDestinationDraft(
	id: string,
	label = "This instance's storage"
): ServerDestinationConfig {
	return { id, kind: "server", label, prefix: DEFAULT_PREFIX };
}

/* -------------------------------------------------------------------------- */
/*                               Open + operate                              */
/* -------------------------------------------------------------------------- */

export interface DestinationEntry {
	key: string;
	lastModified?: Date;
	size?: number;
}

export interface OpenedDestination {
	delete: (key: string) => Promise<void>;
	list: (prefix?: string) => Promise<DestinationEntry[]>;
	/** An `ArchiveSink` (services/backup/streams.ts) that streams straight into this destination. */
	sink: (key: string) => ArchiveSink;
	/** An `ArchiveSource` (services/backup/streams.ts) reading this destination's object. */
	source: (key: string) => ArchiveSource;
	/** Writes, reads back and deletes a small probe file. Never throws — check `ok`. */
	test: () => Promise<{ message: string; ok: boolean }>;
}

const TEST_KEY_PREFIX = ".stryveforms-connection-test-";
const TEST_CONTENT = "StryveForms connection test";
const LEADING_SLASHES_RE = /^\/+/;
const TRAILING_SLASHES_RE = /\/+$/;

function joinKey(prefix: string, key: string): string {
	const cleanPrefix = prefix
		.replace(LEADING_SLASHES_RE, "")
		.replace(TRAILING_SLASHES_RE, "");
	const cleanKey = key.replace(LEADING_SLASHES_RE, "");
	return cleanPrefix ? `${cleanPrefix}/${cleanKey}` : cleanKey;
}

/**
 * Keyword → friendly explanation, checked against the error's message and
 * (for Bun's `S3Error`, whose `.message` is often a generic "an unexpected
 * error has occurred") its `.code` (e.g. "DNSResolveFailed"). First match wins.
 */
const CONNECTION_ERROR_HINTS: readonly [RegExp, string][] = [
	[
		/enotfound|getaddrinfo|dnsresolvefailed/,
		"Could not reach that endpoint. Double-check the endpoint URL.",
	],
	[
		/econnrefused|connectionrefused|timed out|timeout/,
		"The connection timed out or was refused. For a self-hosted service (RustFS, MinIO), confirm it's running and reachable from this server.",
	],
	[
		/403|accessdenied|signaturedoesnotmatch|invalidaccesskeyid|does not exist in our records/,
		"The provider rejected the credentials (access denied). Double-check the access key id and secret access key.",
	],
	[
		/404|nosuchbucket/,
		"The bucket was not found. Double-check the bucket name and region.",
	],
];

/** Friendlier message for the handful of failures people actually hit. */
function describeConnectionError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	const code =
		error && typeof error === "object" && "code" in error
			? String((error as { code?: unknown }).code ?? "")
			: "";
	const detail = code ? `${message} — ${code}` : message;
	const lower = `${message} ${code}`.toLowerCase();
	const hint = CONNECTION_ERROR_HINTS.find(([pattern]) => pattern.test(lower));
	return hint ? `${hint[1]} (${detail})` : message;
}

/** Opens a destination for writing/reading backup archives and testing the connection. */
export function openDestination(
	config: DestinationConfig,
	context: { instanceSecret: string; storage: StorageDriver }
): OpenedDestination {
	if (config.kind === "server") {
		return openServerDestination(config, context.storage);
	}
	return openS3Destination(config, context.instanceSecret);
}

function openServerDestination(
	config: ServerDestinationConfig,
	storage: StorageDriver
): OpenedDestination {
	const full = (key: string) => joinKey(config.prefix, key);
	return {
		delete: (key) => storage.delete(full(key)),
		list: () => {
			throw new Error(
				"Listing files isn't supported for the 'server' destination; backup_job rows are the source of truth for what's been taken."
			);
		},
		sink: (key) => {
			const chunks: Uint8Array[] = [];
			return {
				abort: () => Promise.resolve(),
				close: async () => {
					// Copies each chunk into a fresh ArrayBuffer-backed Uint8Array:
					// `Blob`'s stricter DOM typing (ArrayBufferView<ArrayBuffer>) can
					// otherwise reject a Uint8Array whose buffer is typed as the more
					// general ArrayBufferLike.
					const blob = new Blob(chunks.map((chunk) => new Uint8Array(chunk)));
					await storage.put(full(key), blob);
				},
				write: (chunk) => {
					chunks.push(chunk);
					return Promise.resolve();
				},
			};
		},
		source: (key) => {
			let started = false;
			return new ReadableStream<Uint8Array>({
				async pull(controller) {
					if (started) {
						controller.close();
						return;
					}
					started = true;
					const blob = await storage.get(full(key));
					if (!blob) {
						controller.error(new Error(`Not found: ${key}`));
						return;
					}
					controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
					controller.close();
				},
			});
		},
		test: async () => {
			const key = `${TEST_KEY_PREFIX}${Date.now()}`;
			try {
				await storage.put(full(key), TEST_CONTENT, "text/plain");
				const read = await storage.get(full(key));
				const text = read ? await read.text() : "";
				await storage.delete(full(key));
				if (text !== TEST_CONTENT) {
					return {
						message: "Wrote a test file but read back different contents.",
						ok: false,
					};
				}
				return {
					message: "Wrote, read and deleted a test file successfully.",
					ok: true,
				};
			} catch (error) {
				return { message: describeConnectionError(error), ok: false };
			}
		},
	};
}

function openS3Destination(
	config: S3DestinationConfig,
	instanceSecret: string
): OpenedDestination {
	const secretAccessKey = decryptDestinationSecret(
		instanceSecret,
		config.secretAccessKeyEncrypted
	);
	const client = new Bun.S3Client({
		accessKeyId: config.accessKeyId,
		bucket: config.bucket,
		endpoint: config.endpoint || undefined,
		region: config.region,
		secretAccessKey,
		virtualHostedStyle: !config.pathStyle,
	});
	const full = (key: string) => joinKey(config.prefix, key);

	return {
		delete: (key) => client.delete(full(key)),
		list: async (prefix) => {
			const result = await client.list({
				prefix: prefix ? full(prefix) : config.prefix || undefined,
			});
			return (result.contents ?? []).map((entry) => ({
				key: entry.key,
				lastModified: entry.lastModified
					? new Date(entry.lastModified)
					: undefined,
				size: entry.size,
			}));
		},
		sink: (key) => {
			const writer = client.file(full(key)).writer();
			return {
				abort: async (reason) => {
					await writer.end(
						reason instanceof Error
							? reason
							: new Error(String(reason ?? "aborted"))
					);
				},
				close: async () => {
					await writer.end();
				},
				write: async (chunk) => {
					await writer.write(chunk);
				},
			};
		},
		source: (key) => client.file(full(key)).stream(),
		test: async () => {
			const key = full(`${TEST_KEY_PREFIX}${Date.now()}`);
			try {
				await client.write(key, TEST_CONTENT, { type: "text/plain" });
				const text = await client.file(key).text();
				await client.delete(key);
				if (text !== TEST_CONTENT) {
					return {
						message: "Wrote a test file but read back different contents.",
						ok: false,
					};
				}
				return {
					message: "Wrote, read and deleted a test file successfully.",
					ok: true,
				};
			} catch (error) {
				return { message: describeConnectionError(error), ok: false };
			}
		},
	};
}
