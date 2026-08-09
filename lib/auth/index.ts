import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/notifications/email";

const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
// Email verification disabled until a sending domain is configured.
// Re-enable by setting BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION=true once Resend is set up.
const requireEmailVerification = false;
const trustedOrigins = Array.from(
  new Set(
    [
      ...(process.env.TRUSTED_ORIGINS?.split(",") ?? []),
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.BETTER_AUTH_URL,
    ]
      .map((origin) => origin?.trim())
      .filter((origin): origin is string => Boolean(origin)),
  ),
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (isNextBuild ? "carbonsite-build-time-secret-not-used-at-runtime" : undefined),
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (isNextBuild ? "http://localhost:3000" : undefined),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification,
    // Guard against bcrypt DoS: reject passwords over 128 chars before hashing.
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Reset your CarbonSite password",
        text: [
          `Hello ${user.name || "there"},`,
          "",
          "Someone requested a password reset for your CarbonSite account.",
          "Click the link below to choose a new password (expires in 1 hour):",
          "",
          url,
          "",
          "If you did not request this, you can safely ignore this email.",
          "Your password will not change unless you click the link above.",
        ].join("\n"),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: requireEmailVerification,
    sendOnSignIn: requireEmailVerification,
    sendVerificationEmail: async ({ user, url }) => {
      await sendTransactionalEmail({
        to: user.email,
        subject: "Verify your CarbonSite email",
        text: [
          `Hello ${user.name || "there"},`,
          "",
          "Confirm this email address to finish securing your CarbonSite account:",
          url,
          "",
          "If you did not request this, you can ignore this email.",
        ].join("\n"),
      });
    },
  },
  session: {
    // Short-lived sessions with rolling expiry; mobile clients use bearer tokens
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh if older than 1 day
  },
  advanced: {
    // FIND-007: Harden session cookies.
    // SameSite=Lax prevents cross-site form-POST CSRF.
    // Secure ensures cookies are never sent over plaintext HTTP.
    // HttpOnly is set by Better Auth by default; explicitly declaring it here
    // ensures it survives future library upgrades.
    defaultCookieAttributes: {
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  },
  trustedOrigins,
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
