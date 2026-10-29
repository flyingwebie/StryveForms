import type { FieldComponentProps } from "../types";

/** A row of numbered buttons from `scale_min_value` to `scale_max_value`. */
export function ScaleField({
	disabled,
	field,
	id,
	onChange,
	required,
	value,
}: FieldComponentProps) {
	const min = field.scale_min_value ?? 1;
	const max = field.scale_max_value ?? 5;
	const step = field.scale_step_value ?? 1;
	const current = typeof value === "number" ? value : null;
	const steps: number[] = [];
	for (let n = min; n <= max; n += step) {
		steps.push(n);
	}

	return (
		<div
			aria-required={required}
			className="flex flex-wrap gap-1.5"
			id={id}
			role="radiogroup"
		>
			{steps.map((n) => (
				<button
					aria-pressed={current === n}
					className={`flex size-9 items-center justify-center rounded-lg border font-medium text-sm transition-colors ${current === n ? "border-[var(--color-form)] bg-[var(--color-form)] text-white" : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-600 dark:hover:bg-neutral-800"}`}
					disabled={disabled}
					key={n}
					onClick={() => onChange(n)}
					type="button"
				>
					{n}
				</button>
			))}
		</div>
	);
}
