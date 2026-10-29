/** @jsxImportSource react */
import { type EmailBranding, EmailLayout } from "../components/layout";
import { EmailHeading, Paragraph } from "../components/primitives";
import { useEmailTheme } from "../components/theme";

export interface TwoFactorOtpProps {
	branding?: EmailBranding;
	/** The 6-digit one-time code (OTP fallback for people without an authenticator app). */
	code: string;
	name?: string | null;
}

/** Shows the code as large, spaced-out, monospace digits so it's easy to read and re-type. */
function CodeDisplay({ code }: { code: string }) {
	const theme = useEmailTheme();
	return (
		<table
			cellPadding={0}
			cellSpacing={0}
			role="presentation"
			style={{ margin: "8px 0 20px", width: "100%" }}
		>
			<tbody>
				<tr>
					<td
						style={{
							background: theme.contentBackgroundColor,
							borderRadius: theme.cardRadius,
							color: theme.headingColor,
							fontFamily: "ui-monospace, Menlo, Consolas, monospace",
							fontSize: "28px",
							fontWeight: 600,
							letterSpacing: "8px",
							padding: "16px 20px",
							textAlign: "center",
						}}
					>
						{code}
					</td>
				</tr>
			</tbody>
		</table>
	);
}

/** One-time sign-in code for the two-factor "OTP" method (an alternative to an authenticator app). */
export function TwoFactorOtpEmail({ branding, code, name }: TwoFactorOtpProps) {
	return (
		<EmailLayout branding={branding} preview={`Your sign-in code: ${code}`}>
			<EmailHeading>Your sign-in code</EmailHeading>
			<Paragraph>Hello{name ? ` ${name}` : ""},</Paragraph>
			<Paragraph>
				Enter this code to finish signing in. It expires in a few minutes.
			</Paragraph>
			<CodeDisplay code={code} />
			<Paragraph>
				If you didn’t try to sign in, you can ignore this email — your password
				alone isn’t enough to get in without this code.
			</Paragraph>
		</EmailLayout>
	);
}

TwoFactorOtpEmail.PreviewProps = {
	code: "123456",
	name: "Ada",
} satisfies TwoFactorOtpProps;

export default TwoFactorOtpEmail;
