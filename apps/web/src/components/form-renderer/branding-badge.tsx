import { useInstance } from "@/lib/instance";

import type { FormDictionary } from "./i18n";

export function BrandingBadge({ dict }: { dict: FormDictionary }) {
	const instance = useInstance();
	const name = instance?.name || "StryveForms";
	// The badge has room for a small square mark next to the name, so prefer
	// the square icon over the wide logo (unreadable at this size).
	const logo = instance?.faviconUrl || instance?.logoUrl;

	return (
		<a
			className="mx-auto mt-4 flex w-fit items-center gap-1.5 text-neutral-400 text-xs hover:text-neutral-600 dark:hover:text-neutral-300"
			href="https://stryveforms.com?utm_source=form&utm_medium=badge"
			rel="noopener noreferrer"
			target="_blank"
		>
			{dict.poweredBy}
			{logo ? (
				<img
					alt=""
					aria-hidden="true"
					className="h-3.5 w-auto"
					height={14}
					src={logo}
					width={14}
				/>
			) : null}
			<span className="font-semibold">{name}</span>
		</a>
	);
}
