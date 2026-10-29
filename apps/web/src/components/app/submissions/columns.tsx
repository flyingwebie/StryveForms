import type { SubmissionDto } from "@StryveForms/api/routers/submission";
import type { FormField } from "@StryveForms/forms/types";
import { Checkbox } from "@StryveForms/ui/components/checkbox";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { useMemo } from "react";

import CellValue from "./cell-value";
import SubmissionStatusBadge from "./submission-status-badge";

/** The row-checkbox column. Underscores keep it from clashing with a field whose id is "select". */
export const SELECT_COLUMN_ID = "__select";

export function useSubmissionColumns(
	fields: FormField[]
): ColumnDef<SubmissionDto>[] {
	return useMemo(
		() => [
			{
				enableHiding: false,
				enableSorting: false,
				header: ({ table }) => (
					<Checkbox
						checked={table.getIsAllPageRowsSelected()}
						indeterminate={table.getIsSomePageRowsSelected()}
						onCheckedChange={(value) =>
							table.toggleAllPageRowsSelected(value === true)
						}
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(value === true)}
					/>
				),
				id: SELECT_COLUMN_ID,
			},
			{
				accessorKey: "createdAt",
				cell: ({ row }) =>
					format(new Date(row.original.createdAt), "MMM d, h:mm a"),
				header: "Submitted",
				id: "createdAt",
			},
			{
				accessorKey: "status",
				cell: ({ row }) => (
					<SubmissionStatusBadge status={row.original.status} />
				),
				header: "Status",
				id: "status",
			},
			...fields.map<ColumnDef<SubmissionDto>>((field) => ({
				accessorFn: (row) => row.data[field.id],
				cell: ({ row }) => (
					<CellValue field={field} value={row.original.data[field.id]} />
				),
				header: field.name,
				id: field.id,
			})),
		],
		[fields]
	);
}
