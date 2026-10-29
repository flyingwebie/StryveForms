import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";
import {
	deviceAuthorizationClient,
	inferAdditionalFields,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { apiBase } from "./api-url";

export const authClient = createAuthClient({
	baseURL: `${apiBase()}/api/auth`,
	plugins: [
		inferAdditionalFields({
			user: { isAdmin: { type: "boolean", required: false } },
		}),
		// Powers the OAuth consent page (authClient.oauth2.*) and device
		// approval page (authClient.device*) — see routes/oauth.consent.tsx and
		// routes/device.tsx / device.approve.tsx.
		oauthProviderClient(),
		deviceAuthorizationClient(),
		// Settings → Account → Two-factor authentication, and the sign-in
		// form's 2FA code step. No `twoFactorPage` — sign-in-form.tsx handles
		// the `twoFactorRedirect` response itself (no page reload).
		twoFactorClient(),
		// Settings → Account → Passkeys, and "Sign in with a passkey".
		passkeyClient(),
	],
});
