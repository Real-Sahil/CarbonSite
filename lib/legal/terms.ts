// The Terms of Service version a person must accept to create an account. Bump it whenever the Terms page changes
// in a way a customer should agree to again; sign-up refuses a form that names any other version.
export const TERMS_VERSION = "2026-10";

/** Sign-up needs the Terms accepted for the current version; the form sends both fields. */
export function termsAcceptedIn(body: unknown): boolean {
  const b = (body ?? {}) as Record<string, unknown>;
  return b.acceptedTerms === true && b.termsVersion === TERMS_VERSION;
}

/** True when an account still has to accept the current Terms before using the web app. */
export function needsTermsAcceptance(termsVersion: string | null | undefined): boolean {
  return termsVersion !== TERMS_VERSION;
}
