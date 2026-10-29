/** Small dictionary of built-in renderer strings. Falls back to English. */

export interface FormDictionary {
	clear: string;
	edit: string;
	fillAnotherResponse: string;
	formClosed: string;
	loading: string;
	markRequired: string;
	maxReached: string;
	next: string;
	optional: string;
	pageOf: string;
	poweredBy: string;
	previous: string;
	required: string;
	scanCode: string;
	signHere: string;
	submit: string;
	submitting: string;
	takePhoto: string;
	thankYou: string;
	uploadFile: string;
	uploading: string;
	wrongPassword: string;
}

const EN: FormDictionary = {
	clear: "Clear",
	edit: "Edit your answers",
	fillAnotherResponse: "Fill in another response",
	formClosed: "This form is now closed.",
	loading: "Loading…",
	markRequired: "indicates required field",
	maxReached: "This form has reached its submission limit.",
	next: "Next",
	optional: "Optional",
	pageOf: "Page {current} of {total}",
	poweredBy: "Powered by",
	previous: "Previous",
	required: "Required",
	scanCode: "Scan code",
	signHere: "Sign here",
	submit: "Submit",
	submitting: "Submitting…",
	takePhoto: "Take photo",
	thankYou: "Thank you!",
	uploadFile: "Upload a file",
	uploading: "Uploading…",
	wrongPassword: "Incorrect password, please try again.",
};

const DICTIONARIES: Partial<Record<string, Partial<FormDictionary>>> = {
	de: {
		clear: "Löschen",
		next: "Weiter",
		poweredBy: "Bereitgestellt von",
		previous: "Zurück",
		required: "Erforderlich",
		submit: "Absenden",
		submitting: "Wird gesendet…",
		thankYou: "Vielen Dank!",
		uploadFile: "Datei hochladen",
		wrongPassword: "Falsches Passwort, bitte versuchen Sie es erneut.",
	},
	es: {
		clear: "Borrar",
		next: "Siguiente",
		poweredBy: "Desarrollado por",
		previous: "Anterior",
		required: "Obligatorio",
		submit: "Enviar",
		submitting: "Enviando…",
		thankYou: "¡Gracias!",
		uploadFile: "Subir un archivo",
		wrongPassword: "Contraseña incorrecta, inténtalo de nuevo.",
	},
	fr: {
		clear: "Effacer",
		next: "Suivant",
		poweredBy: "Propulsé par",
		previous: "Précédent",
		required: "Obligatoire",
		submit: "Envoyer",
		submitting: "Envoi…",
		thankYou: "Merci !",
		uploadFile: "Importer un fichier",
		wrongPassword: "Mot de passe incorrect, veuillez réessayer.",
	},
	it: {
		clear: "Cancella",
		next: "Avanti",
		poweredBy: "Offerto da",
		previous: "Indietro",
		required: "Obbligatorio",
		submit: "Invia",
		submitting: "Invio…",
		thankYou: "Grazie!",
		uploadFile: "Carica un file",
		wrongPassword: "Password errata, riprova.",
	},
	nl: {
		clear: "Wissen",
		next: "Volgende",
		poweredBy: "Mogelijk gemaakt door",
		previous: "Vorige",
		required: "Verplicht",
		submit: "Verzenden",
		submitting: "Verzenden…",
		thankYou: "Dank je wel!",
		uploadFile: "Bestand uploaden",
		wrongPassword: "Onjuist wachtwoord, probeer het opnieuw.",
	},
	pt: {
		clear: "Limpar",
		next: "Seguinte",
		poweredBy: "Fornecido por",
		previous: "Anterior",
		required: "Obrigatório",
		submit: "Enviar",
		submitting: "Enviando…",
		thankYou: "Obrigado!",
		uploadFile: "Carregar um ficheiro",
		wrongPassword: "Senha incorreta, tente novamente.",
	},
};

export function getDictionary(
	language: string | null | undefined
): FormDictionary {
	const extra = language ? DICTIONARIES[language.toLowerCase()] : undefined;
	return extra ? { ...EN, ...extra } : EN;
}

export function formatString(
	template: string,
	values: Record<string, string | number>
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match
	);
}
