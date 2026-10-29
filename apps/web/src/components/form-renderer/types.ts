import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import type { FormField } from "@StryveForms/forms/types";

/** `live`: real submissions go to the API. `preview`: nothing leaves the browser. */
export type RendererMode = "live" | "preview";

export type FormValues = Record<string, unknown>;

export interface SubmitOutcome {
	completionTime?: number;
	data: FormValues;
	redirectUrl?: string | null;
	submissionId?: string;
}

export interface FormRendererProps {
	/** Auto-submits the form once prefilled values pass validation (`?auto_submit=true`). */
	autoSubmit?: boolean;
	className?: string;
	/** Rendering inside an iframe/popup embed (`?embed=1`): drops the full-viewport
	 * min-height so the host page's auto-resize can shrink the iframe down to fit. */
	embed?: boolean;
	/** Form title / fields / theme / settings — the public DTO served by `public.form`. */
	form: PublicFormDto;
	/** Extra values applied once on mount, before any answer (URL prefill, edit-submission data). */
	initialValues?: FormValues;
	mode: RendererMode;
	/** Called after every successful partial submission (autosave to the server). */
	onPartialSaved?: (submissionId: string) => void;
	/** Called after a successful final (non-partial) submission. */
	onSubmitted?: (outcome: SubmitOutcome) => void;
	/** The submission being edited, when arriving via `?submission_id=`. */
	submissionId?: string | null;
	/** UTM / click-id params collected by the page, forwarded to `public.submit`. */
	tracking?: Record<string, unknown>;
}

export interface FieldComponentProps {
	borderRadius: PublicFormDto["borderRadius"];
	disabled: boolean;
	error?: string;
	field: FormField;
	/** The form's slug, needed by fields that upload to `/api/uploads` (files, signature, url). */
	formSlug: string;
	id: string;
	onChange: (value: unknown) => void;
	presentation: "classic" | "focused";
	required: boolean;
	size: PublicFormDto["size"];
	theme: PublicFormDto["theme"];
	value: unknown;
}

export interface RenderClasses {
	control: string;
	error: string;
	help: string;
	label: string;
}
