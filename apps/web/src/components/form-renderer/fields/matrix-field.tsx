import {
	RadioGroup,
	RadioGroupItem,
} from "@StryveForms/ui/components/radio-group";
import type { FieldComponentProps } from "../types";

/** Rows × columns radio grid, stored as `{ row: column }`. */
export function MatrixField({
	disabled,
	error,
	field,
	id,
	onChange,
	value,
}: FieldComponentProps) {
	const rows = field.rows ?? [];
	const columns = field.columns ?? [];
	const answers =
		typeof value === "object" && value !== null
			? (value as Record<string, unknown>)
			: {};

	function setCell(row: string, column: string | number) {
		onChange({ ...answers, [row]: column });
	}

	return (
		<div aria-invalid={Boolean(error)} className="overflow-x-auto" id={id}>
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr>
						<th className="p-2 text-left font-normal" />
						{columns.map((column) => (
							<th className="p-2 text-center font-medium" key={String(column)}>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row}>
							<td className="p-2 font-medium">{row}</td>
							{columns.map((column) => (
								<td className="p-2 text-center" key={String(column)}>
									<RadioGroup
										className="contents"
										disabled={disabled}
										name={`${id}-${row}`}
										onValueChange={() => setCell(row, column)}
										value={String(answers[row] ?? "")}
									>
										<RadioGroupItem
											aria-label={`${row} – ${column}`}
											className="mx-auto"
											value={String(column)}
										/>
									</RadioGroup>
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
