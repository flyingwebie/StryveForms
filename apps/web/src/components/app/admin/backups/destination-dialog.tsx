import { Alert, AlertDescription } from "@StryveForms/ui/components/alert";
import { Button } from "@StryveForms/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@StryveForms/ui/components/dialog";
import { Input } from "@StryveForms/ui/components/input";
import { Label } from "@StryveForms/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@StryveForms/ui/components/select";
import { Switch } from "@StryveForms/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@StryveForms/ui/components/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, ExternalLinkIcon, XCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import PasswordInput from "@/components/app/auth/password-input";
import { formatTrpcError } from "@/lib/format-trpc-error";
import { useTRPC } from "@/utils/trpc";

/** The shape `backupAdmin.destinations.list` returns — the secret is always masked, never sent to the browser. */
export interface ClientDestination {
	accessKeyId?: string;
	bucket?: string;
	endpoint?: string;
	id: string;
	kind: "s3" | "server";
	label: string;
	pathStyle?: boolean;
	prefix: string;
	preset?: string;
	region?: string;
	secretMasked?: string;
}

const KIND_OPTIONS = [
	{ label: "S3-compatible", value: "s3" },
	{ label: "Instance storage", value: "server" },
] as const;

interface FormState {
	accessKeyId: string;
	bucket: string;
	endpoint: string;
	kind: "s3" | "server";
	label: string;
	pathStyle: boolean;
	prefix: string;
	preset: string;
	region: string;
	secretAccessKey: string;
}

const EMPTY_FORM: FormState = {
	accessKeyId: "",
	bucket: "",
	endpoint: "",
	kind: "server",
	label: "This instance's storage",
	pathStyle: true,
	prefix: "backups/",
	preset: "custom",
	region: "us-east-1",
	secretAccessKey: "",
};

function secretKeyHelp(
	destination: ClientDestination | null,
	presetHelp: string | undefined
): string {
	if (!destination) {
		return presetHelp ?? "";
	}
	const masked = destination.secretMasked ?? "unset";
	return `${presetHelp ?? ""} Leave empty to keep the one already saved (currently ${masked}).`;
}

