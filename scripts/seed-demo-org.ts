// Creates a demo account, a demo organisation with the account as admin, and
// marks onboarding complete, so anyone can open the dashboard in a local or
// throwaway database without going through sign-up and setup.
//
// Safe to run twice: every row is upserted. It writes a sign-in, so it refuses
// to run unless you opt in and supply the password:
//
//   ALLOW_DEMO_SEED=1 DEMO_PASSWORD='<at least 12 characters>' pnpm seed:demo
//
// Optional: DEMO_EMAIL (default demo@example.test). Never run it against a
// production database.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { TERMS_VERSION } from "../lib/legal/terms";

const DEMO_ORG_ID = "demo-org";

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed: set ALLOW_DEMO_SEED=1 to confirm this is a local or throwaway database.");
  }
  const password = process.env.DEMO_PASSWORD ?? "";
  if (password.length < 12) {
    throw new Error("Set DEMO_PASSWORD to at least 12 characters.");
  }
  const email = (process.env.DEMO_EMAIL ?? "demo@example.test").trim().toLowerCase();
  const now = new Date();
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.upsert({
      where: { email },
      update: { emailVerified: true, emailVerifiedAt: now, termsVersion: TERMS_VERSION, termsAcceptedAt: now },
      create: {
        email,
        name: "Demo Admin",
        emailVerified: true,
        emailVerifiedAt: now,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: now,
      },
    });

    // Better Auth checks sign-in against a "credential" account row holding the password hash.
    const hash = await hashPassword(password);
    const credential = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" } });
    if (credential) {
      await prisma.account.update({ where: { id: credential.id }, data: { password: hash } });
    } else {
      await prisma.account.create({
        data: { userId: user.id, accountId: user.id, providerId: "credential", password: hash },
      });
    }

    const org = await prisma.organization.upsert({
      where: { id: DEMO_ORG_ID },
      update: {},
      create: { id: DEMO_ORG_ID, name: "Demo Construction Ltd", hqCountry: "GB", reportingCurrency: "GBP" },
    });

    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      update: { role: "admin", terminatedAt: null },
      create: { organizationId: org.id, userId: user.id, role: "admin" },
    });

    await prisma.onboardingProgress.upsert({
      where: { organizationId: org.id },
      update: { isComplete: true, completedAt: now },
      create: { organizationId: org.id, isComplete: true, completedAt: now },
    });

    console.log(`Demo account ${email} is an admin of "${org.name}" (organisation id ${org.id}).`);
    console.log(`Open /orgs/${org.id}/dashboard after signing in.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
