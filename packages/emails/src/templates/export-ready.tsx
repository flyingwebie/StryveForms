/** @jsxImportSource react */
import { type EmailBranding, EmailLayout } from "../components/layout";
import {
	ActionButton,
	EmailHeading,
	Panel,
	Paragraph,
} from "../components/primitives";

export interface ExportReadyProps {
	branding?: EmailBranding;
	downloadUrl: string;
	/** Null when the export failed — `error` is then shown instead. */
	error?: string | null;
	/** When the download link stops working, e.g. "in 7 days". */
	expiresIn: string;
	sizeLabel: string;
	status: "completed" | "failed";
	workspaceName: string;
}

export function ExportReadyEmail({
	branding,
	downloadUrl,
	error,
	expiresIn,
	sizeLabel,
	status,
	workspaceName,
}: ExportReadyProps) {
	const ok = status === "completed";
	const title = ok
		? `Your export of "${workspaceName}" is ready`
		: `Your export of "${workspaceName}" failed`;
	return (
		<EmailLayout branding={branding} preview={title}>
			<EmailHeading>{title}</EmailHeading>
			{ok ? (
				<>
					<Paragraph>
						The file is {sizeLabel} and ready to download. The link expires{" "}
						{expiresIn}, so download it somewhere safe.
					</Paragraph>
					<ActionButton href={downloadUrl}>Download export</ActionButton>
				</>
			) : (
				<>
					<Paragraph>
						Something went wrong while putting this file together. You can try
						exporting again from Settings → Backup & export.
					</Paragraph>
					{error ? <Panel>{error}</Panel> : null}
				</>
			)}
		</EmailLayout>
	);
}

ExportReadyEmail.PreviewProps = {
	downloadUrl: "http://localhost:3001/api/backups/jobs/abc/download",
	expiresIn: "in 7 days",
	sizeLabel: "128 MB",
	status: "completed",
	workspaceName: "Acme Studio",
} satisfies ExportReadyProps;

export default ExportReadyEmail;
