import { Check, Star } from "lucide-react";

/** Decorative preview of a form, tinted with the instance colour. */
export default function MockForm() {
	return (
		<div
			aria-hidden="true"
			className="relative mx-auto w-full max-w-sm select-none"
		>
			<div className="-rotate-2 rounded-2xl border border-white/60 bg-white/90 p-5 shadow-2xl shadow-primary/20 backdrop-blur dark:border-white/10 dark:bg-neutral-900/85">
				<div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
					<div className="h-full w-2/3 rounded-full bg-primary" />
				</div>
				<p className="font-semibold text-neutral-900 text-sm dark:text-neutral-100">
					How was your experience?
				</p>
				<div className="mt-2 flex gap-1 text-primary">
					{[1, 2, 3, 4, 5].map((n) => (
						<Star
							className="size-5"
							fill={n <= 4 ? "currentColor" : "none"}
							key={n}
						/>
					))}
				</div>
				<div className="mt-4 space-y-2">
					<div className="h-2.5 w-24 rounded bg-neutral-300 dark:bg-neutral-700" />
					<div className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800" />
				</div>
				<div className="mt-3 flex flex-wrap gap-2">
					{["Design", "Speed", "Support"].map((tag, i) => (
						<span
							className={
								i === 1
									? "rounded-full bg-primary px-3 py-1 font-medium text-primary-foreground text-xs"
									: "rounded-full border border-neutral-200 px-3 py-1 text-neutral-600 text-xs dark:border-neutral-700 dark:text-neutral-300"
							}
							key={tag}
						>
							{tag}
						</span>
					))}
				</div>
				<div className="mt-5 flex justify-end">
					<span className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-xs shadow-primary/30 shadow-sm">
						Submit
					</span>
				</div>
			</div>

			<div className="absolute -right-4 -bottom-5 flex rotate-2 items-center gap-2.5 rounded-xl border border-white/60 bg-white/95 px-3.5 py-2.5 shadow-xl dark:border-white/10 dark:bg-neutral-900/95">
				<span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
					<Check className="size-4" />
				</span>
				<span className="text-xs">
					<span className="block font-semibold text-neutral-900 dark:text-neutral-100">
						New response
					</span>
					<span className="text-neutral-500">just now</span>
				</span>
			</div>
		</div>
	);
}
