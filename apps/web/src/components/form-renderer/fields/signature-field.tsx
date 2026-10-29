import { Button } from "@StryveForms/ui/components/button";
import { useEffect, useId, useRef, useState } from "react";
import SignaturePad from "signature_pad";
import type { FieldComponentProps } from "../types";
import { FilesField } from "./files-field";

/** Draws a signature on a canvas (signature_pad) and stores it as a PNG data URL. */
function DrawnSignature({
	borderRadius,
	disabled,
	error,
	field,
	id,
	onChange,
	size,
	theme,
	value,
}: FieldComponentProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const padRef = useRef<SignaturePad | null>(null);
	const [uploadInstead, setUploadInstead] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the pad reads `value` only once, to seed the canvas on mount; it is not re-synced on every keystroke
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		const ratio = Math.max(window.devicePixelRatio || 1, 1);
		canvas.width = canvas.offsetWidth * ratio;
		canvas.height = canvas.offsetHeight * ratio;
		canvas.getContext("2d")?.scale(ratio, ratio);
		const pad = new SignaturePad(canvas, { penColor: "black" });
		if (typeof value === "string" && value.startsWith("data:")) {
			pad.fromDataURL(value);
		}
		pad.addEventListener("endStroke", () =>
			onChange(pad.toDataURL("image/png"))
		);
		padRef.current = pad;
		if (disabled) {
			pad.off();
		}
		return () => pad.off();
	}, [disabled, onChange]);

	if (uploadInstead) {
		return (
			<div className="flex flex-col gap-2">
				<FilesField
					borderRadius={borderRadius}
					disabled={disabled}
					error={error}
					field={{ ...field, multiple: false }}
					formSlug={field.id}
					id={id}
					onChange={onChange}
					presentation="classic"
					required={false}
					size={size}
					theme={theme}
					value={value}
				/>
				<Button
					onClick={() => setUploadInstead(false)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Draw a signature instead
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<canvas
				aria-invalid={Boolean(error)}
				aria-label={field.name}
				className="h-40 w-full rounded-lg border border-neutral-300 bg-white dark:border-neutral-600"
				id={id}
				ref={canvasRef}
			/>
			<div className="flex gap-2">
				<Button
					disabled={disabled}
					onClick={() => {
						padRef.current?.clear();
						onChange(undefined);
					}}
					size="sm"
					type="button"
					variant="outline"
				>
					Clear
				</Button>
				<Button
					disabled={disabled}
					onClick={() => setUploadInstead(true)}
					size="sm"
					type="button"
					variant="ghost"
				>
					Upload a file instead
				</Button>
			</div>
		</div>
	);
}

export function SignatureField(props: FieldComponentProps) {
	const fallbackId = useId();
	return <DrawnSignature key={fallbackId} {...props} />;
}
