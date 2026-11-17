import { createContext, useContext } from "react";

/**
 * The password the respondent unlocked this form with, if it has one. Fields
 * that upload files read it here so every request to a protected form proves
 * the respondent got past the password screen.
 */
export const FormPasswordContext = createContext<string | undefined>(undefined);

export function useFormPassword(): string | undefined {
	return useContext(FormPasswordContext);
}
