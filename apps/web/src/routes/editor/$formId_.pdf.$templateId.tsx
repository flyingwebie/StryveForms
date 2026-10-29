import { Spinner } from "@StryveForms/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import PdfTemplateEditor from "@/components/app/pdf/editor/pdf-template-editor";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/editor/$formId_/pdf/$templateId")({
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data) {
			throw redirect({ to: "/login" });
		}
		return { session };
	},
	component: PdfEditorRoute,
	ssr: false,
});

function PdfEditorRoute() {
	const { formId, templateId } = Route.useParams();
	const trpc = useTRPC();
	const templateQuery = useQuery(trpc.pdf.get.queryOptions({ id: templateId }));
	const formQuery = useQuery(trpc.form.get.queryOptions({ id: formId }));
	const error = templateQuery.error ?? formQuery.error;

	if (!(templateQuery.data && formQuery.data)) {
		if (error) {
			return (
				<div className="flex h-svh flex-col items-center justify-center gap-2 text-center">
					<p className="font-medium">This PDF template couldn't be loaded.</p>
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

	return (
		<PdfTemplateEditor
			form={formQuery.data}
			key={templateQuery.data.id}
			template={templateQuery.data}
		/>
	);
}
