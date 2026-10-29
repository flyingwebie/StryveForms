/**
 * Loader for the full emoji picker dataset (`emoji-data.json`, ~1,700
 * standard Unicode emoji grouped into the 9 standard categories, each with
 * search keywords). The data is vendored from emojibase-data (MIT licensed,
 * https://github.com/milesj/emojibase) rather than added as a dependency,
 * so it never touches the shared root lockfile.
 *
 * Imported dynamically (and cached) so the ~170KB dataset is its own chunk
 * and only downloads once someone opens the Emoji tab of the icon picker.
 */

export interface EmojiEntry {
	/** The emoji glyph itself. */
	e: string;
	/** Category id, see `EmojiDataset.groups`. */
	g: number;
	/** Lowercase search keywords (label words + tags). */
	k: string[];
	/** Human-readable label, e.g. "grinning face". */
	l: string;
}

export interface EmojiDataset {
	emoji: EmojiEntry[];
	/** Category id -> display name, e.g. "0" -> "Smileys & Emotion". */
	groups: Record<string, string>;
}

let cached: Promise<EmojiDataset> | null = null;

/** Lazily loads and caches the emoji dataset. Safe to call repeatedly. */
export function loadEmojiData(): Promise<EmojiDataset> {
	cached ??= import("./emoji-data.json").then(
		(mod) => mod.default as EmojiDataset
	);
	return cached;
}
