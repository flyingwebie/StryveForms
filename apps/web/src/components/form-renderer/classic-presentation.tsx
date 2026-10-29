import type { PublicFormDto } from "@StryveForms/api/lib/serialize";
import { resolveMentions } from "@StryveForms/forms/mentions";
import { Progress } from "@StryveForms/ui/components/progress";
import { FieldRenderer } from "./field-renderer";
import type { FormDictionary } from "./i18n";
import { outlineButtonTheme, submitButtonTheme } from "./theme";
import type { FormEngine } from "./use-form-engine";

export interface ClassicPresentationProps {
	dict: FormDictionary;
	disabled: boolean;
	engine: FormEngine;
	form: PublicFormDto;
	formSlug: string;
	onSubmit: () => void;
	submitting: boolean;
}

/** Page-based layout: a 12-col grid per page, prev/next navigation, optional progress bar. */
export function ClassicPresentation({
	disabled,
	dict,
	engine,
	form,
	formSlug,
	onSubmit,
	submitting,
}: ClassicPresentationProps) {
	const {
		currentPage,
		errors,
		goNext,
		goPrevious,
		mergedContext,
		pageIndex,
		pages,
		setValue,
		stateFor,
	} = engine;
	const isLastPage = pageIndex === pages.length - 1;
	const pageBreak = currentPage.find((f) => f.type === "nf-page-break");
	const nextLabel = pageBreak?.next_btn_text || dict.next;
	const previousLabel = pageBreak?.previous_btn_text || dict.previous;

	return (
		<div className="flex flex-col gap-6">
			{form.showProgressBar && pages.length > 1 ? (
				<Progress value={((pageIndex + 1) / pages.length) * 100} />
			) : null}
			<div className="grid grid-cols-12 gap-x-4 gap-y-5">
				{currentPage.map((field) => {
					const state = stateFor(field);
					return (
						<FieldRenderer
							borderRadius={form.borderRadius}
							disabled={disabled || state.disabled}
							error={errors[field.id]}
							field={field}
							formSlug={formSlug}
							hidden={state.hidden}
							key={field.id}
							mentionValues={mergedContext}
							onChange={(value) => setValue(field.id, value)}
							presentation="classic"
							required={state.required}
							size={form.size}
							theme={form.theme}
							uppercaseLabels={form.uppercaseLabels}
							value={engine.values[field.id]}
						/>
					);
				})}
			</div>
			<div className="flex items-center justify-between gap-3">
				{pageIndex > 0 ? (
					<button
						className={outlineButtonTheme()}
						disabled={disabled || submitting}
						onClick={goPrevious}
						type="button"
					>
						{resolveMentions(previousLabel, mergedContext) || previousLabel}
					</button>
				) : (
					<span />
				)}
				{isLastPage ? (
					<button
						className={submitButtonTheme()}
						disabled={disabled || submitting}
						onClick={onSubmit}
						type="button"
					>
						{submitting
							? dict.submitting
							: form.submitButtonText || dict.submit}
					</button>
				) : (
					<button
						className={submitButtonTheme()}
						disabled={disabled}
						onClick={goNext}
						type="button"
					>
						{resolveMentions(nextLabel, mergedContext) || nextLabel}
					</button>
				)}
			</div>
		</div>
	);
}
