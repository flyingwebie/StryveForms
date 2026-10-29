/** Coerces an answer value to a plain string for text-like inputs. */
export function toText(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (value === null || value === undefined) {
		return "";
	}
	return String(value);
}

/** Coerces an answer value to a string suitable for a number input. */
export function toNumberInputValue(value: unknown): string {
	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : "";
	}
	return toText(value);
}

export function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((v) => toText(v));
	}
	if (value === null || value === undefined || value === "") {
		return [];
	}
	return [toText(value)];
}
