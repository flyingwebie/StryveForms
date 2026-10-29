import type { FormField } from "@StryveForms/forms/types";
import type { ReactElement } from "react";
import { FieldWrapper } from "./field-wrapper";
import { BarcodeField } from "./fields/barcode-field";
import { CheckboxField } from "./fields/checkbox-field";
import { DateField } from "./fields/date-field";
import { EmailField } from "./fields/email-field";
import { FilesField } from "./fields/files-field";
import { LayoutAudio } from "./fields/layout-audio";
import { LayoutCode } from "./fields/layout-code";
import { LayoutDivider } from "./fields/layout-divider";
import { LayoutImage } from "./fields/layout-image";
import { LayoutText } from "./fields/layout-text";
import { LayoutVideo } from "./fields/layout-video";
import { MatrixField } from "./fields/matrix-field";
import { MultiSelectField } from "./fields/multi-select-field";
import { NumberField } from "./fields/number-field";
import { PaymentField } from "./fields/payment-field";
import { PhoneField } from "./fields/phone-field";
import { RatingField } from "./fields/rating-field";
import { RichTextField } from "./fields/rich-text-field";
import { ScaleField } from "./fields/scale-field";
import { SelectField } from "./fields/select-field";
import { SignatureField } from "./fields/signature-field";
import { SliderField } from "./fields/slider-field";
import { TextField } from "./fields/text-field";
import { UrlField } from "./fields/url-field";
import type { FormBorderRadius, FormSize, FormTheme } from "./theme";
import type { FieldComponentProps } from "./types";

type FieldComponent = (props: FieldComponentProps) => ReactElement;

const INPUT_COMPONENTS: Record<string, FieldComponent> = {
	barcode: BarcodeField,
	checkbox: CheckboxField,
	date: DateField,
	email: EmailField,
	files: FilesField,
	matrix: MatrixField,
	multi_select: MultiSelectField,
	number: NumberField,
	payment: PaymentField,
	phone_number: PhoneField,
	rating: RatingField,
	rich_text: RichTextField,
	scale: ScaleField,
	select: SelectField,
	signature: SignatureField,
	slider: SliderField,
	text: TextField,
	url: UrlField,
};

export interface FieldRendererProps {
	borderRadius: FormBorderRadius;
	disabled: boolean;
	error?: string;
	field: FormField;
	formSlug: string;
	hidden: boolean;
	mentionValues: Record<string, unknown>;
	onChange: (value: unknown) => void;
	presentation: "classic" | "focused";
	required: boolean;
	size: FormSize;
	theme: FormTheme;
	uppercaseLabels: boolean;
	value: unknown;
}

/** Checkbox / toggle switch render their own label inline next to the control, like OpnForm. */
function hasInlineLabel(field: FormField): boolean {
	return field.type === "checkbox" && !field.use_focused_toggle;
}

/** Dispatches one field (input or layout block) to its component, wrapped with label/help/error for inputs. */
export function FieldRenderer({
	borderRadius,
	disabled,
	error,
	field,
	formSlug,
	hidden,
	mentionValues,
	onChange,
	presentation,
	required,
	size,
	theme,
	uppercaseLabels,
	value,
}: FieldRendererProps) {
	if (hidden) {
		return null;
	}
	if (field.type === "nf-text") {
		return <LayoutText field={field} values={mentionValues} />;
	}
	if (field.type === "nf-divider") {
		return <LayoutDivider field={field} />;
	}
	if (field.type === "nf-image") {
		return <LayoutImage field={field} />;
	}
	if (field.type === "nf-video") {
		return <LayoutVideo field={field} />;
	}
	if (field.type === "nf-audio") {
		return <LayoutAudio field={field} />;
	}
	if (field.type === "nf-code") {
		return <LayoutCode field={field} />;
	}
	if (field.type === "nf-page-break") {
		return null;
	}

	const Component = INPUT_COMPONENTS[field.type];
	if (!Component) {
		return null;
	}

	return (
		<FieldWrapper
			error={error}
			field={field}
			inlineLabel={hasInlineLabel(field)}
			mentionValues={mentionValues}
			presentation={presentation}
			required={required}
			size={size}
			theme={theme}
			uppercaseLabels={uppercaseLabels}
		>
			<Component
				borderRadius={borderRadius}
				disabled={disabled}
				error={error}
				field={field}
				formSlug={formSlug}
				id={field.id}
				onChange={onChange}
				presentation={presentation}
				required={required}
				size={size}
				theme={theme}
				value={value}
			/>
		</FieldWrapper>
	);
}
