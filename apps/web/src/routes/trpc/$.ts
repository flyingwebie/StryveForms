import { createFileRoute } from "@tanstack/react-router";

import { proxyHandlers } from "@/server/proxy";

/** /trpc/* is served by the API server. */
export const Route = createFileRoute("/trpc/$")({
	server: { handlers: proxyHandlers },
});
