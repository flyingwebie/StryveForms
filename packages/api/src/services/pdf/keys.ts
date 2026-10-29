/** Storage keys for PDF template assets: the uploaded base PDF and any images used in zones. */

export function pdfSourceKey(formId: string, fileName: string): string {
	return `pdf-templates/${formId}/${fileName}`;
}

export function pdfZoneImageKey(formId: string, fileName: string): string {
	return `pdf-templates/${formId}/images/${fileName}`;
}
