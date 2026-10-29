const UNITS = ["B", "KB", "MB", "GB", "TB"];
const BYTES_STEP = 1024;
const MINUTE = 60;
const HOUR = 3600;

export function formatBytes(bytes: number): string {
	let value = bytes;
	let unit = 0;
	while (value >= BYTES_STEP && unit < UNITS.length - 1) {
		value /= BYTES_STEP;
		unit += 1;
	}
	return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${UNITS[unit]}`;
}

/** "under a minute", "about 4 min", "about 2 h 10 min". */
export function formatDuration(seconds: number): string {
	if (seconds < MINUTE) {
		return "under a minute";
	}
	if (seconds < HOUR) {
		return `about ${Math.round(seconds / MINUTE)} min`;
	}
	const hours = Math.floor(seconds / HOUR);
	const minutes = Math.round((seconds % HOUR) / MINUTE);
	return minutes ? `about ${hours} h ${minutes} min` : `about ${hours} h`;
}

export function plural(count: number, word: string): string {
	return `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;
}
