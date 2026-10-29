import { Input } from "@StryveForms/ui/components/input";
import { Textarea } from "@StryveForms/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import LogoGuide, {
	type BrandMode,
	BrandModeSwitch,
	type BrandModeValues,
} from "@/components/app/branding/logo-guide";
import LogoPlacementPreview from "@/components/app/branding/logo-placement-preview";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { DEFAULT_HERO_SUBTITLE, DEFAULT_HERO_TITLE } from "@/lib/instance";
import { useTRPC } from "@/utils/trpc";

import { SettingsFooter, SettingsRow } from "./settings-row";

const EMPTY_BRAND: BrandModeValues = {
	faviconDarkUrl: null,
	faviconUrl: null,
	logoDarkUrl: null,
	logoUrl: null,
	primaryColor: "#7C3AED",
	primaryColorDark: null,
};

const BRAND_KEYS = Object.keys(EMPTY_BRAND) as (keyof BrandModeValues)[];

function brandFrom(data: BrandModeValues): BrandModeValues {
	return {
		faviconDarkUrl: data.faviconDarkUrl,
		faviconUrl: data.faviconUrl,
		logoDarkUrl: data.logoDarkUrl,
		logoUrl: data.logoUrl,
		primaryColor: data.primaryColor,
		primaryColorDark: data.primaryColorDark,
	};
}

export default function AdminBrandingTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const settings = useQuery(trpc.instance.get.queryOptions());

	const [name, setName] = useState("");
	const [tagline, setTagline] = useState("");
	const [brand, setBrand] = useState<BrandModeValues>(EMPTY_BRAND);
	const [mode, setMode] = useState<BrandMode>("light");
	const patchBrand = (patch: Partial<BrandModeValues>) =>
		setBrand((current) => ({ ...current, ...patch }));
	const [heroTitle, setHeroTitle] = useState("");
	const [heroSubtitle, setHeroSubtitle] = useState("");

	useEffect(() => {
		if (!settings.data) {
			return;
		}
		setName(settings.data.name);
		setTagline(settings.data.tagline ?? "");
		setBrand(brandFrom(settings.data));
		setHeroTitle(settings.data.heroTitle ?? "");
		setHeroSubtitle(settings.data.heroSubtitle ?? "");
	}, [settings.data]);

	const isDirty =
		settings.data !== undefined &&
		(name !== settings.data.name ||
			tagline !== (settings.data.tagline ?? "") ||
			BRAND_KEYS.some((key) => brand[key] !== brandFrom(settings.data)[key]) ||
			heroTitle !== (settings.data.heroTitle ?? "") ||
			heroSubtitle !== (settings.data.heroSubtitle ?? ""));

	const discard = () => {
		if (!settings.data) {
			return;
		}
		setName(settings.data.name);
		setTagline(settings.data.tagline ?? "");
		setBrand(brandFrom(settings.data));
		setHeroTitle(settings.data.heroTitle ?? "");
		setHeroSubtitle(settings.data.heroSubtitle ?? "");
	};

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

	const save = () =>
		update.mutate({
			...brand,
			heroSubtitle: heroSubtitle.trim() || null,
			heroTitle: heroTitle.trim() || null,
			name: name.trim(),
			tagline: tagline.trim() || null,
		});

	return (
		<div className="grid gap-8 xl:grid-cols-[1fr_300px]">
			<div className="min-w-0 space-y-6 pb-20">
				<div>
					<SettingsRow
						description="Shown in the browser tab and emails."
						htmlFor="admin-name"
						label="Product name"
					>
						<Input
							id="admin-name"
							onChange={(event) => setName(event.target.value)}
							value={name}
						/>
					</SettingsRow>
					<SettingsRow
						description="Shown on the sign-in screen."
						htmlFor="admin-tagline"
						label="Tagline"
					>
						<Textarea
							id="admin-tagline"
							onChange={(event) => setTagline(event.target.value)}
							value={tagline}
						/>
					</SettingsRow>
					<div className="space-y-4 border-border border-b py-6">
						<div className="flex flex-wrap items-end justify-between gap-3">
							<div className="space-y-1">
								<h3 className="font-semibold text-base">Logo, icon & colour</h3>
								<p className="text-muted-foreground text-sm">
									Set them for light mode, then adjust dark mode if needed.
									Anything you leave empty in dark mode uses the light one.
								</p>
							</div>
							<BrandModeSwitch onChange={setMode} value={mode} />
						</div>
						<LogoGuide mode={mode} onChange={patchBrand} values={brand} />
					</div>
					<SettingsRow
						description="The big line on your public sign-in page."
						htmlFor="admin-hero-title"
						label="Homepage headline"
					>
						<Input
							id="admin-hero-title"
							onChange={(event) => setHeroTitle(event.target.value)}
							placeholder={DEFAULT_HERO_TITLE}
							value={heroTitle}
						/>
					</SettingsRow>
					<SettingsRow
						description="A short supporting line underneath."
						htmlFor="admin-hero-subtitle"
						label="Homepage subheadline"
					>
						<Textarea
							id="admin-hero-subtitle"
							onChange={(event) => setHeroSubtitle(event.target.value)}
							placeholder={DEFAULT_HERO_SUBTITLE}
							value={heroSubtitle}
						/>
					</SettingsRow>
				</div>

				<SettingsFooter
					dirty={isDirty}
					onDiscard={discard}
					onSave={save}
					saveDisabled={!name.trim()}
					saving={update.isPending}
				/>
			</div>

			<div className="xl:sticky xl:top-6 xl:self-start">
				<LogoPlacementPreview
					mode={mode}
					value={{
						...brand,
						heroTitle: heroTitle || DEFAULT_HERO_TITLE,
						name: name || "StryveForms",
					}}
				/>
			</div>
		</div>
	);
}
