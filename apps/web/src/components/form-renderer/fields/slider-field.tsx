import { Slider } from "@StryveForms/ui/components/slider";
import type { FieldComponentProps } from "../types";

export function SliderField({
	disabled,
	field,
	id,
	onChange,
	value,
}: FieldComponentProps) {
	const min = field.slider_min_value ?? 0;
	const max = field.slider_max_value ?? 50;
	const step = field.slider_step_value ?? 1;
	const current = typeof value === "number" ? value : min;

	return (
		<div className="flex items-center gap-3">
			<Slider
				disabled={disabled}
				id={id}
				max={max}
				min={min}
				onValueChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
				step={step}
				value={[current]}
			/>
			<span className="w-10 shrink-0 text-right font-medium text-sm">
				{current}
			</span>
		</div>
	);
}
