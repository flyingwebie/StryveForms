import type { FormUpdate } from "@StryveForms/forms/settings";

import type { FormDto } from "../lib/serialize";

export interface FormTemplate {
	category: string;
	description: string;
	name: string;
	slug: string;
	structure: FormUpdate;
}

/**
 * Snapshots a form's settings (title, fields, theme…) into a reusable
 * template structure, dropping identity/ownership fields that don't belong
 * on a template (id, slug, workspaceId, shareUrl…).
 */
export function structureFromForm(dto: FormDto): FormUpdate {
	const {
		id: _id,
		slug: _slug,
		workspaceId: _workspaceId,
		creatorId: _creatorId,
		hasPassword: _hasPassword,
		removedProperties: _removedProperties,
		shareUrl: _shareUrl,
		createdAt: _createdAt,
		updatedAt: _updatedAt,
		...structure
	} = dto;
	return structure as FormUpdate;
}

const opt = (names: string[]) => ({
	options: names.map((name) => ({ id: name, name })),
});

/** Built-in starter templates. */
export const TEMPLATES: FormTemplate[] = [
	{
		slug: "contact",
		name: "Contact form",
		category: "General",
		description: "Name, email and a message.",
		structure: {
			title: "Contact us",
			properties: [
				{
					id: "name",
					name: "Name",
					type: "text",
					required: true,
					placeholder: "Your name",
				},
				{
					id: "email",
					name: "Email",
					type: "email",
					required: true,
					placeholder: "name@example.com",
				},
				{
					id: "message",
					name: "Message",
					type: "text",
					multi_lines: true,
					required: true,
				},
			],
		},
	},
	{
		slug: "feedback",
		name: "Customer feedback",
		category: "Feedback",
		description: "Rating, NPS-style scale and open comments.",
		structure: {
			title: "How did we do?",
			properties: [
				{
					id: "rating",
					name: "Overall rating",
					type: "rating",
					rating_max_value: 5,
					required: true,
				},
				{
					id: "recommend",
					name: "How likely are you to recommend us?",
					type: "scale",
					scale_min_value: 0,
					scale_max_value: 10,
					scale_step_value: 1,
				},
				{
					id: "liked",
					name: "What did you like?",
					type: "multi_select",
					without_dropdown: true,
					multi_select: opt(["Product", "Support", "Price", "Speed"]),
				},
				{
					id: "comments",
					name: "Anything else?",
					type: "text",
					multi_lines: true,
				},
			],
		},
	},
	{
		slug: "event-registration",
		name: "Event registration",
		category: "Events",
		description: "Attendee details, ticket type and dietary needs.",
		structure: {
			title: "Event registration",
			properties: [
				{ id: "full_name", name: "Full name", type: "text", required: true },
				{ id: "email", name: "Email", type: "email", required: true },
				{ id: "phone", name: "Phone", type: "phone_number" },
				{
					id: "ticket",
					name: "Ticket",
					type: "select",
					without_dropdown: true,
					required: true,
					select: opt(["General", "VIP", "Student"]),
				},
				{
					id: "diet",
					name: "Dietary requirements",
					type: "multi_select",
					multi_select: opt(["None", "Vegetarian", "Vegan", "Gluten free"]),
				},
				{
					id: "consent",
					name: "I agree to the terms",
					type: "checkbox",
					required: true,
				},
			],
		},
	},
	{
		slug: "job-application",
		name: "Job application",
		category: "HR",
		description: "Contact details, CV upload and a short cover letter.",
		structure: {
			title: "Job application",
			properties: [
				{ id: "name", name: "Name", type: "text", required: true },
				{ id: "email", name: "Email", type: "email", required: true },
				{ id: "linkedin", name: "LinkedIn profile", type: "url" },
				{
					id: "cv",
					name: "CV / résumé",
					type: "files",
					required: true,
					allowed_file_types: "pdf,doc,docx",
				},
				{ id: "cover", name: "Why do you want to join?", type: "rich_text" },
				{
					id: "start",
					name: "Earliest start date",
					type: "date",
					disable_past_dates: true,
				},
			],
		},
	},
];

export function getTemplate(slug: string): FormTemplate | null {
	return TEMPLATES.find((t) => t.slug === slug) ?? null;
}

/** Distinct categories across the built-in templates, for gallery filter chips. */
export const BUILTIN_CATEGORIES = Array.from(
	new Set(TEMPLATES.map((t) => t.category))
).sort();
