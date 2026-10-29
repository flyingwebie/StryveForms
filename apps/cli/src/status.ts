/** Shared by `integrations update/create` and `notifications update/create`: validates a `--status` flag, exiting (via `fail`) with a readable message if it's neither "active" nor "inactive". Returns `undefined` unchanged when the flag was omitted, so a caller can tell "not provided" apart from an explicit value. */
import { fail } from "./output";

export function requireStatus(
	status: string | undefined,
	json: boolean
): "active" | "inactive" | undefined {
	if (status === undefined) {
		return undefined;
	}
	if (status !== "active" && status !== "inactive") {
		fail('--status must be "active" or "inactive"', json);
	}
	return status as "active" | "inactive";
}
