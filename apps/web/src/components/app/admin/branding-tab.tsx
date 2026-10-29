import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ColorPicker from "@/components/app/branding/color-picker";
import HeroPreview from "@/components/app/branding/hero-preview";
import LogoUpload from "@/components/app/branding/logo-upload";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { DEFAULT_HERO_SUBTITLE, DEFAULT_HERO_TITLE } from "@/lib/instance";
import { useTRPC } from "@/utils/trpc";

export default function AdminBrandingTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.instance.get.queryOptions());

	const [name, setName] = useState("");
	const [tagline, setTagline] = useState("");
	const [logoUrl, setLogoUrl] = useState<string | null>(null);
	const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null);
	const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
	const [primaryColor, setPrimaryColor] = useState("#7C3AED");
	const [heroTitle, setHeroTitle] = useState("");
	const [heroSubtitle, setHeroSubtitle] = useState("");

	useEffect(() => {
		if (!settings.data) {
			return;
		}
		setName(settings.data.name);
		setTagline(settings.data.tagline ?? "");
		setLogoUrl(settings.data.logoUrl);
		setLogoDarkUrl(settings.data.logoDarkUrl);
		setFaviconUrl(settings.data.faviconUrl);
		setPrimaryColor(settings.data.primaryColor);
		setHeroTitle(settings.data.heroTitle ?? "");
		setHeroSubtitle(settings.data.heroSubtitle ?? "");
	}, [settings.data]);

	const update = useMutation(
		trpc.instance.update.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.instance.public.queryKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.instance.get.queryKey(),
					}),
				]);
				toast.success("Branding updated");
			},
		})
	);

	return (
		<div className="grid gap-8 lg:grid-cols-2">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="admin-name">Product name</Label>
					<Input
						id="admin-name"
						onChange={(event) => setName(event.target.value)}
						value={name}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="admin-tagline">Tagline</Label>
					<Textarea
						id="admin-tagline"
						onChange={(event) => setTagline(event.target.value)}
						value={tagline}
					/>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<LogoUpload label="Logo" onChange={setLogoUrl} value={logoUrl} />
					<LogoUpload
						label="Logo (dark mode)"
						onChange={setLogoDarkUrl}
						value={logoDarkUrl}
					/>
				</div>
				<LogoUpload
					label="Favicon"
					onChange={setFaviconUrl}
					value={faviconUrl}
				/>
				<div className="space-y-2">
					<Label>Primary color</Label>
					<ColorPicker onChange={setPrimaryColor} value={primaryColor} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="admin-hero-title">Homepage headline</Label>
					<Input
						id="admin-hero-title"
						onChange={(event) => setHeroTitle(event.target.value)}
						placeholder={DEFAULT_HERO_TITLE}
						value={heroTitle}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="admin-hero-subtitle">Homepage subheadline</Label>
					<Textarea
						id="admin-hero-subtitle"
						onChange={(event) => setHeroSubtitle(event.target.value)}
						placeholder={DEFAULT_HERO_SUBTITLE}
						value={heroSubtitle}
					/>
				</div>
				<Button
					disabled={update.isPending || !name.trim()}
					onClick={() =>
						update.mutate({
							faviconUrl,
							heroSubtitle: heroSubtitle.trim() || null,
							heroTitle: heroTitle.trim() || null,
							logoDarkUrl,
							logoUrl,
							name: name.trim(),
							primaryColor,
							tagline: tagline.trim() || null,
						})
					}
				>
					{update.isPending ? "Saving…" : "Save branding"}
				</Button>
			</div>

			<div className="space-y-2">
				<Label>Live preview</Label>
				<HeroPreview
					value={{
						heroSubtitle: heroSubtitle || DEFAULT_HERO_SUBTITLE,
						heroTitle: heroTitle || DEFAULT_HERO_TITLE,
						logoUrl,
						name: name || "StryveForms",
						primaryColor,
					}}
				/>
			</div>
		</div>
	);
}
