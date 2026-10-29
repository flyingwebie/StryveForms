/** Real share-intent URLs for each network, built from the form's public link. */
export interface SocialLink {
	bg: string;
	id: "email" | "x" | "linkedin" | "facebook" | "whatsapp";
	name: string;
	url: string;
}

export function buildSocialLinks(
	shareUrl: string,
	title: string
): SocialLink[] {
	const encodedUrl = encodeURIComponent(shareUrl);
	const encodedTitle = encodeURIComponent(title);
	return [
		{
			bg: "#475569",
			id: "email",
			name: "Email",
			url: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(`${title}\n${shareUrl}`)}`,
		},
		{
			bg: "#000000",
			id: "x",
			name: "X",
			url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
		},
		{
			bg: "#0a66c2",
			id: "linkedin",
			name: "LinkedIn",
			url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
		},
		{
			bg: "#1877f2",
			id: "facebook",
			name: "Facebook",
			url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
		},
		{
			bg: "#25d366",
			id: "whatsapp",
			name: "WhatsApp",
			url: `https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`,
		},
	];
}
