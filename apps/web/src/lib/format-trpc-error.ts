/**
 * tRPC input-validation failures surface as a JSON-stringified array of Zod
 * issues (e.g. `[{"code":"too_small","path":["socialLinks",0,"label"],...}]`).
 * Shown raw, that's unreadable JSON. This turns the first issue into one
 * plain-language sentence instead.
 */

interface ZodIssueLike {
	code?: string;
	format?: string;
	maximum?: number;
	message?: string;
	minimum?: number;
	path?: (string | number)[];
}

function humanizeWord(word: string): string {
	const spaced = word.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
	const lower = spaced.toLowerCase();
	return lower.length > 0 ? lower[0].toUpperCase() + lower.slice(1) : lower;
}

/** `["settings","socialLinks",0,"label"]` -> "Settings social links 1 label" */
function humanizePath(path: (string | number)[]): string {
	const parts: string[] = [];
	for (const segment of path) {
		if (typeof segment === "number") {
			const previous = parts.pop();
			parts.push(`${previous ?? "Item"} ${segment + 1}`);
		} else {
			parts.push(humanizeWord(segment));
		}
	}
	return parts.join(" ");
}

function friendlyIssueMessage(issue: ZodIssueLike): string {
	switch (issue.code) {
		case "too_small":
			return typeof issue.minimum === "number" && issue.minimum <= 1
				? "is required"
				: `must be at least ${issue.minimum} characters`;
		case "too_big":
			return `must be at most ${issue.maximum} characters`;
		case "invalid_format":
			if (issue.format === "url") {
				return "must be a valid URL";
			}
			if (issue.format === "email") {
				return "must be a valid email address";
			}
			return "has an invalid format";
		case "invalid_type":
			return "is invalid";
		default:
			return issue.message || "is invalid";
	}
}

function parseZodIssues(message: string): ZodIssueLike[] | null {
	try {
		const parsed = JSON.parse(message);
		if (
			Array.isArray(parsed) &&
			parsed.length > 0 &&
			typeof parsed[0] === "object" &&
			parsed[0] !== null
		) {
			return parsed as ZodIssueLike[];
		}
	} catch {
		// Not JSON — it's already a plain message.
	}
	return null;
}

/** Turns a tRPC error (zod validation or plain) into one friendly sentence. */
export function formatTrpcError(
	error: { message?: string } | null | undefined
): string {
	const raw = error?.message ?? "";
	const issues = parseZodIssues(raw);
	if (!issues) {
		return raw || "Something went wrong";
	}
	const [first, ...rest] = issues;
	const path = Array.isArray(first.path) ? first.path : [];
	const field = path.length > 0 ? humanizePath(path) : null;
	const sentence = field
		? `${field} ${friendlyIssueMessage(first)}`
		: friendlyIssueMessage(first);
	const extra =
		rest.length > 0
			? ` (and ${rest.length} other issue${rest.length === 1 ? "" : "s"})`
			: "";
	return `${sentence}${extra}.`;
}
