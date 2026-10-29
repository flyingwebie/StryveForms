import { cn } from "@StryveForms/ui/lib/utils";
import {
	CircleAlertIcon,
	CircleCheckIcon,
	ImageIcon,
	Loader2Icon,
	XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { LogoInfo } from "@/lib/logo-shape";
import { useLogoInfo } from "@/lib/logo-shape";
import { uploadAsset } from "@/lib/upload-asset";

const SVG_URL = /\.svg(?:$|\?)/i;
/** Wordmarks show at up to 36px tall; 2× that keeps them sharp on retina screens. */
const MIN_LOGO_HEIGHT = 72;
const MIN_ICON_SIZE = 192;
/** Icons within 3% of square (e.g. 236×233) count as square. */
const SQUARE_TOLERANCE = 0.03;

const SHAPE_LABEL: Record<LogoInfo["shape"], string> = {
	square: "Square mark",
	tall: "Tall / stacked logo",
	wide: "Wide wordmark",
};

interface Feedback {
	message: string;
	tone: "ok" | "warn";
}

/** Plain-language checks on an uploaded logo or icon, so admins know if it'll look right. */
export function logoFeedback(
	kind: "logo" | "icon",
	info: LogoInfo | null,
	url: string | null
): Feedback[] {
	if (!(info && url)) {
		return [];
	}
	const isSvg = SVG_URL.test(url);
	const feedback: Feedback[] = [];
	if (kind === "icon") {
		if (
			Math.abs(info.width - info.height) / Math.max(info.width, info.height) >
			SQUARE_TOLERANCE
		) {
			feedback.push({
				message: "Not square, so it will be letterboxed. Crop it to 1:1.",
				tone: "warn",
			});
		}
		if (!isSvg && Math.min(info.width, info.height) < MIN_ICON_SIZE) {
			feedback.push({
				message: "Small for an app icon. Use 512×512 px (or an SVG).",
				tone: "warn",
			});
		}
	} else {
		if (info.shape === "tall") {
			feedback.push({
				message:
					"Tall logos get very small in the sidebar. A horizontal version works better.",
				tone: "warn",
			});
		}
		if (!isSvg && info.height < MIN_LOGO_HEIGHT) {
			feedback.push({
				message: `Low resolution: it may look blurry on sharp screens. Upload at least ${Math.round((info.width / info.height) * MIN_LOGO_HEIGHT)}×${MIN_LOGO_HEIGHT} px, or an SVG.`,
				tone: "warn",
			});
		}
	}
	if (feedback.length === 0) {
		feedback.push({ message: "Looks good.", tone: "ok" });
	}
	return feedback;
}

/**
 * Upload tile for a logo or icon: wide for logos, square for icons, on a
 * light or dark backdrop matching where it will be shown. Under it, the
 * detected size and shape plus plain-language quality checks.
 */
export default function LogoUpload({
	backdrop = "light",
	kind = "logo",
	label,
	onChange,
	value,
}: {
	/** Preview backdrop: "dark" for the dark-backgrounds logo. */
	backdrop?: "light" | "dark";
	kind?: "logo" | "icon";
	label: string;
	onChange: (url: string | null) => void;
	value: string | null;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const info = useLogoInfo(value);
	const feedback = logoFeedback(kind, info, value);
	const inputId = `logo-upload-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;

	return (
		<div className="flex flex-col gap-2">
			<div className="group/tile relative w-fit">
				<input
					accept="image/svg+xml,image/png,image/webp,image/jpeg"
					className="hidden"
					id={inputId}
					onChange={async (event) => {
						const file = event.target.files?.[0];
						if (!file) {
							return;
						}
						setUploading(true);
						try {
							onChange(await uploadAsset(file));
						} catch (error) {
							toast.error(
								error instanceof Error ? error.message : "Upload failed"
							);
						} finally {
							setUploading(false);
							event.target.value = "";
						}
					}}
					ref={inputRef}
					type="file"
				/>
				<button
					className={cn(
						"flex items-center justify-center rounded-xl border transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25",
						kind === "icon" ? "size-20" : "h-20 w-44",
						backdrop === "dark"
							? "border-white/10 bg-[#16151d]"
							: "border-input bg-background",
						!value && "border-dashed"
					)}
					disabled={uploading}
					onClick={() => inputRef.current?.click()}
					type="button"
				>
					{(() => {
						if (uploading) {
							return (
								<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
							);
						}
						if (value) {
							return (
								<img
									alt={label}
									className={
										kind === "icon"
											? "size-12 object-contain"
											: "max-h-12 max-w-36 object-contain"
									}
									height={48}
									src={value}
									width={144}
								/>
							);
						}
						return (
							<span
								className={cn(
									"flex flex-col items-center gap-1 text-xs",
									backdrop === "dark"
										? "text-white/60"
										: "text-subtle-foreground"
								)}
							>
								<ImageIcon className="size-4" />
								Upload
							</span>
						);
					})()}
					<span className="sr-only">
						{value ? `Replace ${label}` : `Upload ${label}`}
					</span>
				</button>
				{value && !uploading ? (
					<button
						aria-label={`Remove ${label}`}
						className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-xs transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/tile:opacity-100"
						onClick={() => onChange(null)}
						type="button"
					>
						<XIcon className="size-3" />
					</button>
				) : null}
			</div>
			{info && value ? (
				<div className="space-y-1 text-xs">
					<p className="text-muted-foreground">
						{SVG_URL.test(value) ? "SVG" : `${info.width} × ${info.height} px`}{" "}
						· {SHAPE_LABEL[info.shape]}
					</p>
					{feedback.map((item) => (
						<p
							className={cn(
								"flex items-start gap-1.5",
								item.tone === "ok" ? "text-success" : "text-warning"
							)}
							key={item.message}
						>
							{item.tone === "ok" ? (
								<CircleCheckIcon className="mt-px size-3.5 shrink-0" />
							) : (
								<CircleAlertIcon className="mt-px size-3.5 shrink-0" />
							)}
							{item.message}
						</p>
					))}
				</div>
			) : null}
		</div>
	);
}
