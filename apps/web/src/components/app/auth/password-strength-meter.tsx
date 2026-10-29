import { cn } from "@StryveForms/ui/lib/utils";

const SEGMENT_COUNT = 3;

const LOWERCASE_RE = /[a-z]/;
const UPPERCASE_RE = /[A-Z]/;
const DIGIT_RE = /\d/;
const SYMBOL_RE = /[^A-Za-z0-9]/;

interface Strength {
	barClassName: string;
	label: string;
	level: number;
	textClassName: string;
}

function varietyScore(password: string): number {
	const checks = [LOWERCASE_RE, UPPERCASE_RE, DIGIT_RE, SYMBOL_RE];
	return checks.filter((pattern) => pattern.test(password)).length;
}

function lengthScore(password: string): number {
	if (password.length >= 12) {
		return 2;
	}
	if (password.length >= 8) {
		return 1;
	}
	return 0;
}

function scorePassword(password: string): Strength {
	if (!password) {
		return {
			barClassName: "bg-border",
			label: "",
			level: 0,
			textClassName: "text-subtle-foreground",
		};
	}

	const bonus = varietyScore(password) >= 3 ? 1 : 0;
	const score = Math.min(
		SEGMENT_COUNT,
		Math.max(1, lengthScore(password) + bonus)
	);

	if (score <= 1) {
		return {
			barClassName: "bg-destructive",
			label: "Weak password",
			level: 1,
			textClassName: "text-destructive",
		};
	}
	if (score === 2) {
		return {
			barClassName: "bg-warning",
			label: "Fair password",
			level: 2,
			textClassName: "text-warning",
		};
	}
	return {
		barClassName: "bg-success",
		label: "Strong password",
		level: 3,
		textClassName: "text-success",
	};
}

const SEGMENT_KEYS = Array.from(
	{ length: SEGMENT_COUNT },
	(_, index) => `strength-segment-${index}`
);

/** Three-segment password strength bar, matching the create-account design. */
export default function PasswordStrengthMeter({
	password,
}: {
	password: string;
}) {
	if (!password) {
		return null;
	}

	const strength = scorePassword(password);

	return (
		<div className="space-y-1.5">
			<div className="flex gap-1">
				{SEGMENT_KEYS.map((key, index) => (
					<span
						className={cn(
							"h-1.5 flex-1 rounded-full bg-border transition-colors",
							index < strength.level && strength.barClassName
						)}
						key={key}
					/>
				))}
			</div>
			<p className={cn("text-xs", strength.textClassName)}>{strength.label}</p>
		</div>
	);
}
