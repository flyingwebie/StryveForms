import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old address of the OpnForm import; it now lives in Settings → Import. */
export const Route = createFileRoute("/_auth/dashboard/import")({
	beforeLoad: () => {
		throw redirect({ search: { tab: "import" }, to: "/dashboard/settings" });
	},
});
