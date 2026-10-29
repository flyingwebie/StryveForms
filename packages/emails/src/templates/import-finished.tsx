/** @jsxImportSource react */
import { type EmailBranding, EmailLayout } from "../components/layout";
import {
	ActionButton,
	EmailHeading,
	Panel,
	Paragraph,
} from "../components/primitives";

export interface ImportFinishedProps {
	branding?: EmailBranding;
	counts: {
		files: number;
		forms: number;
		integrations: number;
		submissions: number;
	};
	dashboardUrl: string;
	errors: string[];
	/** Where the data came from, e.g. "JotForm". */
	sourceName?: string;
	status: "completed" | "failed";
}

export function ImportFinishedEmail({
	branding,
	counts,
	dashboardUrl,
	errors,
	sourceName = "OpnForm",
	status,
}: ImportFinishedProps) {
	const ok = status === "completed";
	const title = ok
		? `Your ${sourceName} import is done`
		: `Your ${sourceName} import failed`;
	return (
		<EmailLayout branding={branding} preview={title}>
			<EmailHeading>{title}</EmailHeading>
			<Paragraph>
				Imported {counts.forms} forms, {counts.submissions} submissions,{" "}
				{counts.files} files and {counts.integrations} integrations.
			</Paragraph>
			{errors.length > 0 ? (
				<>
					<Paragraph>Some items need your attention:</Paragraph>
					<Panel>{errors.slice(0, 20).join("\n")}</Panel>
				</>
			) : null}
			<ActionButton href={dashboardUrl}>Open dashboard</ActionButton>
		</EmailLayout>
	);
}

ImportFinishedEmail.PreviewProps = {
	counts: { files: 12, forms: 3, integrations: 2, submissions: 418 },
	dashboardUrl: "http://localhost:3001/dashboard",
	errors: [],
	status: "completed",
} satisfies ImportFinishedProps;

export default ImportFinishedEmail;
