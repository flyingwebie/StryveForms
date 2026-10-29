/**
 * Id remapping + URL/key rewriting for import (BACKUP_DESIGN.md: "importing
 * always creates NEW ids... rewrite every reference"). Internal to
 * services/backup — not part of CONTRACT.md.
 */

export type RemapEntity =
	| "workspace"
	| "folder"
	| "form"
	| "formVersion"
	| "submission"
	| "integration"
	| "notification"
	| "pdfTemplate"
	| "template"
	| "storedFile"
	| "user";

/** oldId -> newId, per entity kind, built up while importing. */
export class RemapTable {
	private readonly maps = new Map<RemapEntity, Map<string, string>>();

	set(entity: RemapEntity, oldId: string, newId: string) {
		let map = this.maps.get(entity);
		if (!map) {
			map = new Map();
			this.maps.set(entity, map);
		}
		map.set(oldId, newId);
	}

	get(entity: RemapEntity, oldId: string): string | undefined {
		return this.maps.get(entity)?.get(oldId);
	}

	/** Same as `get`, but falls back to the old id when nothing was remapped (e.g. optional refs to skipped rows). */
	getOrSame(entity: RemapEntity, oldId: string): string {
		return this.get(entity, oldId) ?? oldId;
	}

	entries(entity: RemapEntity): [string, string][] {
		return Array.from(this.maps.get(entity)?.entries() ?? []);
	}
}

/**
 * Walks any JSON value and replaces every occurrence of `oldKey` with
 * `newKey` wherever it appears as a *substring* — storage keys and signed
 * URLs embed the file's stored name, so a straight substring swap catches
 * it whether it's a bare key (`assets/abc_logo.png`) or a full URL
 * (`https://host/api/assets/abc_logo.png?expires=…&signature=…`). Case
 * sensitive and exact otherwise: this must never rewrite unrelated text.
 */
export function rewriteValueReferences<T>(
	value: T,
	replacements: ReadonlyMap<string, string>
): T {
	if (replacements.size === 0) {
		return value;
	}
	return rewriteOne(value, replacements) as T;
}

function rewriteOne(
	value: unknown,
	replacements: ReadonlyMap<string, string>
): unknown {
	if (typeof value === "string") {
		return rewriteString(value, replacements);
	}
	if (Array.isArray(value)) {
		return value.map((item) => rewriteOne(item, replacements));
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			out[key] = rewriteOne(val, replacements);
		}
		return out;
	}
	return value;
}

function rewriteString(
	value: string,
	replacements: ReadonlyMap<string, string>
): string {
	let result = value;
	for (const [oldRef, newRef] of replacements) {
		if (oldRef.length > 0 && result.includes(oldRef)) {
			result = result.split(oldRef).join(newRef);
		}
	}
	return result;
}

/**
 * Builds the old->new reference map for stored files: both the bare storage
 * key (`assets/abc_logo.png`) and, when a `urlOf` builder is given, the
 * public/signed URL built from the old and new stored names — so both forms
 * found inside form `properties`/`brand`/`settings`/submission `data` get
 * rewritten by one pass of `rewriteValueReferences`.
 */
export function fileReferenceMap(
	files: { newKey: string; oldKey: string }[],
	urlOf?: (key: string) => string
): Map<string, string> {
	const map = new Map<string, string>();
	for (const file of files) {
		if (file.oldKey === file.newKey) {
			continue;
		}
		map.set(file.oldKey, file.newKey);
		if (urlOf) {
			map.set(urlOf(file.oldKey), urlOf(file.newKey));
		}
	}
	return map;
}
