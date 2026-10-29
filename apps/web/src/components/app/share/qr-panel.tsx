import { Button } from "@StryveForms/ui/components/button";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** QR code preview tinted with the form's own colour, with copy-image and PNG/SVG download. */
export function QrPanel({
	color,
	shareUrl,
	slug,
}: {
	color: string;
	shareUrl: string;
	slug: string;
}) {
	const [pngUrl, setPngUrl] = useState<string | null>(null);
	const [svgUrl, setSvgUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let svgObjectUrl: string | null = null;
		QRCode.toDataURL(shareUrl, {
			color: { dark: color, light: "#ffffffff" },
			margin: 1,
			width: 320,
		})
			.then(setPngUrl)
			.catch(() => setPngUrl(null));
		QRCode.toString(shareUrl, {
			color: { dark: color, light: "#ffffffff" },
			margin: 1,
			type: "svg",
		})
			.then((svg) => {
				svgObjectUrl = URL.createObjectURL(
					new Blob([svg], { type: "image/svg+xml" })
				);
				setSvgUrl(svgObjectUrl);
			})
			.catch(() => setSvgUrl(null));
		return () => {
			if (svgObjectUrl) {
				URL.revokeObjectURL(svgObjectUrl);
			}
		};
	}, [shareUrl, color]);

	const copyImage = async () => {
		if (!pngUrl) {
			return;
		}
		try {
			const blob = await fetch(pngUrl).then((r) => r.blob());
			await navigator.clipboard.write([
				new ClipboardItem({ "image/png": blob }),
			]);
			setCopied(true);
			toast.success("QR code copied to clipboard");
			setTimeout(() => setCopied(false), 1500);
		} catch {
			toast.error("Couldn't copy the image — try downloading it instead");
		}
	};

	return (
		<div className="flex flex-col items-start gap-6 sm:flex-row">
			{pngUrl ? (
				<img
					alt="QR code linking to the form"
					className="size-56 shrink-0 rounded-xl border border-border p-3"
					height={320}
					src={pngUrl}
					width={320}
				/>
			) : (
				<Skeleton className="size-56 shrink-0 rounded-xl" />
			)}
			<div className="flex flex-col gap-3 pt-1">
				<h2 className="font-semibold text-base">Scan to open</h2>
				<p className="max-w-sm text-muted-foreground text-sm">
					Print this code on flyers, posters, or receipts so people can open the
					form straight from their phone camera.
				</p>
				<div className="flex flex-wrap gap-2">
					<Button disabled={!pngUrl} onClick={copyImage}>
						{copied ? <CheckIcon /> : <CopyIcon />} Copy image
					</Button>
					<Button
						disabled={!pngUrl}
						render={<a download={`${slug}-qr.png`} href={pngUrl ?? "#"} />}
						variant="outline"
					>
						<DownloadIcon /> PNG
					</Button>
					<Button
						disabled={!svgUrl}
						render={<a download={`${slug}-qr.svg`} href={svgUrl ?? "#"} />}
						variant="outline"
					>
						<DownloadIcon /> SVG
					</Button>
				</div>
			</div>
		</div>
	);
}
