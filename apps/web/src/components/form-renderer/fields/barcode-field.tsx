import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { inputTheme } from "../theme";
import type { FieldComponentProps } from "../types";
import { toText } from "../value-utils";

/** Scans a barcode/QR code via the camera (BarcodeDetector, falling back to zxing), or lets the respondent type the code. */
export function BarcodeField({
	borderRadius,
	disabled,
	error,
	field,
	id,
	onChange,
	required,
	size,
	theme,
	value,
}: FieldComponentProps) {
	const [scanning, setScanning] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
	// An object (not a plain boolean) so Biome's narrowing doesn't treat `.stopped` as a constant.
	const stateRef = useRef<{ stopped: boolean }>({ stopped: false });

	useEffect(() => {
		if (!scanning) {
			return;
		}
		const state = stateRef.current;
		state.stopped = false;

		function stop() {
			state.stopped = true;
			zxingControlsRef.current?.stop();
			const stream = videoRef.current?.srcObject;
			if (stream instanceof MediaStream) {
				for (const track of stream.getTracks()) {
					track.stop();
				}
			}
		}

		async function detectFrame(
			detector: {
				detect: (target: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
			},
			videoEl: HTMLVideoElement
		) {
			if (state.stopped) {
				return;
			}
			try {
				const [first] = await detector.detect(videoEl);
				if (first) {
					onChange(first.rawValue);
					setScanning(false);
					return;
				}
			} catch {
				// no code in this frame; keep polling
			}
			if (!state.stopped) {
				setTimeout(() => detectFrame(detector, videoEl), 250);
			}
		}

		async function pollBarcodeDetector(videoEl: HTMLVideoElement) {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "environment" },
			});
			videoEl.srcObject = stream;
			await videoEl.play();
			// @ts-expect-error -- BarcodeDetector isn't yet in lib.dom.d.ts
			const detector = new window.BarcodeDetector({
				formats: ["qr_code", "ean_13", "ean_8", "code_128"],
			});
			detectFrame(detector, videoEl);
		}

		async function runZxing(videoEl: HTMLVideoElement) {
			const reader = new BrowserMultiFormatReader();
			zxingControlsRef.current = await reader.decodeFromVideoDevice(
				undefined,
				videoEl,
				(result) => {
					if (result && !state.stopped) {
						onChange(result.getText());
						setScanning(false);
					}
				}
			);
		}

		const currentVideo = videoRef.current;
		if (currentVideo) {
			if ("BarcodeDetector" in window) {
				pollBarcodeDetector(currentVideo);
			} else {
				runZxing(currentVideo);
			}
		}
		return stop;
	}, [scanning, onChange]);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex gap-2">
				<Input
					aria-invalid={Boolean(error)}
					className={inputTheme({
						borderRadius,
						hasError: Boolean(error),
						size,
						theme,
					})}
					disabled={disabled}
					id={id}
					onChange={(e) => onChange(e.target.value)}
					placeholder={field.placeholder || "Scan or type a code"}
					required={required}
					value={toText(value)}
				/>
				<Button
					disabled={disabled}
					onClick={() => setScanning((s) => !s)}
					type="button"
					variant="outline"
				>
					{scanning ? <X className="size-4" /> : <Camera className="size-4" />}
				</Button>
			</div>
			{scanning ? (
				<video
					className="aspect-video w-full rounded-lg bg-black"
					muted
					playsInline
					ref={videoRef}
				>
					<track kind="captions" />
				</video>
			) : null}
		</div>
	);
}
