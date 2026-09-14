import { defineConfig, socials } from "@c9up/transit";

/**
 * Federated sign-in.
 *
 * Credentials are placeholders: nothing here talks to GitHub. What the app
 * exercises is the half that needs no network — building the authorize URL
 * with the right `redirect_uri`, `scope` and anti-forgery `state`. Exchanging
 * a code for a token needs a live provider and belongs in a staging
 * environment, not in a test suite that must run offline.
 */
export default defineConfig({
	github: socials.github({
		clientId: process.env.GITHUB_CLIENT_ID ?? "kitchen-sink-client-id",
		clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "kitchen-sink-secret",
		callbackUrl: "http://localhost/auth/github/callback",
		scopes: ["read:user"],
	}),
});
