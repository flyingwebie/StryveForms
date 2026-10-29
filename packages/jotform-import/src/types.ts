/**
 * Response shapes of the JotForm API (https://api.jotform.com/docs).
 * JotForm returns most numbers and flags as strings ("1", "Yes"). Only the
 * fields the importer reads are typed; the rest pass through.
 */

/** Every JotForm response is wrapped in this envelope. */
export interface JotformEnvelope<T> {
	content: T;
	duration?: string;
	"limit-left"?: number | string;
	message: string;
	responseCode: number;
	resultSet?: { count: number; limit: number; offset: number };
}

export interface JotformUser {
	account_type?: string | { name?: string } | null;
	avatarUrl?: string;
	email: string;
	name?: string | null;
	time_zone?: string;
	username: string;
	[key: string]: unknown;
}

export interface JotformFormSummary {
	archived?: string;
	count?: string;
	created_at: string;
	favorite?: string;
	id: string;
	last_submission?: string | null;
	new?: string;
	/** ENABLED, DISABLED or DELETED. */
	status: string;
	title: string;
	/** LEGACY (classic) or CARD (one question at a time). */
	type?: string;
	updated_at?: string | null;
	url?: string;
	username?: string;
	[key: string]: unknown;
}

/** One question from `GET /form/{id}/questions`, keyed by `qid`. */
export interface JotformQuestion {
	description?: string;
	hidden?: string;
	hint?: string;
	name?: string;
	options?: string;
	order: string;
	qid: string;
	required?: string;
	subLabel?: string;
	text?: string;
	type: string;
	[key: string]: unknown;
}

/** `GET /form/{id}/properties`. Values are strings or nested objects. */
export type JotformProperties = Record<string, unknown> & {
	activeRedirect?: string;
	conditions?: unknown;
	thanktext?: string;
	thankurl?: string;
	title?: string;
};

export interface JotformAnswer {
	answer?: unknown;
	name?: string;
	order?: string;
	prettyFormat?: string;
	text?: string;
	type?: string;
	[key: string]: unknown;
}

export interface JotformSubmission {
	answers?: Record<string, JotformAnswer> | unknown[];
	created_at: string;
	flag?: string;
	form_id: string;
	id: string;
	ip?: string;
	new?: string;
	notes?: string;
	/** ACTIVE, OVERQUOTA, DELETED… */
	status?: string;
	updated_at?: string | null;
	[key: string]: unknown;
}

/** One uploaded file from `GET /form/{id}/files`. */
export interface JotformFile {
	date?: string;
	form_id?: string;
	name: string;
	size?: string | number;
	submission_id?: string;
	type?: string;
	url: string;
	[key: string]: unknown;
}

export type JotformRegion = "us" | "eu" | "hipaa";
