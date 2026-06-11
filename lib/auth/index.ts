import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/notifications/email";

const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";
const requireEmailVerification =
  process.env.BETTER_AUTH_REQUIRE_EMAIL_VERIFICATION === "true";
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
  trustedOrigins,
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