/** Create or edit a backup destination. Picking a preset fills in sensible defaults and per-field help. */
export default function DestinationDialog({
	destination,
	onOpenChange,
	open,
}: {
	destination: ClientDestination | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const presets = useQuery(
		trpc.backupAdmin.destinations.presets.queryOptions()
	);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [testResult, setTestResult] = useState<{
		message: string;
		ok: boolean;
	} | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}
		setTestResult(null);
		if (destination) {
			setForm({
				accessKeyId: destination.accessKeyId ?? "",
				bucket: destination.bucket ?? "",
				endpoint: destination.endpoint ?? "",
				kind: destination.kind,
				label: destination.label,
				pathStyle: destination.pathStyle ?? true,
				prefix: destination.prefix,
				preset: destination.preset ?? "custom",
				region: destination.region ?? "",
				secretAccessKey: "",
			});
		} else {
			setForm(EMPTY_FORM);
		}
	}, [open, destination]);

	const invalidateDestinations = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.backupAdmin.destinations.list.queryKey(),
		});

	const create = useMutation(
		trpc.backupAdmin.destinations.create.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await invalidateDestinations();
				toast.success("Destination added");
				onOpenChange(false);
			},
		})
	);
	const update = useMutation(
		trpc.backupAdmin.destinations.update.mutationOptions({
			onError: (error) => toast.error(formatTrpcError(error)),
			onSuccess: async () => {
				await invalidateDestinations();
				toast.success("Destination updated");
				onOpenChange(false);
			},
		})
	);
	const test = useMutation(
		trpc.backupAdmin.destinations.test.mutationOptions({
			onError: (error) => {
				toast.error(formatTrpcError(error));
				setTestResult(null);
			},
			onSuccess: (result) => setTestResult(result),
		})
	);

	const preset = presets.data?.[form.preset as keyof typeof presets.data];
	const saving = create.isPending || update.isPending;

	function applyPreset(presetId: string) {
		const next = presets.data?.[presetId as keyof typeof presets.data];
		setForm((prev) => ({
			...prev,
			endpoint: next?.defaults.endpoint ?? prev.endpoint,
			pathStyle: next?.defaults.pathStyle ?? prev.pathStyle,
			preset: presetId,
			region: next?.defaults.region ?? prev.region,
		}));
	}

	function buildDraft() {
		return form.kind === "server"
			? ({ kind: "server", label: form.label, prefix: form.prefix } as const)
			: ({
					accessKeyId: form.accessKeyId,
					bucket: form.bucket,
					endpoint: form.endpoint,
					kind: "s3",
					label: form.label,
					pathStyle: form.pathStyle,
					prefix: form.prefix,
					preset: form.preset as never,
					region: form.region,
					secretAccessKey: form.secretAccessKey,
				} as const);
	}

	function handleTest() {
		setTestResult(null);
		if (destination && form.secretAccessKey === "") {
			test.mutate({ id: destination.id });
		} else {
			test.mutate({ draft: buildDraft() });
		}
	}

	function handleSave() {
		const draft = buildDraft();
		if (destination) {
			update.mutate({ ...draft, id: destination.id });
		} else {
			create.mutate(draft);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{destination ? "Edit destination" : "Add a backup destination"}
					</DialogTitle>
					<DialogDescription>
						Where scheduled and manual backups are sent. You can add more than
						one.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="dest-kind-s3">Where to send backups</Label>
						<Tabs
							onValueChange={(value) =>
								value &&
								setForm((prev) => ({ ...prev, kind: value as "s3" | "server" }))
							}
							value={form.kind}
						>
							<TabsList>
								{KIND_OPTIONS.map((option) => (
									<TabsTrigger
										id={`dest-kind-${option.value}`}
										key={option.value}
										value={option.value}
									>
										{option.label}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>

					<div className="space-y-2">
						<Label htmlFor="dest-label">Name</Label>
						<Input
							id="dest-label"
							onChange={(event) =>
								setForm((prev) => ({ ...prev, label: event.target.value }))
							}
							placeholder="e.g. Production R2 bucket"
							value={form.label}
						/>
					</div>

					{form.kind === "s3" ? (
						<>
							<div className="space-y-2">
								<Label htmlFor="dest-preset">Provider</Label>
								<Select
									items={Object.values(presets.data ?? {}).map((p) => ({
										label: p.label,
										value: p.id,
									}))}
									onValueChange={(value) => value && applyPreset(value)}
									value={form.preset}
								>
									<SelectTrigger className="w-full" id="dest-preset">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.values(presets.data ?? {}).map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{preset ? (
									<p className="text-muted-foreground text-xs">
										{preset.intro}
										{preset.keysUrl ? (
											<>
												{" "}
												<a
													className="inline-flex items-center gap-1 underline"
													href={preset.keysUrl}
													rel="noopener noreferrer"
													target="_blank"
												>
													Create access keys
													<ExternalLinkIcon className="size-3" />
												</a>
											</>
										) : null}
									</p>
								) : null}
							</div>

							<FieldInput
								help={preset?.fields.endpoint.help}
								id="dest-endpoint"
								label="Endpoint"
								mono
								onChange={(value) =>
									setForm((prev) => ({ ...prev, endpoint: value }))
								}
								placeholder={preset?.fields.endpoint.placeholder}
								value={form.endpoint}
							/>
							<div className="grid grid-cols-2 gap-3">
								<FieldInput
									help={preset?.fields.region.help}
									id="dest-region"
									label="Region"
									mono
									onChange={(value) =>
										setForm((prev) => ({ ...prev, region: value }))
									}
									value={form.region}
								/>
								<FieldInput
									help={preset?.fields.bucket.help}
									id="dest-bucket"
									label="Bucket"
									mono
									onChange={(value) =>
										setForm((prev) => ({ ...prev, bucket: value }))
									}
									value={form.bucket}
								/>
							</div>
							<FieldInput
								help={preset?.fields.accessKeyId.help}
								id="dest-access-key"
								label="Access key"
								mono
								onChange={(value) =>
									setForm((prev) => ({ ...prev, accessKeyId: value }))
								}
								value={form.accessKeyId}
							/>
							<div className="space-y-2">
								<Label htmlFor="dest-secret-key">Secret key</Label>
								<PasswordInput
									id="dest-secret-key"
									onChange={(value) =>
										setForm((prev) => ({ ...prev, secretAccessKey: value }))
									}
									value={form.secretAccessKey}
								/>
								<p className="text-subtle-foreground text-xs">
									{secretKeyHelp(
										destination,
										preset?.fields.secretAccessKey.help
									)}
								</p>
							</div>
							<div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
								<span className="space-y-0.5">
									<Label className="text-sm">Path-style addressing</Label>
									<p className="text-muted-foreground text-xs">
										Most self-hosted services (RustFS, MinIO) need this on. AWS
										S3 and Cloudflare R2 usually work with it off.
									</p>
								</span>
								<Switch
									checked={form.pathStyle}
									onCheckedChange={(pathStyle) =>
										setForm((prev) => ({ ...prev, pathStyle }))
									}
								/>
							</div>
						</>
					) : null}

					<FieldInput
						help="Where inside storage backups are kept. Default is fine for most setups."
						id="dest-prefix"
						label="Path prefix"
						onChange={(value) =>
							setForm((prev) => ({ ...prev, prefix: value }))
						}
						value={form.prefix}
					/>

					{testResult ? (
						<Alert variant={testResult.ok ? "default" : "destructive"}>
							{testResult.ok ? <CheckCircle2Icon /> : <XCircleIcon />}
							<AlertDescription>{testResult.message}</AlertDescription>
						</Alert>
					) : null}
				</div>

				<DialogFooter>
					<Button
						disabled={test.isPending}
						onClick={handleTest}
						type="button"
						variant="outline"
					>
						{test.isPending ? "Testing…" : "Test"}
					</Button>
					<Button disabled={saving} onClick={handleSave} type="button">
						{saving ? "Saving…" : "Save destination"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** One labeled input with a one-line plain-language help text underneath. */
function FieldInput({
	help,
	id,
	label,
	mono,
	onChange,
	placeholder,
	type = "text",
	value,
}: {
	help?: string;
	id: string;
	label: string;
	mono?: boolean;
	onChange: (value: string) => void;
	placeholder?: string;
	type?: string;
	value: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				className={mono ? "font-mono" : undefined}
				id={id}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				type={type}
				value={value}
			/>
			{help ? <p className="text-subtle-foreground text-xs">{help}</p> : null}
		</div>
	);
}
