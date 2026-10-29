import { evaluateComputedVariables } from "@StryveForms/forms/computed";
import { resolveFieldState } from "@StryveForms/forms/logic";
import type { ComputedVariable, FormField } from "@StryveForms/forms/types";
import { splitIntoPages } from "@StryveForms/forms/types";
import { validateSubmission } from "@StryveForms/forms/validation";
import { useCallback, useMemo, useRef, useState } from "react";

export interface FieldRuntimeState {
	disabled: boolean;
	hidden: boolean;
	required: boolean;
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function initialValueFor(field: FormField): unknown {
	if (field.type === "date" && field.prefill_today && !field.date_range) {
		return todayIso();
	}
	if (field.prefill !== undefined) {
		return field.prefill;
	}
}

function buildInitialValues(
	fields: FormField[],
	overrides: Record<string, unknown> | undefined
): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const field of fields) {
		const value = initialValueFor(field);
		if (value !== undefined) {
			values[field.id] = value;
		}
	}
	return { ...values, ...overrides };
}

export interface FormEngine {
	computed: Record<string, unknown>;
	currentPage: FormField[];
	errors: Record<string, string>;
	goNext: () => boolean;
	goPrevious: () => void;
	goToPage: (index: number) => void;
	mergedContext: Record<string, unknown>;
	pageIndex: number;
	pages: FormField[][];
	reset: (values?: Record<string, unknown>) => void;
	setError: (fieldId: string, message: string | undefined) => void;
	setValue: (fieldId: string, value: unknown) => void;
	stateFor: (field: FormField) => FieldRuntimeState;
	validateAll: () => ReturnType<typeof validateSubmission>;
	values: Record<string, unknown>;
}

export function useFormEngine(
	fields: FormField[],
	computedVariables: ComputedVariable[],
	initialValues?: Record<string, unknown>
): FormEngine {
	const [values, setValues] = useState<Record<string, unknown>>(() =>
		buildInitialValues(fields, initialValues)
	);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pageIndex, setPageIndex] = useState(0);
	const fieldsRef = useRef(fields);
	fieldsRef.current = fields;

	const computed = useMemo(
		() => evaluateComputedVariables(computedVariables, values),
		[computedVariables, values]
	);
	const mergedContext = useMemo(
		() => ({ ...values, ...computed }),
		[values, computed]
	);

	const stateFor = useCallback(
		(field: FormField): FieldRuntimeState =>
			resolveFieldState(field, mergedContext),
		[mergedContext]
	);

	const pages = useMemo(
		() =>
			splitIntoPages(fields, (f) => resolveFieldState(f, mergedContext).hidden),
		[fields, mergedContext]
	);
	const currentPage = pages[pageIndex] ?? pages[0] ?? [];

	const setValue = useCallback((fieldId: string, value: unknown) => {
		setValues((prev) => ({ ...prev, [fieldId]: value }));
		setErrors((prev) => {
			if (!(fieldId in prev)) {
				return prev;
			}
			const next = { ...prev };
			delete next[fieldId];
			return next;
		});
	}, []);

	const setError = useCallback(
		(fieldId: string, message: string | undefined) => {
			setErrors((prev) => {
				if (!message) {
					if (!(fieldId in prev)) {
						return prev;
					}
					const next = { ...prev };
					delete next[fieldId];
					return next;
				}
				return { ...prev, [fieldId]: message };
			});
		},
		[]
	);

	const validateAll = useCallback(
		() => validateSubmission(fieldsRef.current, mergedContext),
		[mergedContext]
	);

	const goNext = useCallback((): boolean => {
		const pageFieldIds = currentPage.map((f) => f.id);
		const result = validateSubmission(fieldsRef.current, mergedContext, {
			onlyFieldIds: pageFieldIds,
		});
		const pageErrors = Object.fromEntries(
			Object.entries(result.errors).filter(([id]) => pageFieldIds.includes(id))
		);
		if (Object.keys(pageErrors).length > 0) {
			setErrors((prev) => ({ ...prev, ...pageErrors }));
			return false;
		}
		setPageIndex((i) => Math.min(i + 1, pages.length - 1));
		return true;
	}, [currentPage, mergedContext, pages.length]);

	const goPrevious = useCallback(() => {
		setPageIndex((i) => Math.max(i - 1, 0));
	}, []);

	const goToPage = useCallback(
		(index: number) => {
			setPageIndex(Math.max(0, Math.min(index, pages.length - 1)));
		},
		[pages.length]
	);

	const reset = useCallback((next?: Record<string, unknown>) => {
		setValues(buildInitialValues(fieldsRef.current, next));
		setErrors({});
		setPageIndex(0);
	}, []);

	return {
		computed,
		currentPage,
		errors,
		goNext,
		goPrevious,
		goToPage,
		mergedContext,
		pageIndex,
		pages,
		reset,
		setError,
		setValue,
		stateFor,
		validateAll,
		values,
	};
}

/** Input fields the focused presentation can step through (layout blocks render inline). */
export function focusableSteps(fields: FormField[]): FormField[][] {
	const steps: FormField[][] = [];
	let current: FormField[] = [];
	for (const field of fields) {
		current.push(field);
		if (field.type !== "nf-text" && field.type !== "nf-divider") {
			steps.push(current);
			current = [];
		}
	}
	if (current.length > 0) {
		steps.push(current);
	}
	return steps;
}
