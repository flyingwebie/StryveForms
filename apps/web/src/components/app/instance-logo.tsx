import { cn } from "@StryveForms/ui/lib/utils";
import { useTheme } from "next-themes";

import { useInstance } from "@/lib/instance";
import { useLogoInfo } from "@/lib/logo-shape";

const DEFAULT_NAME = "StryveForms";
const DEFAULT_MARK = "/brand/stryveforms-mark.svg";

const SIZES = {
	lg: { mark: "size-9", text: "text-xl", wordmark: "h-9 max-w-56" },
	md: { mark: "size-7", text: "text-[15px]", wordmark: "h-7 max-w-44" },
	sm: { mark: "size-6", text: "text-sm", wordmark: "h-6 max-w-40" },
} as const;

export type BrandLockupSize = keyof typeof SIZES;

export interface BrandLockupProps {
	/** Put the logo on a white chip, for a dark-on-light logo shown on a coloured or dark surface. */
	chip?: boolean;
	className?: string;
	/** Square icon for tight spots (the favicon): used by `mode="icon"`. */
	iconUrl?: string | null;
	/** The logo to show (already the right light/dark variant), or null for none. */
	logoUrl: string | null;
	/** "full": wordmark, or mark + name. "icon": a square icon only. */
	mode?: "full" | "icon";
	name: string;
	nameClassName?: string;
	size?: BrandLockupSize;
}

/**
 * Lays a brand out by the logo's shape, so any upload looks intentional:
 * a wide logo is a wordmark and replaces the product name; a square or tall
 * logo is a mark shown next to the name; no logo falls back to the
 * StryveForms mark (default brand) or an initial badge. `mode="icon"` is for
 * square slots (collapsed sidebar, editor top bar) and prefers the favicon.
 */
export function BrandLockup({
	chip = false,
	className,
	iconUrl,
	logoUrl,
	mode = "full",
	name,
	nameClassName,
	size = "md",
}: BrandLockupProps) {
	const logo = useLogoInfo(logoUrl);
	const s = SIZES[size];
	const isDefaultBrand = !logoUrl && name === DEFAULT_NAME;
	const isWide = logo?.shape === "wide";
	const chipClass = chip ? "rounded-lg bg-white p-1 shadow-xs" : "";

	if (mode === "icon") {
		const src = iconUrl || (logoUrl && !isWide ? logoUrl : null) || null;
		if (src || isDefaultBrand) {
			return (
				<img
					alt={name}
					className={cn(
						s.mark,
						"shrink-0 rounded-md object-contain",
						chipClass,
						className
					)}
					height={36}
					src={src ?? DEFAULT_MARK}
					width={36}
				/>
			);
		}
		return <InitialBadge className={cn(s.mark, className)} name={name} />;
	}

	if (logoUrl && isWide) {
		return (
			<span className={cn("flex min-w-0 items-center", className)}>
				<img
					alt={name}
					className={cn(
						s.wordmark,
						"w-auto shrink-0 object-contain object-left",
						chip && "rounded-lg bg-white px-2 py-1 shadow-xs"
					)}
					height={36}
					src={logoUrl}
					width={180}
				/>
			</span>
		);
	}

	return (
		<span className={cn("flex min-w-0 items-center gap-2", className)}>
			{logoUrl || isDefaultBrand ? (
				<img
					alt=""
					className={cn(
						s.mark,
						"shrink-0 rounded-md object-contain",
						chipClass
					)}
					height={36}
					src={logoUrl ?? DEFAULT_MARK}
					width={36}
				/>
			) : (
				<InitialBadge className={s.mark} name={name} />
			)}
			<span
				className={cn(
					"truncate font-semibold tracking-tight",
					s.text,
					nameClassName
				)}
			>
				{name}
			</span>
		</span>
	);
}

function InitialBadge({
	className,
	name,
}: {
	className?: string;
	name: string;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 font-semibold text-primary-foreground text-xs shadow-sm",
				className
			)}
		>
			{name.slice(0, 1).toUpperCase()}
		</span>
	);
}

/**
 * The installation's brand (Admin → Branding), light/dark aware.
 * `surface="brand"` is for the coloured sign-in panel: it prefers the
 * "dark backgrounds" logo, and otherwise sets the main logo on a white chip.
 */
export default function InstanceLogo({
	className,
	mode = "full",
	nameClassName,
	size = "md",
	surface = "default",
}: {
	className?: string;
	mode?: "full" | "icon";
	nameClassName?: string;
	size?: BrandLockupSize;
	surface?: "default" | "brand";
}) {
	const instance = useInstance();
	const { resolvedTheme } = useTheme();
	const name = instance?.name ?? DEFAULT_NAME;
	const light = instance?.logoUrl ?? null;
	const dark = instance?.logoDarkUrl ?? null;

	const onDarkSurface = surface === "brand" || resolvedTheme === "dark";
	const logoUrl = onDarkSurface ? (dark ?? light) : light;
	// A light-background logo on the coloured panel or in dark mode needs a backing.
	const chip = Boolean(onDarkSurface && light && !dark);

	return (
		<BrandLockup
			chip={chip}
			className={className}
			iconUrl={
				onDarkSurface
					? (instance?.faviconDarkUrl ?? instance?.faviconUrl ?? null)
					: (instance?.faviconUrl ?? null)
			}
			logoUrl={logoUrl}
			mode={mode}
			name={name}
			nameClassName={nameClassName}
			size={size}
		/>
	);
}
