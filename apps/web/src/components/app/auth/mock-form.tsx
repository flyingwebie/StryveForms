import { Star } from "lucide-react";

const FILLED_STARS = 4;
const STAR_RATINGS = [1, 2, 3, 4, 5];

/** Decorative preview of a form, tinted with the instance colour. */
export default function MockForm() {
	return (
		<div
			aria-hidden="true"
			className="relative mx-auto w-full max-w-sm select-none"
		>
			<div className="absolute inset-0 translate-x-3 translate-y-3 rotate-1 rounded-2xl bg-white/50 dark:bg-white/10" />
			<div className="relative -rotate-2 rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900">
				<div className="mb-3 flex items-center gap-2">
					<span className="size-2 rounded-full bg-primary" />
					<p className="font-semibold text-neutral-900 text-sm dark:text-neutral-100">
						Customer feedback
					</p>
				</div>
				<div className="space-y-3">
					<div className="space-y-1.5">
						<p className="text-neutral-500 text-xs dark:text-neutral-400">
							Full name
						</p>
						<div className="flex h-8 items-center rounded-lg bg-neutral-100 px-2.5 text-neutral-700 text-xs dark:bg-neutral-800 dark:text-neutral-200">
							Jordan Casey
						</div>
					</div>
					<div className="space-y-1.5">
						<p className="text-neutral-500 text-xs dark:text-neutral-400">
							How did we do?
						</p>
						<div className="flex gap-1 text-primary">
							{STAR_RATINGS.map((n) => (
								<Star
									className="size-4"
									fill={n <= FILLED_STARS ? "currentColor" : "none"}
									key={n}
								/>
							))}
						</div>
					</div>
				</div>
				<div className="mt-4 flex justify-end">
					<span className="rounded-lg bg-primary px-4 py-1.5 font-medium text-primary-foreground text-xs">
						Submit
					</span>
				</div>
			</div>
		</div>
	);
}
