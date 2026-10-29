import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { AlertTriangleIcon, EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";
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
	const [showPassphrase, setShowPassphrase] = useState(false);

	return (
		<div className="mx-auto max-w-md space-y-6">
			<div>
				<h2 className="font-semibold text-lg">Enter the passphrase</h2>
				<p className="text-muted-foreground text-sm">
					This unlocks the encrypted secrets included in the backup, like
					integration API keys.
				</p>
			</div>

			<form
				className="space-y-4 rounded-2xl border bg-card p-6"
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
						<Input
							aria-invalid={Boolean(error) || undefined}
							autoComplete="off"
							className="pr-9"
							id="archive-passphrase"
							onChange={(event) => setPassphrase(event.target.value)}
							type={showPassphrase ? "text" : "password"}
							value={passphrase}
						/>
						<button
							aria-label={
								showPassphrase ? "Hide passphrase" : "Show passphrase"
							}
							className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							onClick={() => setShowPassphrase((v) => !v)}
							type="button"
						>
							{showPassphrase ? (
								<EyeOffIcon className="size-4" />
							) : (
								<EyeIcon className="size-4" />
							)}
						</button>
					</div>
					<p className="text-muted-foreground text-xs">
						Set when this backup was created.
					</p>
				</div>

				{error ? (
					<Alert variant="destructive">
						<AlertTriangleIcon />
						<AlertTitle>That passphrase didn't work</AlertTitle>
						<AlertDescription>{error} Try again, or skip.</AlertDescription>
					</Alert>
				) : null}

				<Button
					className="w-full"
					disabled={!passphrase || checking}
					type="submit"
				>
					<LockIcon />
					{checking ? "Checking…" : "Unlock and continue"}
				</Button>
			</form>

			<button
				className="text-left text-primary text-sm hover:underline"
				onClick={onSkip}
				type="button"
			>
				Skip — import without secrets
			</button>
			<p className="-mt-4 text-muted-foreground text-xs">
				You can add integration credentials manually after the import.
			</p>

			<Button onClick={onBack} variant="outline">
				← Back
			</Button>
		</div>
	);
}
