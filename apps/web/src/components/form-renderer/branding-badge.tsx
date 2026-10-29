import type { FormDictionary } from "./i18n";

/**
 * The "Powered by StryveForms" credit under a form. Always the StryveForms
 * mark and name (it credits the open-source project, not the instance or
 * workspace); "Hide StryveForms branding" in the brand/Design settings
 * removes it.
 */
export function BrandingBadge({ dict }: { dict: FormDictionary }) {
	return (
		<a
			className="mx-auto mt-4 flex w-fit items-center gap-1.5 text-neutral-400 text-xs hover:text-neutral-600 dark:hover:text-neutral-300"
			href="https://stryveforms.com?utm_source=form&utm_medium=badge"
			rel="noopener noreferrer"
			target="_blank"
		>
			{dict.poweredBy}
			<img
				alt=""
				aria-hidden="true"
				className="size-3.5"
				height={14}
				src="/brand/stryveforms-mark.svg"
				width={14}
			/>
			<span className="font-semibold">StryveForms</span>
		</a>
	);
}
