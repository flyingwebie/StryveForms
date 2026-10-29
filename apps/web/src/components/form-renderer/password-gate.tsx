import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
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
			className="mx-auto flex max-w-sm flex-col gap-3 py-16"
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit(password);
			}}
		>
			<h1 className="text-center font-semibold text-lg">{title}</h1>
			<Label htmlFor="form-password">Password</Label>
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
			<Button disabled={submitting || !password} type="submit">
				{dict.submit}
			</Button>
		</form>
	);
}
