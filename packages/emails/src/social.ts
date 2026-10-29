/**
 * Catalogue of social networks offered in the email Social Links editor, used
 * for auto-detecting a network from a pasted URL and for rendering a small
 * PNG badge icon for each (see `./social-icon`).
 */

export const SOCIAL_NETWORK_IDS = [
	"website",
	"facebook",
	"x",
	"instagram",
	"linkedin",
	"youtube",
	"tiktok",
	"github",
	"threads",
	"discord",
	"whatsapp",
	"telegram",
	"pinterest",
	"mastodon",
	"email",
] as const;

export type SocialNetworkId = (typeof SOCIAL_NETWORK_IDS)[number];

export interface SocialNetworkInfo {
	/** Approximate official brand colour, used when the icon style is "brand". */
	brandColor: string;
	/** Hostnames (without "www.") that auto-detect this network from a pasted URL. */
	hosts: string[];
	id: SocialNetworkId;
	label: string;
	/** 1-2 letter monogram drawn on the generated PNG badge (no bundled brand logos). */
	monogram: string;
}

export const SOCIAL_NETWORKS: Record<SocialNetworkId, SocialNetworkInfo> = {
	discord: {
		brandColor: "#5865F2",
		hosts: ["discord.gg", "discord.com"],
		id: "discord",
		label: "Discord",
		monogram: "DC",
	},
	email: {
		brandColor: "#71717A",
		hosts: [],
		id: "email",
		label: "Email",
		monogram: "EM",
	},
	facebook: {
		brandColor: "#1877F2",
		hosts: ["facebook.com", "fb.com", "fb.me"],
		id: "facebook",
		label: "Facebook",
		monogram: "F",
	},
	github: {
		brandColor: "#181717",
		hosts: ["github.com"],
		id: "github",
		label: "GitHub",
		monogram: "GH",
	},
	instagram: {
		brandColor: "#E4405F",
		hosts: ["instagram.com", "instagr.am"],
		id: "instagram",
		label: "Instagram",
		monogram: "IG",
	},
	linkedin: {
		brandColor: "#0A66C2",
		hosts: ["linkedin.com", "lnkd.in"],
		id: "linkedin",
		label: "LinkedIn",
		monogram: "IN",
	},
	mastodon: {
		brandColor: "#6364FF",
		hosts: ["mastodon.social", "mstdn.social", "fosstodon.org", "hachyderm.io"],
		id: "mastodon",
		label: "Mastodon",
		monogram: "M",
	},
	pinterest: {
		brandColor: "#E60023",
		hosts: ["pinterest.com", "pin.it"],
		id: "pinterest",
		label: "Pinterest",
		monogram: "PN",
	},
	threads: {
		brandColor: "#000000",
		hosts: ["threads.net"],
		id: "threads",
		label: "Threads",
		monogram: "@",
	},
	tiktok: {
		brandColor: "#000000",
		hosts: ["tiktok.com"],
		id: "tiktok",
		label: "TikTok",
		monogram: "TT",
	},
	telegram: {
		brandColor: "#26A5E4",
		hosts: ["t.me", "telegram.me", "telegram.org"],
		id: "telegram",
		label: "Telegram",
		monogram: "TG",
	},
	website: {
		brandColor: "#52525B",
		hosts: [],
		id: "website",
		label: "Website",
		monogram: "W",
	},
	whatsapp: {
		brandColor: "#25D366",
		hosts: ["whatsapp.com", "wa.me"],
		id: "whatsapp",
		label: "WhatsApp",
		monogram: "WA",
	},
	x: {
		brandColor: "#000000",
		hosts: ["twitter.com", "x.com", "t.co"],
		id: "x",
		label: "X",
		monogram: "X",
	},
	youtube: {
		brandColor: "#FF0000",
		hosts: ["youtube.com", "youtu.be"],
		id: "youtube",
		label: "YouTube",
		monogram: "YT",
	},
};

export const SOCIAL_NETWORK_LIST: SocialNetworkInfo[] = SOCIAL_NETWORK_IDS.map(
	(id) => SOCIAL_NETWORKS[id]
);

/** Relative path (under the API server) to this network's rendered PNG badge. */
export function socialIconPath(
	network: SocialNetworkId,
	style: "brand" | "mono" | "muted",
	size: number,
	color?: string
): string {
	const params = new URLSearchParams({ size: String(Math.round(size)), style });
	if (style === "mono" && color) {
		params.set("color", color);
	}
	return `/api/email-assets/social-icon/${network}.png?${params.toString()}`;
}

const BARE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const MAILTO_SCHEME = /^mailto:/i;
const WWW_PREFIX = /^www\./;

/** Auto-detects a social network from a pasted URL (or bare domain/handle/email). */
export function detectSocialNetwork(url: string): SocialNetworkId {
	const trimmed = url.trim();
	if (!trimmed) {
		return "website";
	}
	if (MAILTO_SCHEME.test(trimmed) || BARE_EMAIL.test(trimmed)) {
		return "email";
	}
	let host: string;
	try {
		host = new URL(
			HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`
		).hostname.toLowerCase();
	} catch {
		return "website";
	}
	host = host.replace(WWW_PREFIX, "");
	for (const network of SOCIAL_NETWORK_LIST) {
		if (network.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
			return network.id;
		}
	}
	return "website";
}
