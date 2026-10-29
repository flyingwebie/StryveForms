import { Star } from "lucide-react";
import type { FieldComponentProps } from "../types";

export function RatingField({
	disabled,
	field,
	id,
	onChange,
	required,
	value,
}: FieldComponentProps) {
	const max = field.rating_max_value ?? 5;
	const current = typeof value === "number" ? value : 0;

	return (
		<div
			aria-required={required}
			className="flex gap-1"
			id={id}
			role="radiogroup"
		>
			{Array.from({ length: max }, (_, i) => i + 1).map((n) => (
				<button
					aria-label={`${n} star${n === 1 ? "" : "s"}`}
					aria-pressed={current >= n}
					className="rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-form)]"
					disabled={disabled}
					key={n}
					onClick={() => onChange(current === n ? 0 : n)}
					type="button"
				>
					<Star
						className={`size-6 ${current >= n ? "fill-[var(--color-form)] text-[var(--color-form)]" : "fill-none text-neutral-300 dark:text-neutral-600"}`}
					/>
				</button>
			))}
		</div>
	);
}
