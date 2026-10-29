import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { AlertTriangleIcon, KeyRoundIcon } from "lucide-react";
import { useState } from "react";

/**
 * Step 3 of the "StryveForms file" import, shown only when the archive's
 * manifest says it includes secrets. A wrong passphrase shows an inline
 * error and lets the person retry, or skip and import without secrets
 * (every integration that would have needed one comes in switched off and
 * flagged "Needs reconnecting" instead).
 */
export default function ArchivePassphraseStep({
	checking,
	error,
	onBack,
	onSkip,
	onSubmit,
}: {
	checking: boolean;
	error?: string | null;
	onBack: () => void;
	onSkip: () => void;
	onSubmit: (passphrase: string) => void;
}) {
	const [passphrase, setPassphrase] = useState("");

	return (
		<div className="mx-auto max-w-md space-y-6">
			<div>
				<h2 className="font-semibold text-lg">Enter the passphrase</h2>
				<p className="text-muted-foreground text-sm">
					This archive includes encrypted secrets (webhook signing keys, SMTP
					passwords, API tokens…). Enter the passphrase it was exported with to
					bring them in too.
				</p>
			</div>

			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					if (passphrase && !checking) {
						onSubmit(passphrase);
					}
				}}
			>
				<div className="space-y-2">
					<Label htmlFor="archive-passphrase">Passphrase</Label>
					<div className="relative">
						<KeyRoundIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							autoComplete="off"
							className="pl-9"
							id="archive-passphrase"
							onChange={(event) => setPassphrase(event.target.value)}
							type="password"
							value={passphrase}
						/>
					</div>
				</div>

				{error ? (
					<Alert variant="destructive">
						<AlertTriangleIcon />
						<AlertTitle>That passphrase didn't work</AlertTitle>
						<AlertDescription>{error} Try again, or skip.</AlertDescription>
					</Alert>
				) : null}

				<div className="flex items-center justify-between gap-3">
					<Button onClick={onBack} type="button" variant="outline">
						Back
					</Button>
					<div className="flex items-center gap-2">
						<Button onClick={onSkip} type="button" variant="ghost">
							Skip — import without secrets
						</Button>
						<Button disabled={!passphrase || checking} type="submit">
							{checking ? "Checking…" : "Continue"}
						</Button>
					</div>
				</div>
			</form>
		</div>
	);
}
