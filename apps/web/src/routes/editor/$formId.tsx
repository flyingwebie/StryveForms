import { Spinner } from "@StryveForms/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { EditorShell } from "@/components/form-editor/editor-shell";
import { EditorProvider } from "@/components/form-editor/state/editor-context";
import type { EditorFormMeta } from "@/components/form-editor/types";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/editor/$formId")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
		return { session };
	},
	component: EditorRoute,
	ssr: false,
});

function EditorRoute() {
	const { formId } = Route.useParams();
	const trpc = useTRPC();
	const { data, error, refetch } = useQuery(
		trpc.form.get.queryOptions({ id: formId })
	);

	if (!data) {
		if (error) {
			return (
				<div className="flex h-svh flex-col items-center justify-center gap-2 text-center">
					<p className="font-medium">This form couldn't be loaded.</p>
					<p className="text-muted-foreground text-sm">{error.message}</p>
				</div>
			);
		}
		return (
			<div className="flex h-svh items-center justify-center">
				<Spinner className="size-6" />
			</div>
		);
	}
	const meta: EditorFormMeta = {
		createdAt: data.createdAt,
		hasPassword: data.hasPassword,
		id: data.id,
		role: data.role,
		shareUrl: data.shareUrl,
		slug: data.slug,
		submissionsCount: data.submissionsCount,
		updatedAt: data.updatedAt,
		workspaceId: data.workspaceId,
	};

	return (
		<EditorProvider
			initialSettings={data}
			key={data.id}
			meta={meta}
			reload={async () => {
				const result = await refetch();
				return result.data ?? null;
			}}
		>
			<EditorShell />
		</EditorProvider>
	);
}
