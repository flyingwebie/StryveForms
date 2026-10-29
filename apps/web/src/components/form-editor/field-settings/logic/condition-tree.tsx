import type { ConditionGroup, ConditionNode } from "@StryveForms/forms/logic";
import { Button } from "@StryveForms/ui/components/button";
import { Plus, Trash2Icon } from "lucide-react";

import { OptionHint } from "../option-hint";
import { ConditionLeafRow } from "./condition-leaf";
import type { FieldOption } from "./field-options";
import type { OperatorContext } from "./operators";

function isGroup(node: ConditionNode): node is ConditionGroup {
	return "operatorIdentifier" in node;
}

function emptyLeaf(): ConditionNode {
	return { value: null };
}

function emptyGroup(): ConditionGroup {
	return { children: [emptyLeaf()], operatorIdentifier: "and" };
}

function ConditionGroupBox({
	context,
	fieldOptions,
	group,
	onChange,
	onRemove,
}: {
	context: OperatorContext;
	fieldOptions: FieldOption[];
	group: ConditionGroup;
	onChange: (group: ConditionGroup) => void;
	onRemove?: () => void;
}) {
	function updateChild(index: number, child: ConditionNode) {
		const children = group.children.map((c, i) => (i === index ? child : c));
		onChange({ ...group, children });
	}

	function removeChild(index: number) {
		onChange({
			...group,
			children: group.children.filter((_, i) => i !== index),
		});
	}

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-input bg-muted/30 p-2.5">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1 text-xs">
					<span className="text-muted-foreground">Match</span>
					<button
						className={`px-1.5 py-0.5 font-medium ${group.operatorIdentifier === "and" ? "text-foreground underline" : "text-muted-foreground"}`}
						onClick={() => onChange({ ...group, operatorIdentifier: "and" })}
						type="button"
					>
						all
					</button>
					<span className="text-muted-foreground">/</span>
					<button
						className={`px-1.5 py-0.5 font-medium ${group.operatorIdentifier === "or" ? "text-foreground underline" : "text-muted-foreground"}`}
						onClick={() => onChange({ ...group, operatorIdentifier: "or" })}
						type="button"
					>
						any
					</button>
					<span className="text-muted-foreground">of the following</span>
					<OptionHint>
						All: every condition must be true (AND). Any: just one needs to be
						true (OR).
					</OptionHint>
				</div>
				{onRemove ? (
					<Button
						onClick={onRemove}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						<Trash2Icon />
					</Button>
				) : null}
			</div>
			<div className="flex flex-col gap-2">
				{group.children.map((child, index) => {
					const rowKey = `row-${index}`;
					return isGroup(child) ? (
						<ConditionGroupBox
							context={context}
							fieldOptions={fieldOptions}
							group={child}
							key={rowKey}
							onChange={(next) => updateChild(index, next)}
							onRemove={() => removeChild(index)}
						/>
					) : (
						<ConditionLeafRow
							context={context}
							fieldOptions={fieldOptions}
							key={rowKey}
							leaf={child}
							onChange={(next) => updateChild(index, next)}
							onRemove={() => removeChild(index)}
						/>
					);
				})}
			</div>
			<div className="flex items-center gap-2">
				<Button
					onClick={() =>
						onChange({ ...group, children: [...group.children, emptyLeaf()] })
					}
					size="sm"
					type="button"
					variant="outline"
				>
					<Plus /> Condition
				</Button>
				<Button
					onClick={() =>
						onChange({ ...group, children: [...group.children, emptyGroup()] })
					}
					size="sm"
					type="button"
					variant="outline"
				>
					<Plus /> Group
				</Button>
				<OptionHint>
					Condition: one more rule in this group. Group: a nested sub-group with
					its own all/any match.
				</OptionHint>
			</div>
		</div>
	);
}

export function ConditionTree({
	context = "logic",
	fieldOptions,
	onChange,
	value,
}: {
	context?: OperatorContext;
	fieldOptions: FieldOption[];
	onChange: (value: ConditionNode | null) => void;
	value: ConditionNode | null;
}) {
	if (!(value && isGroup(value))) {
		return (
			<Button
				onClick={() => onChange(emptyGroup())}
				size="sm"
				type="button"
				variant="outline"
			>
				<Plus /> Add a condition
			</Button>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			<ConditionGroupBox
				context={context}
				fieldOptions={fieldOptions}
				group={value}
				onChange={onChange}
			/>
			<Button
				onClick={() => onChange(null)}
				size="xs"
				type="button"
				variant="ghost"
			>
				Remove all conditions
			</Button>
		</div>
	);
}
