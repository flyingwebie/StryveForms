/** @jsxImportSource react */
import { Img, Link, Section, Text } from "@react-email/components";

import { type EmailBranding, EmailLayout } from "../components/layout";
import { ActionButton, RawHtml } from "../components/primitives";
import { useEmailTheme } from "../components/theme";

export interface EmailFieldFile {
	isImage: boolean;
	label: string;
	url: string;
}

export interface EmailField {
	files?: EmailFieldFile[];
	name: string;
	/** Already formatted for display. Arrays are joined with commas. */
	value: string | string[] | null;
	/** True when `value` is trusted, sanitised HTML (e.g. rich text answers). */
	valueIsHtml?: boolean;
}

export interface SubmissionNotificationProps {
	branding?: EmailBranding;
	/** Edit-submission button, shown when the form allows editing. */
	editButtonText?: string | null;
	editUrl?: string | null;
	/** Body HTML written by the form owner, with mentions already resolved and sanitised. */
	emailContentHtml: string;
	fields: EmailField[];
	includeSubmissionData: boolean;
	preview?: string;
}

const fieldStyle = {
	borderTop: "1px solid #d4d4d8",
	margin: "12px 0 0",
	paddingTop: "12px",
	whiteSpace: "pre-wrap" as const,
};

function FieldValue({ field }: { field: EmailField }) {
	const theme = useEmailTheme();
	if (field.files && field.files.length > 0) {
		return (
			<>
				{field.files.map((file) => (
					<Section key={file.url} style={{ marginTop: "8px" }}>
						{file.isImage ? (
							<Link href={file.url}>
								<Img
									alt={file.label}
									src={file.url}
									style={{
										borderRadius: "6px",
										height: "auto",
										maxWidth: "100%",
									}}
								/>
							</Link>
						) : null}
						<Link
							href={file.url}
							style={{ display: "inline-block", marginTop: "6px" }}
						>
							{file.isImage ? "🖼️" : "📎"} {file.label}
						</Link>
					</Section>
				))}
			</>
		);
	}
	if (field.valueIsHtml && typeof field.value === "string") {
		return <RawHtml html={field.value} />;
	}
	const text = Array.isArray(field.value)
		? field.value.join(", ")
		: (field.value ?? "");
	return (
		<Text
			className="sf-text"
			style={{ color: theme.textColor, fontSize: "14px", margin: "4px 0 0" }}
		>
			{text}
		</Text>
	);
}

/**
 * Used for both owner notifications and respondent confirmations
 * (the “email” integration in OpnForm).
 */
export function SubmissionNotificationEmail({
	branding,
	editButtonText,
	editUrl,
	emailContentHtml,
	fields,
	includeSubmissionData,
	preview,
}: SubmissionNotificationProps) {
	const visibleFields = fields.filter(
		(f) =>
			f.value !== null &&
			f.value !== "" &&
			!(Array.isArray(f.value) && f.value.length === 0)
	);
	return (
		<EmailLayout branding={branding} preview={preview}>
			<RawHtml html={emailContentHtml} />
			{editUrl ? (
				<ActionButton href={editUrl}>
					{editButtonText || "Edit submission"}
				</ActionButton>
			) : null}
			{includeSubmissionData
				? visibleFields.map((field) => (
						<FieldRow field={field} key={field.name} />
					))
				: null}
		</EmailLayout>
	);
}

function FieldRow({ field }: { field: EmailField }) {
	const theme = useEmailTheme();
	return (
		<Section className="sf-border-top" style={fieldStyle}>
			<Text
				className="sf-heading"
				style={{
					color: theme.headingColor,
					fontSize: "14px",
					fontWeight: 700,
					margin: 0,
				}}
			>
				{field.name}
			</Text>
			<FieldValue field={field} />
		</Section>
	);
}

SubmissionNotificationEmail.PreviewProps = {
	emailContentHtml:
		"<p>Hello there 👋</p><p>Your form <b>Contact us</b> has a new submission.</p>",
	fields: [
		{ name: "Name", value: "Ada Lovelace" },
		{ name: "Email", value: "ada@example.com" },
		{ name: "Topics", value: ["Pricing", "Support"] },
	],
	includeSubmissionData: true,
} satisfies SubmissionNotificationProps;

export default SubmissionNotificationEmail;
