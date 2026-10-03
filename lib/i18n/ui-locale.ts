// The language of the app's own screens (not the number and date formatting,
// which follows the organisation's country; see org-format.ts). English is the
// default. Arabic is a pilot on the sign-in screen: its wording has not had a
// native review, so it only appears when NEXT_PUBLIC_ENABLE_ARABIC_UI is "true".

export const UI_LOCALES = ["en", "ar"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];
export const UI_LOCALE_COOKIE = "ui_lang";

export const dirOf = (l: UiLocale): "ltr" | "rtl" => (l === "ar" ? "rtl" : "ltr");

/** The locale a stored value names; English for anything unknown or when Arabic is not enabled. */
export function resolveUiLocale(value: string | null | undefined, arabicEnabled: boolean): UiLocale {
  return value === "ar" && arabicEnabled ? "ar" : "en";
}

const en = {
  welcomeBack: "Welcome back",
  signInSubtitle: "Sign in to your MetricOra account.",
  email: "Email",
  password: "Password",
  forgotPassword: "Forgot password?",
  signIn: "Sign in",
  signingIn: "Signing in…",
  noAccount: "Don't have an account?",
  createAccount: "Create account",
  signInFailed: "Sign in failed. Please try again.",
} as const;

export type MessageKey = keyof typeof en;

const ar: Record<MessageKey, string> = {
  welcomeBack: "مرحبًا بعودتك",
  signInSubtitle: "سجّل الدخول إلى حسابك في MetricOra.",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  forgotPassword: "نسيت كلمة المرور؟",
  signIn: "تسجيل الدخول",
  signingIn: "جارٍ تسجيل الدخول…",
  noAccount: "ليس لديك حساب؟",
  createAccount: "إنشاء حساب",
  signInFailed: "تعذّر تسجيل الدخول. حاول مرة أخرى.",
};

export const MESSAGES: Record<UiLocale, Record<MessageKey, string>> = { en, ar };

/** A message in the locale, falling back to English if a translation is ever missing. */
export function t(locale: UiLocale, key: MessageKey): string {
  return MESSAGES[locale]?.[key] || en[key];
}
