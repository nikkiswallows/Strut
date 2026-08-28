/**
 * ⚠️  BUILT-IN CREDENTIAL FALLBACKS — TEST ENVIRONMENT ONLY. ⚠️
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE THE REPO GOES ANYWHERE NEAR PRODUCTION.
 *
 * Everything in this file is a *fallback* used only when the matching
 * environment variable is unset. It exists because the operator of this preview
 * has no way to set environment variables on their hosting side yet, and the
 * cold-start admin tooling is useless without a Horde key and an admin login.
 *
 * The consequences, stated plainly:
 *
 *   • Anything here is committed to git. If this repository is public — it
 *     currently is — these values are public. Treat them as burned.
 *   • The admin password below protects a console that can delete every profile
 *     in the database. A public default password on that console is a total
 *     compromise of the app's data.
 *   • The AI Horde key below can be spent by anyone who reads it (kudos, queue
 *     priority, and the account's reputation for whatever they generate with it).
 *
 * The exit ramp, in order of preference:
 *
 *   1. Set `ADMIN_EMAILS`, `ADMIN_PASSWORD` and `AIHORDE_API_KEY` as real
 *      environment variables, then delete the literals below (leave the empty
 *      strings). Env always wins over these fallbacks, so step 1 is safe to do
 *      at any time without touching another line of code.
 *   2. Failing that, make the repository private.
 *   3. Rotate both credentials the moment testing is finished:
 *      Horde  → https://aihorde.net/  (regenerate the API key)
 *      Admin  → change ADMIN_PASSWORD, restart, sign in with the new one.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Fallback AI Horde API key. `AIHORDE_API_KEY` / `HORDE_API_KEY` override it. */
export const FALLBACK_HORDE_API_KEY = "AbK_wPLS9UvePEGNKxQdCA";

/** Fallback admin login. `ADMIN_EMAILS` / `ADMIN_PASSWORD` override these. */
export const FALLBACK_ADMIN_EMAIL = "admin@admin.com";
export const FALLBACK_ADMIN_PASSWORD = "StrutAdmin420$";

/** Display name given to the bootstrapped admin account. */
export const ADMIN_DISPLAY_NAME = "Strut Admin";

/**
 * True when the app is running on any of the built-in fallbacks. The console
 * renders a standing warning banner while this is true, so the state can never
 * be forgotten about.
 */
export function usingFallbackCredentials(): {
  horde: boolean;
  adminEmail: boolean;
  adminPassword: boolean;
} {
  const val = (k: string) => process.env[k]?.trim() || "";
  return {
    horde: !val("AIHORDE_API_KEY") && !val("HORDE_API_KEY"),
    adminEmail: !val("ADMIN_EMAILS") && !val("ADMIN_EMAIL"),
    adminPassword: !val("ADMIN_PASSWORD"),
  };
}
