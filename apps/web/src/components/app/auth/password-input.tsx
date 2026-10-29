import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@StryveForms/ui/components/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useId, useState } from "react";

/** A password field with a show/hide toggle, matching the design's eye-icon inputs. */
export default function PasswordInput({
	autoComplete,
	id,
	name,
	onBlur,
	onChange,
	placeholder,
	value,
}: {
	autoComplete?: string;
	id?: string;
	name?: string;
	onBlur?: () => void;
	onChange: (value: string) => void;
	placeholder?: string;
	value: string;
}) {
	const [visible, setVisible] = useState(false);
	const generatedId = useId();
	const inputId = id ?? generatedId;

	return (
		<InputGroup>
			<InputGroupInput
				autoComplete={autoComplete}
				id={inputId}
				name={name}
				onBlur={onBlur}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				type={visible ? "text" : "password"}
				value={value}
			/>
			<InputGroupAddon align="inline-end">
				<InputGroupButton
					aria-label={visible ? "Hide password" : "Show password"}
					onClick={() => setVisible((prev) => !prev)}
					size="icon-xs"
				>
					{visible ? <EyeOffIcon /> : <EyeIcon />}
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
}
