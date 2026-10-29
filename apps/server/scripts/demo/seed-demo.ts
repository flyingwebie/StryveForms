/**
 * Demo data seed for the fumadocs screenshots.
 *
 * Creates a self-contained workspace ("Acme Studio") owned by the tester
 * account, with realistic forms, submissions, folders, integrations, a PDF
 * template, saved templates, extra members and AI chat transcripts — so the
 * docs screenshots never touch the user's own "Test's workspace" data or
 * their real AI provider key.
 *
 * Idempotent: re-running this script deletes the previous "Acme Studio"
 * workspace (and everything that cascades from it: forms, submissions,
 * integrations, PDF templates, AI chats) and rebuilds it from scratch. The
 * two extra demo users (maya@acme.example, ravi@acme.example) are reused by
 * email across runs instead of being re-created.
 *
 * Run from apps/server so workspace package imports (@StryveForms/db,
 * @StryveForms/api/*, @StryveForms/forms/*) resolve, and so the
 * `varlock/auto-load` import below reads apps/server/.env the same way the
 * real server does (this repo disables Bun's own .env auto-load — see the
 * root bunfig.toml — in favour of varlock):
 *
 *   cd apps/server && bun run scripts/demo/seed-demo.ts
 *
 * Does NOT touch the real tester workspace, its forms, or its AI
 * credential. The active workspace a browser shows is stored client-side
 * only (localStorage key "stryveforms.currentWorkspaceId" — see
 * apps/web/src/lib/workspace.ts), so this script never needs to "restore"
 * anything server-side; each browser (incl. the screenshot script's own,
 * isolated Playwright profile) keeps its own choice.
 */

import "varlock/auto-load";

import { newId } from "@StryveForms/api/lib/ids";
import { toFormDto } from "@StryveForms/api/lib/serialize";
import { encryptApiKey } from "@StryveForms/api/services/ai/crypto";
import {
	autoZonesForFields,
	blankPages,
} from "@StryveForms/api/services/pdf/model";
import { createStorage } from "@StryveForms/api/services/storage";
import { structureFromForm } from "@StryveForms/api/services/templates";
import { createDb } from "@StryveForms/db";
import { user as userTable } from "@StryveForms/db/schema/auth";
import {
	aiChat as aiChatTable,
	aiCredential as aiCredentialTable,
	pdfTemplate as pdfTemplateTable,
} from "@StryveForms/db/schema/features";
import {
	folder as folderTable,
	formIntegration as formIntegrationTable,
	formSubmission as formSubmissionTable,
	form as formTable,
	formView as formViewTable,
	template as templateTable,
	workspaceMember as workspaceMemberTable,
	workspace as workspaceTable,
} from "@StryveForms/db/schema/forms";
import type { FormField } from "@StryveForms/forms/types";
import { eq } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/*                                   Setup                                    */
/* -------------------------------------------------------------------------- */

const {
	DATABASE_URL,
	BETTER_AUTH_SECRET: AUTH_SECRET,
	STORAGE_DRIVER,
	STORAGE_PATH,
} = process.env;
if (!DATABASE_URL) {
	throw new Error("DATABASE_URL is not set — run this from apps/server");
}
const BETTER_AUTH_SECRET = AUTH_SECRET ?? "";
const APP_URL = (process.env.APP_URL ?? "http://localhost:3002").replace(
	/\/$/,
	""
);
// Same resolution apps/server/src/services.ts uses for file links.
const SERVER_URL = (process.env.BETTER_AUTH_URL ?? APP_URL).replace(/\/$/, "");

const db = createDb({ DATABASE_URL });
const storage = createStorage({
	STORAGE_DRIVER: (STORAGE_DRIVER ?? "local") as "local" | "s3",
	STORAGE_PATH: STORAGE_PATH ?? "./storage",
});

const TESTER_EMAIL = "tester@example.com";
const WORKSPACE_NAME = "Acme Studio";
const BRAND_COLOR = "#F97316"; // warm orange — distinct from the instance's default purple

function assetUrl(fileName: string): string {
	return `${SERVER_URL}/api/assets/${encodeURIComponent(fileName)}`;
}

function daysAgo(days: number, hour = 10, minute = 0): Date {
	const d = new Date();
	d.setDate(d.getDate() - days);
	d.setHours(hour, minute, Math.floor(Math.random() * 60), 0);
	return d;
}

function pick<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

function maybe(probability: number): boolean {
	return Math.random() < probability;
}

/* -------------------------------------------------------------------------- */
/*                         Generated SVG brand assets                         */
/* -------------------------------------------------------------------------- */

