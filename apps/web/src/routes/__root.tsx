import type { AppRouter } from "@StryveForms/api/routers/index";
import { Toaster } from "@StryveForms/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	redirect,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { ThemeProvider } from "next-themes";

import InstanceThemeVars from "@/components/app/instance-theme-vars";

import appCss from "../index.css?url";

export interface RouterAppContext {
	queryClient: QueryClient;
	trpc: TRPCOptionsProxy<AppRouter>;
}

/** Named + explicitly-typed so `head` can cast `loaderData` without relying on this router version's broken inference. */
async function fetchInstance(context: RouterAppContext) {
	return await context.queryClient.ensureQueryData(
		context.trpc.instance.public.queryOptions()
	);
}
interface LoaderData {
	instance: Awaited<ReturnType<typeof fetchInstance>>;
}

/** Routes reachable even on a brand-new installation with no users yet. */
function isSetupExempt(pathname: string): boolean {
	return pathname === "/setup" || pathname.startsWith("/forms/");
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	beforeLoad: async ({ context, location }) => {
		const instance = await fetchInstance(context);
		if (instance.setupRequired && !isSetupExempt(location.pathname)) {
			throw redirect({ to: "/setup" });
		}
	},
	loader: async ({ context }) => ({ instance: await fetchInstance(context) }),
	head: ({ loaderData }) => {
		const data = loaderData as LoaderData | undefined;
		const name = data?.instance.name || "StryveForms";
		return {
			meta: [
				{ charSet: "utf-8" },
				{ content: "width=device-width, initial-scale=1", name: "viewport" },
				{ title: name === "StryveForms" ? name : `${name} · Forms` },
			],
			links: [
				{ href: appCss, rel: "stylesheet" },
				{ href: data?.instance.faviconUrl || "/favicon.svg", rel: "icon" },
				{ href: "/apple-touch-icon.png", rel: "apple-touch-icon" },
			],
		};
	},
	component: RootDocument,
});

function RootDocument() {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					disableTransitionOnChange
					enableSystem
				>
					<InstanceThemeVars />
					<Outlet />
					<Toaster richColors />
				</ThemeProvider>
				{import.meta.env.DEV ? (
					<TanStackRouterDevtools position="bottom-left" />
				) : null}
				{import.meta.env.DEV ? (
					<ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
				) : null}
				<Scripts />
			</body>
		</html>
	);
}
