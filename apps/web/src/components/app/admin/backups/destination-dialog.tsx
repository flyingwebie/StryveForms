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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
	{ label: "This instance's storage", value: "server" },
	{ label: "S3-compatible service", value: "s3" },
];

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
						<Label htmlFor="dest-kind">Where to send backups</Label>
						<Select
							items={KIND_OPTIONS}
							onValueChange={(value) =>
								setForm((prev) => ({ ...prev, kind: value as "s3" | "server" }))
							}
							value={form.kind}
						>
							<SelectTrigger className="w-full" id="dest-kind">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{KIND_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
									onChange={(value) =>
										setForm((prev) => ({ ...prev, region: value }))
									}
									value={form.region}
								/>
								<FieldInput
									help={preset?.fields.bucket.help}
									id="dest-bucket"
									label="Bucket"
									onChange={(value) =>
										setForm((prev) => ({ ...prev, bucket: value }))
									}
									value={form.bucket}
								/>
							</div>
							<FieldInput
								help={preset?.fields.accessKeyId.help}
								id="dest-access-key"
								label="Access key id"
								onChange={(value) =>
									setForm((prev) => ({ ...prev, accessKeyId: value }))
								}
								value={form.accessKeyId}
							/>
							<FieldInput
								help={
									destination
										? `${preset?.fields.secretAccessKey.help ?? ""} Leave empty to keep the one already saved (currently ${destination.secretMasked ?? "unset"}).`
										: preset?.fields.secretAccessKey.help
								}
								id="dest-secret-key"
								label="Secret access key"
								onChange={(value) =>
									setForm((prev) => ({ ...prev, secretAccessKey: value }))
								}
								type="password"
								value={form.secretAccessKey}
							/>
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
						<p
							className={
								testResult.ok
									? "rounded-lg border border-border bg-muted/50 p-3 text-sm"
									: "rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
							}
						>
							{testResult.message}
						</p>
					) : null}
				</div>

				<DialogFooter>
					<Button
						disabled={test.isPending}
						onClick={handleTest}
						type="button"
						variant="outline"
					>
						{test.isPending ? "Testing…" : "Test connection"}
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
	onChange,
	placeholder,
	type = "text",
	value,
}: {
	help?: string;
	id: string;
	label: string;
	onChange: (value: string) => void;
	placeholder?: string;
	type?: string;
	value: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				type={type}
				value={value}
			/>
			{help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
		</div>
	);
}
