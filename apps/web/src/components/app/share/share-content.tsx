import type { FormDto } from "@StryveForms/api/lib/serialize";
import {
	applyWorkspaceBrand,
	type WorkspaceBrand,
} from "@StryveForms/forms/brand";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields } from "@StryveForms/forms/values";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@StryveForms/ui/components/alert";
import {
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogHeader,
	AlertDialog as AlertDialogRoot,
	AlertDialogTitle,
} from "@StryveForms/ui/components/alert-dialog";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangleIcon,
	CopyIcon,
	ExternalLinkIcon,
	Mail,
	RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/utils/trpc";
import { EmbedPanel } from "./embed-panel";
import { PrefillPanel } from "./prefill-panel";
import { QrPanel } from "./qr-panel";
import {
	FacebookGlyph,
	LinkedInGlyph,
	WhatsAppGlyph,
	XGlyph,
} from "./social-icons";
import { buildSocialLinks } from "./social-links";

const SOCIAL_ICONS = {
	email: Mail,
	facebook: FacebookGlyph,
	linkedin: LinkedInGlyph,
	whatsapp: WhatsAppGlyph,
	x: XGlyph,
} as const;

function copy(text: string) {
	navigator.clipboard.writeText(text);
	toast.success("Copied to clipboard");
}

/** Warns when the form isn't publicly reachable yet, with a one-click fix. */
function StatusWarning({ form }: { form: FormDto }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const publish = useMutation(
		trpc.share.publish.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.form.get.queryKey({ id: form.id }),
				});
				toast.success("Form published — the link is live");
			},
		})
	);

	const closesInPast = Boolean(
		form.closesAt && new Date(form.closesAt) < new Date()
	);
	const isDraft = form.visibility === "draft";

	if (form.visibility === "public" && !closesInPast) {
		return null;
	}

	let description =
		"It no longer accepts new responses. Publish it to reopen the link.";
	if (isDraft) {
		description =
			"Only you can see it. Publish it so the link below works for everyone.";
	} else if (closesInPast) {
		description =
			"Its closing date has passed. Update the closing date in the form's settings to reopen it.";
	}

	return (
		<Alert variant="destructive">
			<AlertTriangleIcon />
			<AlertTitle>
				{isDraft ? "This form is a draft" : "This form is closed"}
			</AlertTitle>
			<AlertDescription>{description}</AlertDescription>
			{closesInPast ? null : (
				<div className="mt-2">
					<Button
						disabled={publish.isPending}
						onClick={() => publish.mutate({ formId: form.id })}
						size="sm"
					>
						{publish.isPending ? "Publishing…" : "Publish"}
					</Button>
				</div>
			)}
		</Alert>
	);
}

/** Share link box: copy / open, plus "regenerate" behind a destructive confirm. */
function LinkSection({ form }: { form: FormDto }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const regenerate = useMutation(
		trpc.share.regenerateSlug.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: async (result) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.form.get.queryKey({ id: form.id }),
				});
				setConfirmOpen(false);
				toast.success(`New link ready: /forms/${result.slug}`);
			},
		})
	);

	return (
		<div className="space-y-3">
			<StatusWarning form={form} />
			<div className="flex flex-wrap items-center gap-2">
				<Input
					className="min-w-0 flex-1 font-mono text-xs"
					readOnly
					value={form.shareUrl}
				/>
				<Button onClick={() => copy(form.shareUrl)} variant="outline">
					<CopyIcon /> Copy
				</Button>
				<Button
					render={
						<a href={form.shareUrl} rel="noopener noreferrer" target="_blank" />
					}
					variant="outline"
				>
					<ExternalLinkIcon /> Open
				</Button>
			</div>
			<AlertDialogRoot onOpenChange={setConfirmOpen} open={confirmOpen}>
				<Button onClick={() => setConfirmOpen(true)} size="sm" variant="ghost">
					<RefreshCwIcon /> Regenerate link
				</Button>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Regenerate the share link?</AlertDialogTitle>
						<AlertDialogDescription>
							A new random link will be created. The current link ({" "}
							<span className="font-mono">{form.shareUrl}</span>) stops working
							immediately — anyone with the old link, QR code, or embed snippet
							will need the new one.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={regenerate.isPending}
							onClick={() => regenerate.mutate({ formId: form.id })}
							variant="destructive"
						>
							{regenerate.isPending ? "Working…" : "Regenerate"}
						</AlertDialogAction>
					</div>
				</AlertDialogContent>
			</AlertDialogRoot>
		</div>
	);
}

function SocialSection({ form }: { form: FormDto }) {
	const links = buildSocialLinks(form.shareUrl, form.title);
	return (
		<div className="grid gap-2 sm:grid-cols-2">
			{links.map((link) => {
				const Icon = SOCIAL_ICONS[link.id];
				return (
					<a
						className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted"
						href={link.url}
						key={link.id}
						rel="noopener noreferrer"
						target="_blank"
					>
						<span
							className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
							style={{ backgroundColor: link.bg }}
						>
							<Icon className="size-4" />
						</span>
						Share on {link.name}
					</a>
				);
			})}
		</div>
	);
}

/**
 * The full share surface: link, social, QR, prefill builder, and embed
 * snippets. Used both inside the big ShareDialog and inline on the form's
 * Share page.
 */
export function ShareContent({ form }: { form: FormDto }) {
	const trpc = useTRPC();
	const appOrigin = new URL(form.shareUrl).origin;
	const fields = answerFields(
		form.properties as FormField[],
		form.removedProperties as FormField[]
	).filter((field) => !["files", "signature", "matrix"].includes(field.type));

	// The popup embed's "use workspace style" default needs the *resolved*
	// brand colour, the same way the public form page shows it — not just
	// the form's own stored colour, which may not reflect the brand.
	const workspaceQuery = useQuery(
		trpc.workspace.get.queryOptions({ id: form.workspaceId })
	);
	const brand =
		(workspaceQuery.data?.brand as WorkspaceBrand | undefined) ?? {};
	const brandColor = applyWorkspaceBrand(
		{ color: form.color },
		{
			brandOverrides: form.brandOverrides,
			useWorkspaceBrand: form.useWorkspaceBrand,
		},
		brand
	).color;

	return (
		<div className="min-w-0 space-y-6">
			<LinkSection form={form} />

			<Tabs className="min-w-0" defaultValue="social">
				<TabsList className="flex-wrap">
					<TabsTrigger value="social">Social</TabsTrigger>
					<TabsTrigger value="qr">QR code</TabsTrigger>
					<TabsTrigger value="prefill">Prefill link</TabsTrigger>
					<TabsTrigger value="embed">Embed</TabsTrigger>
				</TabsList>
				<TabsContent className="min-w-0" value="social">
					<SocialSection form={form} />
				</TabsContent>
				<TabsContent className="min-w-0" value="qr">
					<QrPanel
						color={form.color}
						shareUrl={form.shareUrl}
						slug={form.slug}
					/>
				</TabsContent>
				<TabsContent className="min-w-0" value="prefill">
					<PrefillPanel fields={fields} shareUrl={form.shareUrl} />
				</TabsContent>
				<TabsContent className="min-w-0" value="embed">
					<EmbedPanel
						appOrigin={appOrigin}
						brandColor={brandColor}
						form={form}
					/>
				</TabsContent>
			</Tabs>

			<p className="text-center text-muted-foreground text-xs">
				Need more detail? Read the{" "}
				<a className="underline underline-offset-2" href="/docs/sharing">
					sharing &amp; embed docs
				</a>
				.
			</p>
		</div>
	);
}
