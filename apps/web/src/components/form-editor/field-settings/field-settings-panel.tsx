import type { FormField } from "@StryveForms/forms/types";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@StryveForms/ui/components/tabs";

import { useEditor } from "../state/editor-context";
import { CommonFieldSettings } from "./common-fields";
import { FocusedImagePanel } from "./focused-image-panel";
import { LogicSection } from "./logic/logic-section";
import { BarcodePanel } from "./type-panels/barcode-panel";
import { ContentPanel } from "./type-panels/content-panel";
import { DatePanel } from "./type-panels/date-panel";
import { FilesPanel } from "./type-panels/files-panel";
import { MatrixPanel } from "./type-panels/matrix-panel";
import { NumericPanel } from "./type-panels/numeric-panel";
import { PhonePanel } from "./type-panels/phone-panel";
import { SelectPanel } from "./type-panels/select-panel";
import { TextPanel } from "./type-panels/text-panel";
import { ValidationSection } from "./validation-section";

const TEXT_SHAPED = new Set(["text", "rich_text", "url"]);
const SELECT_SHAPED = new Set(["select", "multi_select"]);
const NUMERIC_SHAPED = new Set(["rating", "scale", "slider"]);
const LAYOUT_SHAPED = new Set([
	"nf-text",
	"nf-image",
	"nf-video",
	"nf-audio",
	"nf-code",
	"nf-page-break",
	"nf-divider",
]);
/** Every input type the condition engine (`propertyConditionMet`) supports. */
const WITH_VALIDATION = new Set([
	"text",
	"rich_text",
	"url",
	"email",
	"phone_number",
	"barcode",
	"number",
	"rating",
	"scale",
	"slider",
	"checkbox",
	"select",
	"multi_select",
	"date",
	"matrix",
	"files",
	"signature",
]);

function TypeSpecificPanel({ field }: { field: FormField }) {
	if (TEXT_SHAPED.has(field.type) || field.type === "email") {
		return <TextPanel field={field} />;
	}
	if (field.type === "phone_number") {
		return <PhonePanel field={field} />;
	}
	if (field.type === "date") {
		return <DatePanel field={field} />;
	}
	if (SELECT_SHAPED.has(field.type)) {
		return <SelectPanel field={field} />;
	}
	if (field.type === "rating" || NUMERIC_SHAPED.has(field.type)) {
		return <NumericPanel field={field} />;
	}
	if (field.type === "files") {
		return <FilesPanel field={field} />;
	}
	if (field.type === "matrix") {
		return <MatrixPanel field={field} />;
	}
	if (field.type === "barcode") {
		return <BarcodePanel field={field} />;
	}
	return null;
}

export function FieldSettingsPanel() {
	const { readOnly, selectedField, state } = useEditor();
	const field = selectedField;

	if (!field) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground text-xs">
				Select a field to edit its settings.
			</div>
		);
	}

	const isLayoutBlock = LAYOUT_SHAPED.has(field.type);
	const isFocused = state.settings.presentationStyle === "focused";

	return (
		<div className="flex h-full flex-col overflow-y-auto">
			<fieldset className="flex flex-1 flex-col" disabled={readOnly}>
				{isLayoutBlock ? (
					<Tabs className="flex-1" defaultValue="content">
						<div className="border-b px-4">
							<TabsList className="gap-4 p-0" variant="line">
								<TabsTrigger className="px-0.5 py-3" value="content">
									Content
								</TabsTrigger>
								<TabsTrigger className="px-0.5 py-3" value="logic">
									Logic
								</TabsTrigger>
							</TabsList>
						</div>
						<p className="truncate px-4 pt-4 font-semibold text-base">
							{field.name}
						</p>
						<TabsContent
							className="flex flex-col gap-4 p-4 pb-24"
							value="content"
						>
							<ContentPanel field={field} />
						</TabsContent>
						<TabsContent
							className="flex flex-col gap-4 p-4 pb-24"
							value="logic"
						>
							<LogicSection field={field} />
						</TabsContent>
					</Tabs>
				) : (
					<Tabs className="flex-1" defaultValue="general">
						<div className="border-b px-4">
							<TabsList className="gap-4 p-0" variant="line">
								<TabsTrigger className="px-0.5 py-3" value="general">
									General
								</TabsTrigger>
								<TabsTrigger className="px-0.5 py-3" value="options">
									Options
								</TabsTrigger>
								<TabsTrigger className="px-0.5 py-3" value="logic">
									Logic
								</TabsTrigger>
								{WITH_VALIDATION.has(field.type) ? (
									<TabsTrigger className="px-0.5 py-3" value="validation">
										Validation
									</TabsTrigger>
								) : null}
							</TabsList>
						</div>
						<p className="truncate px-4 pt-4 font-semibold text-base">
							{field.name}
						</p>
						<TabsContent
							className="flex flex-col gap-4 p-4 pb-24"
							value="general"
						>
							<CommonFieldSettings
								field={field}
								showPlaceholder={
									TEXT_SHAPED.has(field.type) ||
									field.type === "email" ||
									field.type === "phone_number" ||
									field.type === "number" ||
									SELECT_SHAPED.has(field.type)
								}
							/>
							{isFocused ? <FocusedImagePanel field={field} /> : null}
						</TabsContent>
						<TabsContent
							className="flex flex-col gap-4 p-4 pb-24"
							value="options"
						>
							<TypeSpecificPanel field={field} />
						</TabsContent>
						<TabsContent
							className="flex flex-col gap-4 p-4 pb-24"
							value="logic"
						>
							<LogicSection field={field} />
						</TabsContent>
						{WITH_VALIDATION.has(field.type) ? (
							<TabsContent
								className="flex flex-col gap-4 p-4 pb-24"
								value="validation"
							>
								<ValidationSection field={field} />
							</TabsContent>
						) : null}
					</Tabs>
				)}
			</fieldset>
		</div>
	);
}
