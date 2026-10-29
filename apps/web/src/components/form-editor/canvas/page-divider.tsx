export function PageDivider({ pageNumber }: { pageNumber: number }) {
	return (
		<div className="col-span-12 flex items-center gap-3 pt-2 pb-1 first:pt-0">
			<p className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
				Page {pageNumber}
			</p>
			<div className="h-px flex-1 bg-border" />
		</div>
	);
}
