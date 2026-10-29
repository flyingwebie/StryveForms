import { Button } from "@StryveForms/ui/components/button";
import {
	MonitorIcon,
	MoonIcon,
	SmartphoneIcon,
	SunIcon,
	SunMoonIcon,
} from "lucide-react";
import { useEditor } from "../state/editor-context";
import type { PreviewScheme } from "../types";

/**
 * Edit/Preview + Desktop/Mobile segmented controls, centred in the top bar.
 * Kept as its own component (rather than inlined in `TopBar`) since the
 * canvas mode and preview width it drives are canvas concerns.
 */
export function CanvasToolbar() {
	const { setCanvasMode, setPreviewScheme, setPreviewWidth, state } =
		useEditor();
	const { canvasMode, previewScheme, previewWidth } = state;

	return (
		<div className="flex items-center gap-2">
			<div className="flex items-center gap-0.5 rounded-lg border bg-subtle p-0.5">
				<Button
					className="rounded-md px-3"
					onClick={() => setCanvasMode("edit")}
					size="sm"
					type="button"
					variant={canvasMode === "edit" ? "secondary" : "ghost"}
				>
					Edit
				</Button>
				<Button
					className="rounded-md px-3"
					onClick={() => setCanvasMode("preview")}
					size="sm"
					type="button"
					variant={canvasMode === "preview" ? "secondary" : "ghost"}
				>
					Preview
				</Button>
			</div>
			<div className="flex items-center gap-0.5 rounded-lg border bg-subtle p-0.5">
				<Button
					className="rounded-md"
					onClick={() => setPreviewWidth("desktop")}
					size="icon-sm"
					title="Desktop width"
					type="button"
					variant={previewWidth === "desktop" ? "secondary" : "ghost"}
				>
					<MonitorIcon />
				</Button>
				<Button
					className="rounded-md"
					onClick={() => setPreviewWidth("mobile")}
					size="icon-sm"
					title="Mobile width"
					type="button"
					variant={previewWidth === "mobile" ? "secondary" : "ghost"}
				>
					<SmartphoneIcon />
				</Button>
			</div>
			{canvasMode === "preview" ? (
				<div className="flex items-center gap-0.5 rounded-lg border bg-subtle p-0.5">
					{SCHEMES.map(({ icon: Icon, label, value }) => (
						<Button
							aria-label={label}
							aria-pressed={previewScheme === value}
							className="rounded-md"
							key={value}
							onClick={() => setPreviewScheme(value)}
							size="icon-sm"
							title={label}
							type="button"
							variant={previewScheme === value ? "secondary" : "ghost"}
						>
							<Icon />
						</Button>
					))}
				</div>
			) : null}
		</div>
	);
}

/** Preview-only colour scheme: the form's own setting, or forced light/dark to check both. */
const SCHEMES: {
	icon: typeof SunIcon;
	label: string;
	value: PreviewScheme;
}[] = [
	{
		icon: SunMoonIcon,
		label: "Preview: form's dark mode setting",
		value: "auto",
	},
	{ icon: SunIcon, label: "Preview in light mode", value: "light" },
	{ icon: MoonIcon, label: "Preview in dark mode", value: "dark" },
];
