import { Button } from "@StryveForms/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@StryveForms/ui/components/sheet";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@StryveForms/ui/components/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HistoryIcon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";
import { useEditor } from "../state/editor-context";

function formatDate(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

export function VersionHistorySheet() {
	const { meta } = useEditor();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const versions = useQuery(trpc.form.versions.queryOptions({ id: meta.id }));
	const restore = useMutation(
		trpc.form.restoreVersion.mutationOptions({
			onError: (error) =>
				toast.error("Couldn't restore that version", {
					description: error.message,
				}),
			onSuccess: async () => {
				toast.success("Version restored");
				await queryClient.invalidateQueries({
					queryKey: trpc.form.get.queryKey({ id: meta.id }),
				});
				window.location.reload();
			},
		})
	);

	return (
		<Sheet>
			<Tooltip>
				<TooltipTrigger
					render={
						<SheetTrigger
							render={
								<Button
									aria-label="Version history"
									size="icon-sm"
									type="button"
									variant="ghost"
								/>
							}
						/>
					}
				>
					<HistoryIcon />
				</TooltipTrigger>
				<TooltipContent>Version history</TooltipContent>
			</Tooltip>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Version history</SheetTitle>
				</SheetHeader>
				<div className="flex flex-col gap-1 overflow-y-auto p-4">
					{versions.data?.length ? (
						versions.data.map((version) => (
							<div
								className="flex items-center justify-between gap-2 border-b py-2 text-xs"
								key={version.id}
							>
								<div className="flex flex-col">
									<span className="font-medium">{version.title}</span>
									<span className="text-muted-foreground">
										{formatDate(version.createdAt.toString())} ·{" "}
										{version.fieldsCount} fields
									</span>
								</div>
								<Button
									disabled={restore.isPending}
									onClick={() =>
										restore.mutate({ id: meta.id, versionId: version.id })
									}
									size="sm"
									type="button"
									variant="outline"
								>
									Restore
								</Button>
							</div>
						))
					) : (
						<p className="p-4 text-center text-muted-foreground text-xs">
							No earlier versions yet.
						</p>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