/** A simple, dependency-free "AS" monogram logo, light and dark variants. */
function logoSvg(textColor: string, bgColor: string | null): string {
	const bg = bgColor
		? `<rect width="160" height="160" rx="32" fill="${bgColor}"/>`
		: "";
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
${bg}<text x="80" y="104" font-family="Arial, sans-serif" font-size="72" font-weight="700" text-anchor="middle" fill="${textColor}">AS</text>
</svg>`;
}

/** A plain banner used behind focused-mode "split"/"wallpaper" image layouts. */
function bannerSvg(hex: string, label: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${hex}"/><stop offset="1" stop-color="#1f2937"/>
</linearGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/>
<text x="60" y="920" font-family="Arial, sans-serif" font-size="40" font-weight="700" fill="white">${label}</text>
</svg>`;
}

/** A small flat icon used for select-option images. */
function iconSvg(hex: string, glyph: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
<rect width="120" height="120" rx="20" fill="${hex}"/>
<text x="60" y="78" font-family="Arial, sans-serif" font-size="56" text-anchor="middle" fill="white">${glyph}</text>
</svg>`;
}

async function putAsset(name: string, svg: string): Promise<string> {
	await storage.put(`assets/${name}`, svg, "image/svg+xml");
	return assetUrl(name);
}

/* -------------------------------------------------------------------------- */
/*                              Idempotent reset                              */
/* -------------------------------------------------------------------------- */

async function findTester() {
	const [row] = await db
		.select()
		.from(userTable)
		.where(eq(userTable.email, TESTER_EMAIL));
	if (!row) {
		throw new Error(
			`No user with email ${TESTER_EMAIL} — log in once with the test account before seeding`
		);
	}
	return row;
}

async function resetDemoWorkspace(): Promise<void> {
	const existing = await db
		.select({ id: workspaceTable.id })
		.from(workspaceTable)
		.where(eq(workspaceTable.name, WORKSPACE_NAME));
	// Cascades to form, formSubmission, formView, formIntegration,
	// formIntegrationEvent, formVersion, pdfTemplate, aiCredential, aiChat,
	// template, workspaceMember, workspaceInvite, storedFile.
	await Promise.all(
		existing.map((row) =>
			db.delete(workspaceTable).where(eq(workspaceTable.id, row.id))
		)
	);
}

async function findOrCreateDemoUser(
	email: string,
	name: string
): Promise<string> {
	const [existing] = await db
		.select({ id: userTable.id })
		.from(userTable)
		.where(eq(userTable.email, email));
	if (existing) {
		return existing.id;
	}
	const id = newId();
	await db.insert(userTable).values({
		id,
		name,
		email,
		emailVerified: false,
		isAdmin: false,
	});
	return id;
}

/* -------------------------------------------------------------------------- */
/*                                  Main seed                                  */
/* -------------------------------------------------------------------------- */

async function main() {
	console.log("Seeding demo workspace…");
	const tester = await findTester();
	await resetDemoWorkspace();

	const logoLight = await putAsset(
		"acme-logo-light.svg",
		logoSvg("#F97316", "#111827")
	);
	const logoDark = await putAsset(
		"acme-logo-dark.svg",
		logoSvg("#FB923C", "#1f2937")
	);
	const eventBanner = await putAsset(
		"acme-event-banner.svg",
		bannerSvg("#F97316", "Spring Product Summit")
	);
	const feedbackBanner = await putAsset(
		"acme-feedback-wallpaper.svg",
		bannerSvg("#0EA5E9", "Tell us what you think")
	);
	const iconGeneral = await putAsset(
		"icon-ticket-general.svg",
		iconSvg("#6366F1", "🎫")
	);
	const iconVip = await putAsset(
		"icon-ticket-vip.svg",
		iconSvg("#D946EF", "⭐")
	);
	const iconStudent = await putAsset(
		"icon-ticket-student.svg",
		iconSvg("#22C55E", "🎓")
	);
	const iconStandard = await putAsset(
		"icon-room-standard.svg",
		iconSvg("#64748B", "🛏️")
	);
	const iconDeluxe = await putAsset(
		"icon-room-deluxe.svg",
		iconSvg("#D97706", "🛎️")
	);
	const iconSuite = await putAsset(
		"icon-room-suite.svg",
		iconSvg("#7C3AED", "👑")
	);
	const iconApp = await putAsset(
		"icon-product-app.svg",
		iconSvg("#0EA5E9", "📱")
	);
	const iconWeb = await putAsset(
		"icon-product-web.svg",
		iconSvg("#F97316", "🌐")
	);
	const iconDesktop = await putAsset(
		"icon-product-desktop.svg",
		iconSvg("#334155", "🖥️")
	);

	const workspaceId = newId();
	await db.insert(workspaceTable).values({
		id: workspaceId,
		name: WORKSPACE_NAME,
		icon: "🧪",
		settings: {
			senders: [
				{
					id: "support",
					name: "Acme Studio Support",
					address: "support@acmestudio.example",
					replyTo: "support@acmestudio.example",
				},
				{
					id: "hiring",
					name: "Acme Studio Hiring",
					address: "hiring@acmestudio.example",
				},
			],
			defaultSenderId: "support",
		},
		brand: {
			color: BRAND_COLOR,
			fontFamily: null,
			theme: "default",
			borderRadius: "small",
			size: "md",
			darkMode: "auto",
			uppercaseLabels: false,
			logoPicture: logoLight,
			logoPictureDark: logoDark,
			width: "centered",
			layout: "framed",
			noBranding: false,
		},
	});
	await db.insert(workspaceMemberTable).values({
		workspaceId,
		userId: tester.id,
		role: "admin",
	});

	// Extra demo members with obviously fake emails, at different roles.
	const mayaId = await findOrCreateDemoUser("maya@acme.example", "Maya Chen");
	const raviId = await findOrCreateDemoUser("ravi@acme.example", "Ravi Shah");
	await db.insert(workspaceMemberTable).values([
		{ workspaceId, userId: mayaId, role: "user" },
		{ workspaceId, userId: raviId, role: "readonly" },
	]);

	// A fake, encrypted AI credential — never the user's real key — just so
	// the assistant/AI settings screens show the "connected" state.
	await db.insert(aiCredentialTable).values({
		id: newId(),
		workspaceId,
		provider: "openai",
		model: "gpt-4o-mini",
		encryptedKey: encryptApiKey(
			BETTER_AUTH_SECRET,
			"sk-demo-not-a-real-key-000000"
		),
		createdBy: tester.id,
	});

	// Folders.
	const supportFolder = newId();
	const eventsFolder = newId();
	const hiringFolder = newId();
	await db.insert(folderTable).values([
		{
			id: supportFolder,
			workspaceId,
			kind: "form",
			name: "Support",
			color: "#0EA5E9",
			icon: "💬",
			position: 1,
		},
		{
			id: eventsFolder,
			workspaceId,
			kind: "form",
			name: "Events",
			color: "#7C3AED",
			icon: "🎫",
			position: 2,
		},
		{
			id: hiringFolder,
			workspaceId,
			kind: "form",
			name: "Hiring",
			color: "#2563EB",
			icon: "💼",
			position: 3,
		},
	]);

	/* ------------------------------------------------------------------ */
	/*                               Form 1                                */
	/* ------------------------------------------------------------------ */

	const contactFields: FormField[] = [
		{
			id: "full_name",
			name: "Full name",
			type: "text",
			required: true,
			width: "1/2",
			placeholder: "Jane Cooper",
		},
		{
			id: "email",
			name: "Email",
			type: "email",
			required: true,
			width: "1/2",
			placeholder: "name@example.com",
		},
		{
			id: "topic",
			name: "What's this about?",
			type: "select",
			required: true,
			width: "full",
			help: "Pick whichever is closest — you can always add more detail below.",
			select: {
				options: [
					{ id: "General question", name: "General question" },
					{ id: "Billing", name: "Billing" },
					{ id: "Partnership", name: "Partnership" },
					{ id: "Bug report", name: "Bug report" },
				],
			},
		},
		{
			id: "company_name",
			name: "Company name",
			type: "text",
			width: "1/2",
			hidden: true,
			help: "Only shown for partnership enquiries.",
			logic: {
				actions: ["show-block"],
				conditions: {
					value: {
						operator: "equals",
						property_meta: { id: "topic", type: "select" },
						value: "Partnership",
					},
				},
			},
		},
		{
			id: "message",
			name: "Message",
			type: "text",
			multi_lines: true,
			required: true,
			width: "full",
			max_char_limit: 2000,
			help: "The more detail you give us, the faster we can help — feel free to paste in error messages, order numbers, or links.",
		},
		{
			id: "newsletter",
			name: "Keep me posted on product news",
			type: "checkbox",
			width: "full",
		},
		{
			id: "lead_source",
			name: "Lead source",
			type: "text",
			hidden: true,
			prefill: "website",
		},
	];

	/* ------------------------------------------------------------------ */
	/*                               Form 2                                */
	/* ------------------------------------------------------------------ */

	const eventFields: FormField[] = [
		{
			id: "attendee_name",
			name: "Full name",
			type: "text",
			required: true,
			width: "full",
			image: { url: eventBanner, layout: "split-left" },
		},
		{
			id: "email",
			name: "Email",
			type: "email",
			required: true,
			width: "full",
		},
		{
			id: "ticket_type",
			name: "Ticket type",
			type: "select",
			required: true,
			width: "full",
			option_display_mode: "text_and_image",
			help: "Not sure which ticket? <strong>VIP</strong> includes backstage access and a swag bag.",
			select: {
				options: [
					{ id: "General", name: "General", image: iconGeneral },
					{ id: "VIP", name: "VIP", image: iconVip },
					{ id: "Student", name: "Student", image: iconStudent },
				],
			},
		},
		{ id: "page_1", name: "Page break", type: "nf-page-break" },
		{
			id: "sessions",
			name: "Which sessions are you interested in?",
			type: "multi_select",
			width: "full",
			multi_select: {
				options: [
					{ id: "Workshops", name: "Workshops" },
					{ id: "Networking", name: "Networking" },
					{ id: "Keynote", name: "Keynote" },
				],
			},
		},
		{
			id: "arrival_date",
			name: "Arrival date",
			type: "date",
			width: "1/2",
		},
		{
			id: "has_dietary",
			name: "I have dietary restrictions",
			type: "checkbox",
			width: "1/2",
		},
		{
			id: "dietary_details",
			name: "Tell us more",
			type: "text",
			hidden: true,
			width: "full",
			logic: {
				actions: ["show-block"],
				conditions: {
					value: {
						operator: "is_checked",
						property_meta: { id: "has_dietary", type: "checkbox" },
					},
				},
			},
		},
	];

	/* ------------------------------------------------------------------ */
	/*                               Form 3                                */
	/* ------------------------------------------------------------------ */

	const npsFields: FormField[] = [
		{
			id: "nps_score",
			name: "How likely are you to recommend us to a friend or colleague?",
			type: "scale",
			required: true,
			width: "full",
			scale_min_value: 0,
			scale_max_value: 10,
			scale_step_value: 1,
			help: "0 = not at all likely, 10 = extremely likely.",
		},
		{
			id: "reason",
			name: "What's the main reason for your score?",
			type: "text",
			multi_lines: true,
			width: "full",
		},
		{
			id: "detractor_followup",
			name: "What would it take to earn a higher score from you?",
			type: "text",
			multi_lines: true,
			width: "full",
			hidden: true,
			logic: {
				actions: ["show-block"],
				conditions: {
					value: {
						operator: "less_than_or_equal_to",
						property_meta: { id: "nps_score", type: "scale" },
						value: 6,
					},
				},
			},
		},
		{
			id: "contact_email",
			name: "Email (optional, if you'd like us to follow up)",
			type: "email",
			width: "full",
		},
	];

	/* ------------------------------------------------------------------ */
	/*                               Form 4                                */
	/* ------------------------------------------------------------------ */

	const jobFields: FormField[] = [
		{
			id: "applicant_name",
			name: "Full name",
			type: "text",
			required: true,
			width: "1/2",
		},
		{ id: "email", name: "Email", type: "email", required: true, width: "1/2" },
		{ id: "phone_number", name: "Phone", type: "phone_number", width: "1/2" },
		{
			id: "position",
			name: "Position",
			type: "select",
			required: true,
			width: "1/2",
			select: {
				options: [
					{ id: "Engineering", name: "Engineering" },
					{ id: "Design", name: "Design" },
					{ id: "Sales", name: "Sales" },
					{ id: "Support", name: "Support" },
				],
			},
		},
		{
			id: "resume",
			name: "Resume",
			type: "files",
			required: true,
			width: "full",
			help: "PDF or Word document, up to 10MB.",
		},
		{
			id: "cover_letter",
			name: "Why are you a good fit?",
			type: "text",
			multi_lines: true,
			width: "full",
			help: "About 200 words is plenty — tell us what draws you to this role.",
		},
		{ id: "page_1", name: "Page break", type: "nf-page-break" },
		{
			id: "work_auth",
			name: "I'm authorized to work in this location",
			type: "checkbox",
			width: "full",
		},
		{
			id: "needs_sponsorship",
			name: "Would you need visa sponsorship?",
			type: "checkbox",
			width: "full",
			hidden: true,
			logic: {
				actions: ["show-block"],
				conditions: {
					value: {
						operator: "is_not_checked",
						property_meta: { id: "work_auth", type: "checkbox" },
					},
				},
			},
		},
		{
			id: "start_date",
			name: "Earliest start date",
			type: "date",
			width: "1/2",
		},
		{ id: "signature", name: "Signature", type: "signature", width: "full" },
	];

	/* ------------------------------------------------------------------ */
	/*                               Form 5                                */
	/* ------------------------------------------------------------------ */

	const bookingFields: FormField[] = [
		{
			id: "full_name",
			name: "Full name",
			type: "text",
			required: true,
			width: "1/2",
		},
		{ id: "email", name: "Email", type: "email", required: true, width: "1/2" },
		{
			id: "check_in",
			name: "Check-in date",
			type: "date",
			required: true,
			width: "1/2",
			with_time: false,
		},
		{
			id: "nights",
			name: "Number of nights",
			type: "number",
			required: true,
			width: "1/2",
			placeholder: "e.g. 3",
		},
		{
			id: "room_type",
			name: "Room type",
			type: "select",
			required: true,
			width: "full",
			option_display_mode: "text_and_image",
			select: {
				options: [
					{
						id: "Standard",
						name: "Standard — $120/night",
						image: iconStandard,
					},
					{ id: "Deluxe", name: "Deluxe — $180/night", image: iconDeluxe },
					{ id: "Suite", name: "Suite — $260/night", image: iconSuite },
				],
			},
		},
		{
			id: "special_requests",
			name: "Special requests",
			type: "text",
			multi_lines: true,
			width: "full",
			help: "Late check-in, accessibility needs, a quiet room — let us know and we'll do our best.",
		},
		{
			id: "estimate",
			name: "Estimate",
			type: "nf-text",
			width: "full",
			content:
				'<p>Estimated total: <strong><span mention="true" mention-field-id="cv_total" mention-field-name="Estimated total">Estimated total</span></strong> (based on the Standard rate; the final price depends on the room type you pick).</p>',
		},
	];
	const bookingComputed = [
		{
			id: "cv_total",
			name: "Estimated total",
			formula: "nights * 120",
			result_type: "number" as const,
		},
	];

	/* ------------------------------------------------------------------ */
	/*                               Form 6                                */
	/* ------------------------------------------------------------------ */

	const feedbackFields: FormField[] = [
		{
			id: "product_used",
			name: "Which product do you use most?",
			type: "select",
			required: true,
			width: "full",
			option_display_mode: "text_and_image",
			image: { url: feedbackBanner, layout: "wallpaper" },
			select: {
				options: [
					{ id: "App", name: "Mobile app", image: iconApp },
					{ id: "Web", name: "Website", image: iconWeb },
					{ id: "Desktop", name: "Desktop app", image: iconDesktop },
				],
			},
		},
		{
			id: "satisfaction",
			name: "How satisfied are you overall?",
			type: "rating",
			required: true,
			width: "full",
			rating_max_value: 5,
		},
		{
			id: "liked_most",
			name: "What do you like most?",
			type: "text",
			multi_lines: true,
			width: "full",
			help: "Be as specific as you like — a feature, a workflow, anything that stood out.",
		},
		{
			id: "improvement_area",
			name: "Where should we improve first?",
			type: "multi_select",
			width: "full",
			multi_select: {
				options: [
					{ id: "Performance", name: "Performance" },
					{ id: "Design", name: "Design" },
					{ id: "Pricing", name: "Pricing" },
					{ id: "Support", name: "Support" },
				],
			},
		},
		{
			id: "would_recommend",
			name: "Would you recommend us to a friend?",
			type: "select",
			width: "full",
			select: {
				options: [
					{ id: "Yes", name: "Yes" },
					{ id: "No", name: "No" },
				],
			},
		},
	];

	interface Seeded {
		fields: FormField[];
		id: string;
		slug: string;
	}
	const forms: Seeded[] = [];

	async function createForm(opts: {
		title: string;
		fields: FormField[];
		folderId?: string;
		presentationStyle: "classic" | "focused";
		computedVariables?: unknown[];
		color?: string;
		settings?: Record<string, unknown>;
	}): Promise<Seeded> {
		const id = newId();
		const slug = `${opts.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "")}-${id.slice(0, 6).toLowerCase()}`;
		await db.insert(formTable).values({
			id,
			workspaceId,
			creatorId: tester.id,
			folderId: opts.folderId ?? null,
			title: opts.title,
			slug,
			visibility: "public",
			properties: opts.fields,
			computedVariables: opts.computedVariables ?? [],
			presentationStyle: opts.presentationStyle,
			useWorkspaceBrand: true,
			color: opts.color ?? BRAND_COLOR,
			showProgressBar: opts.presentationStyle === "focused",
			confettiOnSubmission: true,
			settings: opts.settings ?? {},
		});
		const seeded = { id, fields: opts.fields, slug };
		forms.push(seeded);
		return seeded;
	}

	const contactUs = await createForm({
		title: "Contact Us",
		fields: contactFields,
		folderId: supportFolder,
		presentationStyle: "classic",
	});
	const eventRegistration = await createForm({
		title: "Event Registration",
		fields: eventFields,
		folderId: eventsFolder,
		presentationStyle: "focused",
	});
	const npsSurvey = await createForm({
		title: "Customer NPS Survey",
		fields: npsFields,
		presentationStyle: "focused",
	});
	const jobApplication = await createForm({
		title: "Job Application",
		fields: jobFields,
		folderId: hiringFolder,
		presentationStyle: "classic",
	});
	const bookingRequest = await createForm({
		title: "Booking Request",
		fields: bookingFields,
		folderId: eventsFolder,
		presentationStyle: "classic",
		computedVariables: bookingComputed,
	});
	const productFeedback = await createForm({
		title: "Product Feedback",
		fields: feedbackFields,
		folderId: supportFolder,
		presentationStyle: "focused",
	});

	/* ------------------------------------------------------------------ */
	/*                         PDF template (Job Application)             */
	/* ------------------------------------------------------------------ */

	const pdfId = newId();
	const { zones, pageCount } = autoZonesForFields(jobFields);
	await db.insert(pdfTemplateTable).values({
		id: pdfId,
		formId: jobApplication.id,
		name: "Application summary",
		filenamePattern: "{form_title}-{submission_id}",
		pages: blankPages(pageCount, "A4", "portrait"),
		zones,
		settings: { attachToEmail: true },
		enabled: true,
		creatorId: tester.id,
	});

	/* ------------------------------------------------------------------ */
	/*                               Integrations                          */
	/* ------------------------------------------------------------------ */

	async function addIntegration(
		formId: string,
		integrationId: string,
		data: Record<string, unknown>,
		settings: Record<string, unknown> = {}
	) {
		await db.insert(formIntegrationTable).values({
			id: newId(),
			formId,
			integrationId,
			status: "active",
			data,
			settings,
		});
	}

	// Contact Us: team notification, respondent confirmation, and a webhook.
	await addIntegration(contactUs.id, "email", {
		send_to: "support@acmestudio.example",
		subject: "New contact form submission",
		senderId: "support",
		include_submission_data: true,
	});
	await addIntegration(contactUs.id, "email", {
		send_to:
			'<span mention="true" mention-field-id="email" mention-field-name="Email">Email</span>',
		subject: "We got your message",
		senderId: "support",
		email_content:
			"<p>Thanks for reaching out — we'll reply within one business day.</p>",
		include_submission_data: false,
	});
	await addIntegration(contactUs.id, "webhook", {
		webhook_url: "https://example.com/hook",
	});

	// Event Registration: ops notification with the PDF-style confirmation (no
	// real template attached here — resume PDF lives on Job Application —
	// but the confirmation email itself still demonstrates the respondent
	// mention pattern).
	await addIntegration(eventRegistration.id, "email", {
		send_to: "events@acmestudio.example",
		subject: "New event registration",
		senderId: "support",
	});
	await addIntegration(eventRegistration.id, "email", {
		send_to:
			'<span mention="true" mention-field-id="email" mention-field-name="Email">Email</span>',
		subject: "You're registered!",
		senderId: "support",
		email_content:
			"<p>See you at the Spring Product Summit — your ticket is confirmed.</p>",
	});

	// NPS Survey: webhook only (e.g. piping scores into another tool).
	await addIntegration(npsSurvey.id, "webhook", {
		webhook_url: "https://example.com/hook",
	});

	// Job Application: hiring team notification with the PDF summary attached.
	await addIntegration(
		jobApplication.id,
		"email",
		{
			send_to: "hiring@acmestudio.example",
			subject: "New application",
			senderId: "hiring",
			attach_pdf_template_id: pdfId,
		},
		{}
	);

	// Booking Request: bookings notification.
	await addIntegration(bookingRequest.id, "email", {
		send_to: "bookings@acmestudio.example",
		subject: "New booking request",
		senderId: "support",
	});

	/* ------------------------------------------------------------------ */
	/*                         Saved workspace templates                   */
	/* ------------------------------------------------------------------ */

	async function saveAsTemplate(
		seeded: Seeded,
		name: string,
		description: string
	) {
		const [row] = await db
			.select()
			.from(formTable)
			.where(eq(formTable.id, seeded.id));
		if (!row) {
			return;
		}
		const dto = toFormDto(row, {
			appName: "StryveForms",
			appUrl: APP_URL,
			captcha: {},
			importRateLimitPerMinute: 60,
			serverUrl: SERVER_URL,
			signingSecret: BETTER_AUTH_SECRET,
		});
		const structure = structureFromForm(dto);
		await db.insert(templateTable).values({
			id: newId(),
			workspaceId,
			category: "Custom",
			slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${newId().slice(0, 6).toLowerCase()}`,
			name,
			shortDescription: description,
			description,
			structure: structure as Record<string, unknown>,
			creatorId: tester.id,
		});
	}
	await saveAsTemplate(
		eventRegistration,
		"Event registration starter",
		"A ticketed signup with sessions and dietary notes — duplicate this for the next event."
	);
	await saveAsTemplate(
		npsSurvey,
		"Customer NPS starter",
		"A single-question NPS survey with a smart follow-up for low scores."
	);

	/* ------------------------------------------------------------------ */
	/*                           Submissions & views                       */
	/* ------------------------------------------------------------------ */

	const SOURCES = ["Direct", "Google", "Twitter", "Referral", "Email"];
	const COUNTRIES = ["US", "GB", "DE", "FR", "IN", "BR", "CA"];

	function randomValueFor(field: FormField): unknown {
		switch (field.type) {
			case "text":
				if (
					field.id === "full_name" ||
					field.id === "attendee_name" ||
					field.id === "applicant_name"
				) {
					return pick([
						"Jane Cooper",
						"Alex Rivera",
						"Priya Patel",
						"Liam O'Connor",
						"Sofia Rossi",
						"Noah Kim",
						"Grace Okafor",
						"Lucas Müller",
						"Mia Tanaka",
						"Ethan Brooks",
					]);
				}
				if (
					field.id === "message" ||
					field.id === "cover_letter" ||
					field.id === "liked_most" ||
					field.id === "reason" ||
					field.id === "special_requests"
				) {
					return pick([
						"Really happy with how easy this was to use.",
						"Had a small issue with the mobile layout but support sorted it fast.",
						"Would love to see more customization options.",
						"Everything worked exactly as expected, thank you!",
						"The onboarding could be a bit clearer, otherwise great.",
					]);
				}
				return "Sample answer";
			case "email":
				return pick([
					"jane@example.com",
					"alex@example.com",
					"priya@example.com",
					"liam@example.com",
					"sofia@example.com",
				]);
			case "phone_number":
				return "+1 202 555 0142";
			case "select":
				return pick((field.select?.options ?? []).map((o) => o.id));
			case "multi_select": {
				const options = (field.multi_select?.options ?? []).map((o) => o.id);
				return options.filter(() => maybe(0.5)).slice(0, 2);
			}
			case "checkbox":
				return maybe(0.4);
			case "rating":
				return 1 + Math.floor(Math.random() * (field.rating_max_value ?? 5));
			case "scale":
				return (
					(field.scale_min_value ?? 0) +
					Math.floor(
						Math.random() *
							((field.scale_max_value ?? 10) - (field.scale_min_value ?? 0) + 1)
					)
				);
			case "number":
				return 1 + Math.floor(Math.random() * 6);
			case "date":
				return daysAgo(Math.floor(Math.random() * 60))
					.toISOString()
					.slice(0, 10);
			case "files":
				return [];
			case "signature":
				return null;
			default:
				return null;
		}
	}

	/** Builds one submission's answers, skipping some hidden/optional fields for realism. */
	function randomSubmissionData(
		inputFields: FormField[]
	): Record<string, unknown> {
		const data: Record<string, unknown> = {};
		for (const field of inputFields) {
			if (field.hidden && !maybe(0.3)) {
				continue;
			}
			if (maybe(0.08) && !field.required) {
				continue; // some optional fields left blank, for realism
			}
			data[field.id] = randomValueFor(field);
		}
		return data;
	}

	function randomSubmissionRow(
		seeded: Seeded,
		inputFields: FormField[]
	): typeof formSubmissionTable.$inferInsert {
		const createdAt = daysAgo(Math.floor(Math.random() ** 1.5 * 60));
		return {
			id: newId(),
			formId: seeded.id,
			publicId: crypto.randomUUID(),
			data: randomSubmissionData(inputFields),
			status: maybe(0.92) ? "completed" : "partial",
			completionTime: 20 + Math.floor(Math.random() * 180),
			meta: { source: pick(SOURCES), country: pick(COUNTRIES) },
			createdAt,
			updatedAt: createdAt,
		};
	}

	async function seedSubmissionsFor(
		seeded: Seeded,
		count: number,
		views: number
	) {
		const inputFields = seeded.fields.filter(
			(f) => !f.type.startsWith("nf-") && f.type !== "signature"
		);
		const subs = Array.from({ length: count }, () =>
			randomSubmissionRow(seeded, inputFields)
		);
		if (subs.length > 0) {
			await db.insert(formSubmissionTable).values(subs);
		}

		const viewRows: (typeof formViewTable.$inferInsert)[] = Array.from(
			{ length: views },
			() => ({
				formId: seeded.id,
				meta: { source: pick(SOURCES), country: pick(COUNTRIES) },
				createdAt: daysAgo(Math.floor(Math.random() ** 1.5 * 60)),
			})
		);
		if (viewRows.length > 0) {
			await db.insert(formViewTable).values(viewRows);
		}
	}

	await seedSubmissionsFor(contactUs, 62, 180);
	await seedSubmissionsFor(eventRegistration, 78, 220);
	await seedSubmissionsFor(npsSurvey, 54, 140);
	await seedSubmissionsFor(jobApplication, 37, 160);
	await seedSubmissionsFor(bookingRequest, 45, 120);
	await seedSubmissionsFor(productFeedback, 70, 200);

	/* ------------------------------------------------------------------ */
	/*                          AI chat transcripts                        */
	/* ------------------------------------------------------------------ */

	function textMessage(role: "user" | "assistant", content: string) {
		return { id: newId(), role, parts: [{ type: "text", content }] };
	}

	await db.insert(aiChatTable).values([
		{
			id: newId(),
			workspaceId,
			userId: tester.id,
			formId: contactUs.id,
			title: "Add a priority field",
			messages: [
				textMessage(
					"user",
					"Can you add a dropdown for ticket priority to the Contact Us form, with Low/Medium/High options?"
				),
				textMessage(
					"assistant",
					"Done — I added a **Priority** dropdown with Low, Medium and High, placed right after the topic field. Want me to make it required, or trigger an email alert when someone picks High?"
				),
				textMessage("user", "Make it required please."),
				textMessage(
					"assistant",
					"Done — Priority is now required, so the form won't submit until a value is picked."
				),
			],
		},
		{
			id: newId(),
			workspaceId,
			userId: tester.id,
			formId: npsSurvey.id,
			title: "Summarize last month's NPS",
			messages: [
				textMessage(
					"user",
					"How is the NPS survey trending over the last 30 days?"
				),
				textMessage(
					"assistant",
					'Over the last 30 days the Customer NPS Survey collected a healthy number of responses with a good mix of promoters and a handful of detractors who left follow-up comments. The most common theme in the "main reason" answers was appreciation for responsive support, with a few requests for more customization. Want me to draft a follow-up email for the detractors?'
				),
			],
		},
	]);

	/* ------------------------------------------------------------------ */
	/*                                 Done                                 */
	/* ------------------------------------------------------------------ */

	// Written for the screenshot script, so it never has to re-derive ids by
	// querying the API — it just reads this file.
	const manifest = {
		workspaceId,
		workspaceName: WORKSPACE_NAME,
		testerEmail: TESTER_EMAIL,
		forms: {
			contactUs: { id: contactUs.id, slug: contactUs.slug },
			eventRegistration: {
				id: eventRegistration.id,
				slug: eventRegistration.slug,
			},
			npsSurvey: { id: npsSurvey.id, slug: npsSurvey.slug },
			jobApplication: { id: jobApplication.id, slug: jobApplication.slug },
			bookingRequest: { id: bookingRequest.id, slug: bookingRequest.slug },
			productFeedback: { id: productFeedback.id, slug: productFeedback.slug },
		},
		pdfTemplateId: pdfId,
		members: {
			maya: { email: "maya@acme.example", role: "user" },
			ravi: { email: "ravi@acme.example", role: "readonly" },
		},
	};
	await Bun.write(
		new URL("../../../../scripts/demo/manifest.json", import.meta.url),
		`${JSON.stringify(manifest, null, 2)}\n`
	);

	console.log("Seeded workspace:", WORKSPACE_NAME, workspaceId);
	console.log("Forms:", forms.map((f) => `${f.slug} (${f.id})`).join(", "));
	console.log(
		"Members added: maya@acme.example (user), ravi@acme.example (readonly)"
	);
	console.log("Wrote scripts/demo/manifest.json for the screenshot script.");
	console.log(
		"Done. The demo workspace is additive — your own workspaces are untouched."
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => {
		process.exit(process.exitCode ?? 0);
	});
