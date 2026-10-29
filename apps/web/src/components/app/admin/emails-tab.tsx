import type { EmailTemplateId } from "@StryveForms/emails/preview";
import type { EmailSettings } from "@StryveForms/emails/settings";
import { DEFAULT_EMAIL_SETTINGS } from "@StryveForms/emails/settings";
import { Button } from "@StryveForms/ui/components/button";
import { Input } from "@StryveForms/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Skeleton } from "@StryveForms/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MonitorIcon, MoonIcon, SmartphoneIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";
import EmailSettingsForm from "./emails/email-settings-form";
import { SettingsFooter } from "./settings-row";

const DEBOUNCE_MS = 300;
const PREVIEW_WIDTH = { desktop: 640, mobile: 375 } as const;

export default function AdminEmailsTab() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();

	const settingsQuery = useQuery(trpc.instance.emailSettings.queryOptions());
	const templatesQuery = useQuery(trpc.instance.emailTemplates.queryOptions());
	const instanceQuery = useQuery(trpc.instance.get.queryOptions());

	const [draft, setDraft] = useState<EmailSettings | null>(null);
	const [debounced, setDebounced] = useState<EmailSettings | null>(null);
	const [template, setTemplate] = useState<EmailTemplateId>(
		"submission-notification"
	);
	const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
	const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");
	const [testTo, setTestTo] = useState("");

	useEffect(() => {
		if (settingsQuery.data && draft === null) {
			setDraft(settingsQuery.data);
			setDebounced(settingsQuery.data);
		}
	}, [settingsQuery.data, draft]);

	useEffect(() => {
		if (!draft) {
			return;
		}
		const id = setTimeout(() => setDebounced(draft), DEBOUNCE_MS);
		return () => clearTimeout(id);
	}, [draft]);

	const previewQuery = useQuery({
		...trpc.instance.emailPreview.queryOptions({
			colorScheme,
			settings: debounced ?? undefined,
			template,
		}),
		enabled: Boolean(debounced),
	});

	const isDirty =
		draft !== null &&
		settingsQuery.data !== undefined &&
		JSON.stringify(draft) !== JSON.stringify(settingsQuery.data);

	const update = useMutation(
		trpc.instance.updateEmailSettings.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async (saved) => {
				await queryClient.invalidateQueries({
					queryKey: trpc.instance.emailSettings.queryKey(),
				});
				setDraft(saved);
				setDebounced(saved);
				toast.success("Email settings saved");
			},
		})
	);

	const sendTest = useMutation(
		trpc.instance.sendTestEmail.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: (result) => toast.success(result.message),
		})
	);

	if (!draft) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}

	const discard = () => {
		if (settingsQuery.data) {
			setDraft(settingsQuery.data);
			setDebounced(settingsQuery.data);
		}
	};

	const resetToDefaults = () =>
		setDraft({
			...DEFAULT_EMAIL_SETTINGS,
			accentColor:
				instanceQuery.data?.primaryColor ?? DEFAULT_EMAIL_SETTINGS.accentColor,
			logoUrl: instanceQuery.data?.logoUrl ?? null,
		});

	const to = testTo.trim() || session?.user?.email || "you@yourcompany.com";
	const from = `${instanceQuery.data?.name || "StryveForms"} <no-reply@yourdomain.com>`;

	return (
		<div className="grid gap-8 pb-20 lg:grid-cols-2">
			<div className="space-y-6">
				<EmailSettingsForm onChange={setDraft} value={draft} />
				<SettingsFooter
					dirty={isDirty}
					leading={
						<Button onClick={resetToDefaults} type="button" variant="ghost">
							Reset to defaults
						</Button>
					}
					onDiscard={discard}
					onSave={() => update.mutate(draft)}
					saving={update.isPending}
				/>
			</div>

			<div className="space-y-3 self-start lg:sticky lg:top-6">
				<p className="font-medium text-subtle-foreground text-xs uppercase tracking-wide">
					Live preview
				</p>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<Select
						items={(templatesQuery.data ?? []).map((t) => ({
							label: t.name,
							value: t.id,
						}))}
						onValueChange={(v) => v && setTemplate(v as EmailTemplateId)}
						value={template}
					>
						<SelectTrigger className="w-64">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(templatesQuery.data ?? []).map((t) => (
								<SelectItem key={t.id} value={t.id}>
									{t.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<div className="flex items-center gap-1">
						<div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
							<Button
								onClick={() => setColorScheme("light")}
								size="icon-sm"
								title="Preview in light mode"
								variant={colorScheme === "light" ? "secondary" : "ghost"}
							>
								<SunIcon />
							</Button>
							<Button
								disabled={draft.emailDarkMode === "light-only"}
								onClick={() => setColorScheme("dark")}
								size="icon-sm"
								title={
									draft.emailDarkMode === "light-only"
										? "Dark mode support is turned off for this instance"
										: "Preview in dark mode"
								}
								variant={colorScheme === "dark" ? "secondary" : "ghost"}
							>
								<MoonIcon />
							</Button>
						</div>
						<div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
							<Button
								onClick={() => setWidth("desktop")}
								size="icon-sm"
								variant={width === "desktop" ? "secondary" : "ghost"}
							>
								<MonitorIcon />
							</Button>
							<Button
								onClick={() => setWidth("mobile")}
								size="icon-sm"
								variant={width === "mobile" ? "secondary" : "ghost"}
							>
								<SmartphoneIcon />
							</Button>
						</div>
					</div>
				</div>

				<div
					className="mx-auto overflow-hidden rounded-xl border border-border"
					style={{ maxWidth: PREVIEW_WIDTH[width] }}
				>
					<div className="space-y-1 border-border border-b bg-muted/30 p-3 text-xs">
						<p>
							<span className="text-muted-foreground">From: </span>
							{from}
						</p>
						<p>
							<span className="text-muted-foreground">To: </span>
							{to}
						</p>
						<p>
							<span className="text-muted-foreground">Subject: </span>
							{previewQuery.data?.subject ?? "…"}
						</p>
						<p className="text-muted-foreground">
							{previewQuery.data?.preheader}
						</p>
					</div>
					{previewQuery.data ? (
						<iframe
							className="h-[min(560px,calc(100svh-20rem))] w-full border-0"
							key={colorScheme}
							sandbox=""
							srcDoc={previewQuery.data.html}
							title="Email preview"
						/>
					) : (
						<Skeleton className="h-[560px] w-full rounded-none" />
					)}
				</div>

				<div className="flex items-center gap-2 rounded-lg border border-border p-3">
					<Input
						aria-label="Send test email to"
						onChange={(e) => setTestTo(e.target.value)}
						placeholder={session?.user?.email || "you@yourcompany.com"}
						type="email"
						value={testTo}
					/>
					<Button
						disabled={sendTest.isPending}
						onClick={() =>
							sendTest.mutate({
								settings: draft,
								template,
								to: testTo.trim() || undefined,
							})
						}
						variant="outline"
					>
						{sendTest.isPending ? "Sending…" : "Send test email"}
					</Button>
				</div>
				<p className="text-subtle-foreground text-xs">
					Sends the current draft (unsaved changes included) using this
					template's sample data. If SMTP isn't configured, it's logged on the
					server instead of delivered.
				</p>
			</div>
		</div>
	);
}
