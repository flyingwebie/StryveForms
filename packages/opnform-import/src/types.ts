/**
 * Response shapes of OpnForm's API (`/open/*`), read from its Laravel
 * resources. Only the fields the importer uses are typed; the rest pass through.
 */

export interface OpnformWorkspace {
	custom_domains?: string[] | null;
	icon: string | null;
	id: number;
	is_admin?: boolean;
	max_file_size?: number;
	name: string;
	settings?: Record<string, unknown> | null;
	users_count?: number;
	[key: string]: unknown;
}

export interface OpnformFormSummary {
	created_at: string;
	id: number;
	share_url?: string;
	slug: string;
	submissions_count?: number;
	tags?: string[] | null;
	title: string;
	updated_at?: string;
	views_count?: number;
	visibility: string;
	workspace_id?: number;
	[key: string]: unknown;
}

export interface OpnformProperty {
	id: string;
	name?: string;
	type: string;
	[key: string]: unknown;
}

export interface OpnformForm {
	computed_variables?: unknown[] | null;
	cover_picture?: string | null;
	id: number;
	logo_picture?: string | null;
	properties: OpnformProperty[];
	removed_properties?: OpnformProperty[] | null;
	slug: string;
	submissions_count?: number;
	title: string;
	views_count?: number;
	workspace_id?: number;
	[key: string]: unknown;
}

export interface OpnformFileValue {
	file_name: string;
	file_url: string;
}

export interface OpnformSubmission {
	completion_time: number | null;
	data: Record<string, unknown> & {
		created_at?: string;
		id?: number;
		ip_address?: string;
		status?: "completed" | "partial";
		submission_id?: string;
	};
	form_id: number;
	id: number;
	meta?: { attribution?: Record<string, string> } | null;
	submission_id: string;
}

export interface OpnformIntegration {
	created_at?: string;
	data: Record<string, unknown> | null;
	form_id: number;
	id: number;
	integration_id: string;
	logic: Record<string, unknown> | null;
	oauth_id?: string | null;
	status: string;
}

export interface OpnformWorkspaceUser {
	email: string;
	id: number;
	name: string;
	pivot?: { role?: string };
	[key: string]: unknown;
}

export interface Paginated<T> {
	data: T[];
	meta: {
		current_page: number;
		last_page: number;
		per_page: number;
		total: number;
	};
}
