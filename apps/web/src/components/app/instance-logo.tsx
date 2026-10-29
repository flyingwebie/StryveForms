import { cn } from "@StryveForms/ui/lib/utils";
import { useTheme } from "next-themes";

import { useInstance } from "@/lib/instance";

const DEFAULT_NAME = "StryveForms";
const DEFAULT_MARK = "/brand/stryveforms-mark.svg";

/**
 * The installation's logo (light/dark aware). Without an uploaded logo it
 * shows the StryveForms mark, or an initial badge once the name is customised.
 */
export default function InstanceLogo({
	className,
	markClassName,
	nameClassName,
	showName = true,
}: {
	className?: string;
	markClassName?: string;
	nameClassName?: string;
	showName?: boolean;
}) {
	const instance = useInstance();
	const { resolvedTheme } = useTheme();
	const name = instance?.name ?? DEFAULT_NAME;
	const uploaded =
		resolvedTheme === "dark"
			? (instance?.logoDarkUrl ?? instance?.logoUrl)
			: instance?.logoUrl;
	const isDefaultBrand = !uploaded && name === DEFAULT_NAME;

	return (
		<span className={cn("flex min-w-0 items-center gap-2", className)}>
			{uploaded || isDefaultBrand ? (
				<img
					alt={showName ? "" : name}
					className={cn("h-7 w-auto shrink-0", markClassName)}
					height={28}
					src={uploaded ?? DEFAULT_MARK}
					width={28}
				/>
			) : (
				<span
					aria-hidden={showName}
					className={cn(
						"flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-semibold text-primary-foreground text-xs shadow-sm",
						markClassName
					)}
				>
					{name.slice(0, 1).toUpperCase()}
				</span>
			)}
			{showName ? (
				<span
					className={cn("truncate font-semibold tracking-tight", nameClassName)}
				>
					{name}
				</span>
			) : null}
		</span>
	);
}
