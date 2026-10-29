import { createFileRoute } from "@tanstack/react-router";

import { proxyHandlers } from "@/server/proxy";

/** /api/* (auth, uploads, files, exports) is served by the API server. */
export const Route = createFileRoute("/api/$")({
	server: { handlers: proxyHandlers },
});
