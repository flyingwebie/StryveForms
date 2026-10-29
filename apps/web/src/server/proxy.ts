import { getRequestIP } from "@tanstack/react-start/server";

const DEFAULT_INTERNAL_API = "http://localhost:3000";
const REQUEST_HOP_HEADERS = [
	"host",
	"connection",
	"keep-alive",
	"transfer-encoding",
	"upgrade",
	"content-length",
];
// fetch() already decoded the body, so the original length/encoding no longer apply.
const RESPONSE_DROP_HEADERS = [
	"content-encoding",
	"content-length",
	"transfer-encoding",
	"connection",
];

/**
 * Forwards a request to the API server (SERVER_URL) and streams the answer
 * back. Lets the whole app run on one domain.
 */
export async function proxyToApi(request: Request): Promise<Response> {
	const target = process.env.SERVER_URL || DEFAULT_INTERNAL_API;
	const url = new URL(request.url);
	const upstream = new URL(`${url.pathname}${url.search}`, target);

	const headers = new Headers(request.headers);
	for (const name of REQUEST_HOP_HEADERS) {
		headers.delete(name);
	}
	headers.set("x-forwarded-host", url.host);
	headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
	const ip = getRequestIP({ xForwardedFor: true });
	if (ip) {
		headers.set("x-forwarded-for", ip);
	}

	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	let response: Response;
	try {
		response = await fetch(upstream, {
			body: hasBody ? request.body : undefined,
			// Required by Node's fetch when streaming a request body.
			duplex: "half",
			headers,
			method: request.method,
			redirect: "manual",
		} as RequestInit);
	} catch {
		return Response.json(
			{ message: "The API server is not reachable. Is it running?" },
			{ status: 502 }
		);
	}

	const out = new Headers(response.headers);
	for (const name of RESPONSE_DROP_HEADERS) {
		out.delete(name);
	}
	return new Response(response.body, {
		headers: out,
		status: response.status,
		statusText: response.statusText,
	});
}

const handle = ({ request }: { request: Request }) => proxyToApi(request);

/** Route handlers for every HTTP method. */
export const proxyHandlers = {
	DELETE: handle,
	GET: handle,
	HEAD: handle,
	OPTIONS: handle,
	PATCH: handle,
	POST: handle,
	PUT: handle,
};
