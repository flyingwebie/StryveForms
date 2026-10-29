import type { PdfZone } from "@StryveForms/api/services/pdf/model";
import type { FormField } from "@StryveForms/forms/types";
import { answerFields, isFileField } from "@StryveForms/forms/values";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { apiBase } from "@/lib/api-url";
import type { RouterOutputs } from "@/utils/trpc";
import { useTRPC } from "@/utils/trpc";

import type { PaletteVariable } from "./field-palette";
import PageCanvas from "./page-canvas";
import ThumbnailsPanel from "./thumbnails-panel";
import EditorToolbar from "./toolbar";
import {
	clamp,
	createZone,
	type PdfTemplateDraft,
	staticLabelFieldMatch,
	ZONE_TYPE_LABELS,
} from "./types";
import { META_LABELS } from "./zone-inspector";
import ZonesPanel from "./zones-panel";

type TemplateRow = RouterOutputs["pdf"]["get"];
type FormRow = RouterOutputs["form"]["get"];

const MAX_HISTORY = 50;

function draftFromTemplate(template: TemplateRow): PdfTemplateDraft {
	return {
		enabled: template.enabled,
		filenamePattern: template.filenamePattern,
		name: template.name,
		pages: template.pages as PdfTemplateDraft["pages"],
		settings: template.settings as Record<string, unknown>,
		zones: template.zones as PdfZone[],
	};
}

const STRIP_TAGS = /<[^>]+>/g;

/**
 * A short, readable label for a zone in the list and on the canvas. Zones
 * bound to the same field (an auto-generated label + answer pair, or a
 * manually paired checkbox/signature/image) are suffixed so they read as
 * "Name · label" / "Name · answer" instead of two identical "Name" rows.
 */
function labelForZone(zone: PdfZone, fields: FormField[]): string {
	const field = zone.fieldId
		? fields.find((f) => f.id === zone.fieldId)
		: undefined;
	switch (zone.type) {
		case "field":
			return field ? `${field.name} · answer` : ZONE_TYPE_LABELS.field;
		case "checkbox":
			return field ? `${field.name} · checkmark` : ZONE_TYPE_LABELS.checkbox;
		case "signature":
			return field ? `${field.name} · signature` : ZONE_TYPE_LABELS.signature;
		case "image":
			return field ? `${field.name} · image` : ZONE_TYPE_LABELS.image;
		case "static": {
			const labelFor = staticLabelFieldMatch(zone, fields);
			if (labelFor) {
				return `${labelFor.name} · label`;
			}
			const text = (zone.content ?? "").replace(STRIP_TAGS, "").trim();
			return text || "Static text";
		}
		case "meta":
			return zone.metaKey ? META_LABELS[zone.metaKey] : ZONE_TYPE_LABELS.meta;
		case "link": {
			const text = (zone.content ?? "").replace(STRIP_TAGS, "").trim();
			return text || ZONE_TYPE_LABELS.link;
		}
		default:
			return ZONE_TYPE_LABELS[zone.type];
	}
}

