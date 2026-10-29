import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import ColorPicker from "@/components/app/branding/color-picker";
import HeroPreview from "@/components/app/branding/hero-preview";
import LogoUpload from "@/components/app/branding/logo-upload";
import { DEFAULT_HERO_SUBTITLE, DEFAULT_HERO_TITLE } from "@/lib/instance";
import { useTRPC } from "@/utils/trpc";

/** Step 2: name, tagline, logo and primary color, with a live preview. */
export default function SetupStepBranding({
	onBack,
	onDone,
}: {
	onBack: () => void;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [name, setName] = useState("StryveForms");
	const [tagline, setTagline] = useState("");
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [primaryColor, setPrimaryColor] = useState("#7C3AED");

	const update = useMutation(
		trpc.instance.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.instance.public.queryKey(),
				});
				onDone();
			},
		})
	);

	return (
		<div className="space-y-6">
			<div className="grid gap-8 lg:grid-cols-[1fr_320px]">
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="setup-name">Product name</Label>
						<Input
							id="setup-name"
							onChange={(event) => setName(event.target.value)}
							value={name}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="setup-tagline">Tagline (optional)</Label>
						<Textarea
							id="setup-tagline"
							onChange={(event) => setTagline(event.target.value)}
							placeholder="A short line about your team or product"
							value={tagline}
						/>
					</div>
					<div className="space-y-2">
						<Label>Logo</Label>
						<LogoUpload label="Logo" onChange={setLogoUrl} value={logoUrl} />
						<p className="text-muted-foreground text-xs">
							Your full logo on a transparent background. A horizontal wordmark
							works best and replaces the product name in the app. SVG, or PNG
							at least 360×72 px. You can add a dark-mode version and a square
							app icon later in Admin → Branding.
						</p>
					</div>
					<div className="space-y-2">
						<Label>Primary color</Label>
						<ColorPicker onChange={setPrimaryColor} value={primaryColor} />
					</div>
				</div>

				<div className="space-y-2">
					<p className="text-muted-foreground text-xs">Live preview</p>
					<HeroPreview
						value={{
							heroSubtitle: tagline || DEFAULT_HERO_SUBTITLE,
							heroTitle: DEFAULT_HERO_TITLE,
							logoUrl,
							name: name || "StryveForms",
							primaryColor,
						}}
					/>
				</div>
			</div>

			<div className="flex justify-between">
				<Button onClick={onBack} type="button" variant="outline">
					Back
				</Button>
				<Button
					disabled={update.isPending || !name.trim()}
					onClick={() =>
						update.mutate({
							logoUrl,
							name: name.trim(),
							primaryColor,
							tagline: tagline.trim() || null,
						})
					}
					type="button"
				>
					{update.isPending ? "Saving…" : "Continue"}
				</Button>
			</div>
		</div>
	);
}
