/**
 * A tiny generic "document" illustration tinted by the form's own colour —
 * the card's thumbnail. Falls back to the cover image / logo when the form
 * has one.
 */
export function FormThumbnail({
	className,
	color,
	coverPicture,
	logoPicture,
}: {
	className?: string;
	color: string;
	coverPicture?: string | null;
	logoPicture?: string | null;
	/** Unused by the current illustration; kept so existing callers can still pass it. */
	properties?: unknown;
}) {
	if (coverPicture) {
		return (
			<div className={`relative overflow-hidden bg-muted ${className ?? ""}`}>
				<img
					alt=""
					className="size-full object-cover"
					height={160}
					loading="lazy"
					src={coverPicture}
					width={400}
				/>
				{logoPicture ? (
					<img
						alt=""
						className="absolute bottom-2 left-2 size-6 rounded-md bg-background/80 object-contain p-0.5 shadow"
						height={24}
						loading="lazy"
						src={logoPicture}
						width={24}
					/>
				) : null}
			</div>
		);
	}

	return (
		<div
			className={`flex items-center justify-center bg-subtle ${className ?? ""}`}
		>
			<div className="flex h-[72px] w-[88px] flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5 shadow-sm">
				<span className="h-1.5 w-full rounded-full bg-muted-foreground/25" />
				<span className="h-1.5 w-3/4 rounded-full bg-muted-foreground/25" />
				<span className="h-1.5 w-1/2 rounded-full bg-muted-foreground/25" />
				<span
					aria-hidden="true"
					className="mt-auto ml-auto h-2 w-6 rounded-full"
					style={{ backgroundColor: color }}
				/>
			</div>
		</div>
	);
}
