import type { FieldComponentProps } from "../types";

/** Payments aren't supported yet — read-only notice, matching the task's scope cut. */
export function PaymentField({ id }: FieldComponentProps) {
	return (
		<p
			className="rounded-lg border border-neutral-300 border-dashed px-4 py-3 text-neutral-500 text-sm dark:border-neutral-600"
			id={id}
		>
			Payments aren't supported yet.
		</p>
	);
}
