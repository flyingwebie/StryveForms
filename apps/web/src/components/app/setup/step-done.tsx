import { Button } from "@StryveForms/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, DownloadIcon, PartyPopperIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { useInstance } from "@/lib/instance";
import { useTRPC } from "@/utils/trpc";

/** Step 4: marks onboarding complete and sends the admin to the dashboard. */
export default function SetupStepDone() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const instance = useInstance();

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
			<span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
				<PartyPopperIcon className="size-6" />
			</span>
			<h1 className="font-display text-4xl">You're all set!</h1>
			<p className="max-w-sm text-muted-foreground text-sm">
				StryveForms is ready for {instance?.name ?? "your workspace"}. Invite
				your team or bring over your existing forms.
			</p>
			<div className="flex flex-wrap justify-center gap-2">
				<Button
					onClick={() =>
						navigate({ search: { tab: "import" }, to: "/dashboard/settings" })
					}
					variant="outline"
				>
					<DownloadIcon /> Import forms
				</Button>
				<Button onClick={() => navigate({ to: "/dashboard" })}>
					<ArrowRightIcon /> Go to dashboard
				</Button>
			</div>
		</div>
	);
}
