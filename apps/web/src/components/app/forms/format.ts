const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

/** Short relative time ("2h ago", "3d ago", "just now") used across the forms list. */
export function formatRelativeTime(value: Date | string): string {
	const date = typeof value === "string" ? new Date(value) : value;
	const diffSeconds = Math.max(
		0,
		Math.round((Date.now() - date.getTime()) / 1000)
	);

	if (diffSeconds < MINUTE) {
		return "just now";
	}
	if (diffSeconds < HOUR) {
		return `${Math.round(diffSeconds / MINUTE)}m ago`;
	}
	if (diffSeconds < DAY) {
		return `${Math.round(diffSeconds / HOUR)}h ago`;
	}
	if (diffSeconds < WEEK) {
		return `${Math.round(diffSeconds / DAY)}d ago`;
	}
	if (diffSeconds < MONTH) {
		return `${Math.round(diffSeconds / WEEK)}w ago`;
	}
	if (diffSeconds < YEAR) {
		return `${Math.round(diffSeconds / MONTH)}mo ago`;
	}
	return `${Math.round(diffSeconds / YEAR)}y ago`;
}
