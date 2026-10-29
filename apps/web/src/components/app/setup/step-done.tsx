import { Button } from "@StryveForms/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2Icon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/utils/trpc";

/** Step 4: marks onboarding complete and sends the admin to the dashboard. */
export default function SetupStepDone() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const complete = useMutation(
		trpc.instance.completeSetup.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.instance.public.queryKey(),
				});
			},
		})
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
	useEffect(() => {
		complete.mutate();
	}, []);

	return (
		<div className="flex flex-col items-center gap-4 text-center">
			<CheckCircle2Icon className="size-10 text-green-600" />
			<h2 className="font-semibold text-xl">You're all set</h2>
			<p className="max-w-sm text-muted-foreground text-sm">
				Your workspace is ready. You can fine-tune branding and access anytime
				from Admin settings.
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				<Button
					onClick={() =>
						navigate({ search: { tab: "import" }, to: "/dashboard/settings" })
					}
					variant="outline"
				>
					Import forms
				</Button>
				<Button onClick={() => navigate({ to: "/dashboard" })}>
					Go to dashboard
				</Button>
			</div>
		</div>
	);
}
