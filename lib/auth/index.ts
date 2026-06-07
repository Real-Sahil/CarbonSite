import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";

const isNextBuild = process.env.NEXT_PHASE === "phase-production-build";

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
    requireEmailVerification: process.env.NODE_ENV === "production",
  },
  session: {
    // Short-lived sessions with rolling expiry; mobile clients use bearer tokens
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh if older than 1 day
  },
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") ?? [],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
