import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { LockIcon } from "lucide-react";
import { useState } from "react";
import type { FormDictionary } from "./i18n";

export interface PasswordGateProps {
	dict: FormDictionary;
	onSubmit: (password: string) => void;
	submitting: boolean;
	title: string;
	wrongPassword: boolean;
}

/** Shown instead of the form when `public.form` reports `passwordRequired`. */
export function PasswordGate({
	dict,
	onSubmit,
	submitting,
	title,
	wrongPassword,
}: PasswordGateProps) {
	const [password, setPassword] = useState("");

	return (
		<form
			className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-card p-8 text-center shadow-sm"
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit(password);
			}}
		>
			<div
				aria-hidden="true"
				className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"
			>
				<LockIcon className="size-5" />
			</div>
			<div className="flex flex-col gap-1">
				<h1 className="font-semibold text-lg">{title}</h1>
				<p className="text-muted-foreground text-sm">
					Enter the password shared with you to continue.
				</p>
			</div>
			<div className="flex w-full flex-col gap-1.5 text-left">
				<Label className="sr-only" htmlFor="form-password">
					Password
				</Label>
				<Input
					autoFocus
					id="form-password"
					onChange={(e) => setPassword(e.target.value)}
					type="password"
					value={password}
				/>
				{wrongPassword ? (
					<p className="text-red-500 text-sm">{dict.wrongPassword}</p>
				) : null}
			</div>
			<Button
				className="w-full"
				disabled={submitting || !password}
				size="lg"
				type="submit"
			>
				{dict.submit}
			</Button>
		</form>
	);
}