/** Full-screen PDF template editor: thumbnails, zoomable canvas, zones list + inspector. */
export default function PdfTemplateEditor({
	form,
	template,
}: {
	form: FormRow;
	template: TemplateRow;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [draft, setDraft] = useState<PdfTemplateDraft>(() =>
		draftFromTemplate(template)
	);
	const [original, setOriginal] = useState(draft);
	const historyRef = useRef<PdfTemplateDraft[]>([]);
	const [canUndo, setCanUndo] = useState(false);
	const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
	const [pageIndex, setPageIndex] = useState(0);
	const [previewSubmissionId, setPreviewSubmissionId] = useState<string | null>(
		null
	);

	const fields = answerFields(
		form.properties as FormField[],
		form.removedProperties as FormField[]
	);
	const hasSource = Boolean(template.sourceFileKey);
	const dirty = JSON.stringify(draft) !== JSON.stringify(original);

	const submissionsQuery = useQuery(
		trpc.submission.list.queryOptions({ formId: form.id, perPage: 20 })
	);

	function beginEdit() {
		historyRef.current = [
			...historyRef.current.slice(-(MAX_HISTORY - 1)),
			draft,
		];
		setCanUndo(true);
	}

	function undo() {
		const previous = historyRef.current.pop();
		if (!previous) {
			return;
		}
		setCanUndo(historyRef.current.length > 0);
		setDraft(previous);
	}

	function updateZone(id: string, patch: Partial<PdfZone>) {
		beginEdit();
		setDraft((d) => ({
			...d,
			zones: d.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
		}));
	}

	function replaceZoneLive(zone: PdfZone) {
		// Dragging/resizing already called beginEdit() once at gesture start.
		setDraft((d) => ({
			...d,
			zones: d.zones.map((z) => (z.id === zone.id ? zone : z)),
		}));
	}

	function addZoneObject(zone: PdfZone) {
		beginEdit();
		setDraft((d) => ({ ...d, zones: [...d.zones, zone] }));
		setSelectedZoneId(zone.id);
	}

	function addZone(type: PdfZone["type"]) {
		addZoneObject(createZone(type, pageIndex));
	}

	/** Staggers repeated palette placements down the page instead of stacking them exactly on top of each other. */
	function nextPaletteY(): number {
		const onPage = draft.zones.filter((z) => z.page === pageIndex).length;
		return clamp(0.08 + (onPage % 10) * 0.05, 0, 0.85);
	}

	/** "Form fields" palette: click a field to drop a zone sized/typed for it (signature, a file-backed image, a checkbox, or a plain answer). */
	function addZoneForField(field: FormField) {
		let type: PdfZone["type"] = "field";
		if (field.type === "signature") {
			type = "signature";
		} else if (isFileField(field)) {
			type = "image";
		} else if (field.type === "checkbox") {
			type = "checkbox";
		}
		addZoneObject({
			...createZone(type, pageIndex),
			fieldId: field.id,
			y: nextPaletteY(),
		});
	}

	/** "Form fields" palette: click a variable (submission id/date, form title, generation date, page number). */
	function addVariableZone(kind: PaletteVariable) {
		if (kind === "pagenumber") {
			addZoneObject(createZone("pagenumber", pageIndex));
			return;
		}
		addZoneObject({
			...createZone("meta", pageIndex),
			metaKey: kind,
			y: nextPaletteY(),
		});
	}

	/** Selecting a zone from the list should also jump to its page, so it's actually visible (and highlighted) on the canvas. */
	function selectZoneFromList(id: string) {
		const zone = draft.zones.find((z) => z.id === id);
		if (zone) {
			setPageIndex(zone.page);
		}
		setSelectedZoneId(id);
	}

	function deleteZone(id: string) {
		beginEdit();
		setDraft((d) => ({ ...d, zones: d.zones.filter((z) => z.id !== id) }));
		setSelectedZoneId((current) => (current === id ? null : current));
	}

	function addPage() {
		beginEdit();
		setDraft((d) => {
			const last = d.pages.at(-1);
			return last ? { ...d, pages: [...d.pages, { ...last }] } : d;
		});
	}

	function removePage(index: number) {
		if (draft.pages.length <= 1) {
			return;
		}
		beginEdit();
		setDraft((d) => ({
			...d,
			pages: d.pages.filter((_, i) => i !== index),
			zones: d.zones
				.filter((z) => z.page !== index)
				.map((z) => (z.page > index ? { ...z, page: z.page - 1 } : z)),
		}));
		setPageIndex((current) => Math.min(current, draft.pages.length - 2));
	}

	// Arrow-key nudge for the selected zone, ignored while typing in a form control.
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (!selectedZoneId) {
				return;
			}
			const tag = (event.target as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
				return;
			}
			const delta = event.shiftKey ? 0.02 : 0.005;
			const deltas: Record<string, [number, number]> = {
				ArrowDown: [0, delta],
				ArrowLeft: [-delta, 0],
				ArrowRight: [delta, 0],
				ArrowUp: [0, -delta],
			};
			const move = deltas[event.key];
			if (!move) {
				return;
			}
			event.preventDefault();
			const zone = draft.zones.find((z) => z.id === selectedZoneId);
			if (!zone) {
				return;
			}
			const patch = {
				x: Math.min(1 - zone.w, Math.max(0, zone.x + move[0])),
				y: Math.min(1 - zone.h, Math.max(0, zone.y + move[1])),
			};
			historyRef.current = [
				...historyRef.current.slice(-(MAX_HISTORY - 1)),
				draft,
			];
			setCanUndo(true);
			setDraft((d) => ({
				...d,
				zones: d.zones.map((z) =>
					z.id === selectedZoneId ? { ...z, ...patch } : z
				),
			}));
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [selectedZoneId, draft]);

	const save = useMutation(
		trpc.pdf.update.mutationOptions({
			onError: (error) => toast.error(error.message),
			onSuccess: () => {
				setOriginal(draft);
				queryClient.invalidateQueries({ queryKey: trpc.pdf.list.queryKey() });
				queryClient.invalidateQueries({
					queryKey: trpc.pdf.get.queryKey({ id: template.id }),
				});
				toast.success("Template saved");
			},
		})
	);

	async function handleSave() {
		await save.mutateAsync({ id: template.id, ...draft });
	}

	async function handlePreview() {
		if (dirty) {
			await handleSave();
		}
		const params = previewSubmissionId
			? `?submissionId=${previewSubmissionId}`
			: "";
		window.open(
			`${apiBase()}/api/pdf/${template.id}/preview${params}`,
			"_blank"
		);
	}

	const selectedZone = draft.zones.find((z) => z.id === selectedZoneId) ?? null;
	const currentPage = draft.pages[pageIndex] ?? draft.pages[0];

	if (!currentPage) {
		return null;
	}

	return (
		<div className="flex h-svh flex-col">
			<EditorToolbar
				canUndo={canUndo}
				dirty={dirty}
				formId={form.id}
				name={draft.name}
				onNameChange={(name) => setDraft((d) => ({ ...d, name }))}
				onPreview={handlePreview}
				onPreviewSubmissionChange={setPreviewSubmissionId}
				onSave={handleSave}
				onUndo={undo}
				previewSubmissionId={previewSubmissionId}
				saving={save.isPending}
				submissions={submissionsQuery.data?.items ?? []}
			/>
			<div className="flex flex-1 overflow-hidden">
				<ThumbnailsPanel
					canEditPages={!hasSource}
					currentPage={pageIndex}
					onAddPage={addPage}
					onRemovePage={removePage}
					onSelectPage={setPageIndex}
					pages={draft.pages}
				/>
				<div className="flex-1 overflow-auto bg-muted/30 p-8">
					<PageCanvas
						hasSource={hasSource}
						labelForZone={(zone) => labelForZone(zone, fields)}
						onBeginEdit={beginEdit}
						onDeselect={() => setSelectedZoneId(null)}
						onSelectZone={setSelectedZoneId}
						onZoneChange={replaceZoneLive}
						page={currentPage}
						pageIndex={pageIndex}
						selectedZoneId={selectedZoneId}
						templateId={template.id}
						zones={draft.zones}
					/>
				</div>
				<ZonesPanel
					fields={fields}
					labelForZone={(zone) => labelForZone(zone, fields)}
					onAddField={addZoneForField}
					onAddVariable={addVariableZone}
					onAddZone={addZone}
					onDeleteZone={deleteZone}
					onSelectZone={selectZoneFromList}
					onUpdateZone={updateZone}
					pageCount={draft.pages.length}
					selectedZone={selectedZone}
					selectedZoneId={selectedZoneId}
					workspaceId={form.workspaceId}
					zones={draft.zones}
				/>
			</div>
		</div>
	);
}
