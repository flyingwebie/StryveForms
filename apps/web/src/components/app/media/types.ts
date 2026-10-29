/**
 * Shared image shape for the `ImagePicker` family (Upload/Library/Unsplash
 * tabs). Mirrors `BlockImage` in packages/forms/src/types.ts (`credit` has
 * the identical shape there) — see README.md for the full contract.
 */
export interface PickedImageCredit {
	name: string;
	source: "unsplash";
	url: string;
}

export interface PickedImage {
	alt?: string;
	credit?: PickedImageCredit;
	url: string;
}

export type ImagePickerTab = "upload" | "library" | "unsplash";
