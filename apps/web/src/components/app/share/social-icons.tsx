/** Social network marks for the share dialog's share-to buttons (simple-icons, CC0). */
import type { SVGProps } from "react";
import { siFacebook, siWhatsapp, siX } from "simple-icons";

import { LINKEDIN_PATH, SimpleIcon } from "../brand/simple-icon";

type GlyphProps = SVGProps<SVGSVGElement>;

export function XGlyph(props: GlyphProps) {
	return <SimpleIcon path={siX.path} {...props} />;
}

export function LinkedInGlyph(props: GlyphProps) {
	return <SimpleIcon path={LINKEDIN_PATH} {...props} />;
}

export function FacebookGlyph(props: GlyphProps) {
	return <SimpleIcon path={siFacebook.path} {...props} />;
}

export function WhatsAppGlyph(props: GlyphProps) {
	return <SimpleIcon path={siWhatsapp.path} {...props} />;
}
