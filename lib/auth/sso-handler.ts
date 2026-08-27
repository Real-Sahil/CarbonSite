import { prisma } from "@/lib/db";

interface SsoVerifyParams {
  orgId: string;
  provider: string;
  idToken?: string;
  samlAssertion?: string;
  userInfo?: {
    email: string;
    name?: string;
    picture?: string;
    providerUserId: string;
  };
}

interface SsoUserResult {
  userId: string;
  email: string;
  name: string | null;
  isNewUser: boolean;
  requiresMfa: boolean;
}

export async function verifySsoUser(params: SsoVerifyParams): Promise<SsoUserResult> {
  const { orgId, provider, userInfo } = params;

  if (!userInfo) {
    throw new Error("User info is required");
  }

  // Verify SSO is enabled for this organization
  const ssoConfig = await prisma.ssoConfiguration.findUnique({
    where: { organizationId: orgId },
  });

  if (!ssoConfig || !ssoConfig.enabled) {
    throw new Error("SSO is not enabled for this organization");
  }

  if (ssoConfig.provider !== provider) {
    throw new Error(`SSO provider mismatch. Expected ${ssoConfig.provider}, got ${provider}`);
  }

  // Check if user already has SSO session
  const existingSsoSession = await prisma.ssoSession.findUnique({
    where: {
      organizationId_providerUserId: {
        organizationId: orgId,
        providerUserId: userInfo.providerUserId,
      },
    },
    include: { user: true },
  });

  if (existingSsoSession) {
    // Update last activity time
    await prisma.ssoSession.update({
      where: { id: existingSsoSession.id },
      data: { lastActivityAt: new Date() },
    });

    return {
      userId: existingSsoSession.user.id,
      email: existingSsoSession.user.email,
      name: existingSsoSession.user.name,
      isNewUser: false,
      requiresMfa: ssoConfig.requireMfa,
    };
  }

  // Check if user exists with this email
  let user = await prisma.user.findUnique({
    where: { email: userInfo.email },
  });

  let isNewUser = false;

  if (!user) {
    // Auto-create user if enabled
    if (ssoConfig.autoCreateUsers) {
      user = await prisma.user.create({
        data: {
          email: userInfo.email,
          name: userInfo.name || null,
          image: userInfo.picture || null,
          emailVerified: true, // SSO-authenticated emails are pre-verified
        },
      });
      isNewUser = true;

      // Auto-assign to organization with configured role
      if (ssoConfig.autoAssignRole) {
        await prisma.organizationMembership.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            role: ssoConfig.autoAssignRole as any, // Role is validated against enum in schema
          },
        });
      }
    } else {
      throw new Error("User does not exist and auto-provisioning is disabled");
    }
  }

  // Create SSO session
  await prisma.ssoSession.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      provider,
      providerUserId: userInfo.providerUserId,
      idpSessionId: userInfo.providerUserId, // Can be enhanced to capture actual IdP session ID
      lastActivityAt: new Date(),
    },
  });

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    isNewUser,
    requiresMfa: ssoConfig.requireMfa,
  };
}

export async function revokeSsoSession(sessionId: string): Promise<void> {
  await prisma.ssoSession.delete({
    where: { id: sessionId },
  });
}

export async function getSsoSessionsByOrg(orgId: string): Promise<Array<{
  id: string;
  userId: string;
  provider: string;
  lastActivityAt: Date;
  createdAt: Date;
}>> {
  const sessions = await prisma.ssoSession.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      userId: true,
      provider: true,
      lastActivityAt: true,
      createdAt: true,
    },
    orderBy: { lastActivityAt: "desc" },
  });

  return sessions;
}

export async function validateSsoConfiguration(orgId: string): Promise<boolean> {
  const config = await prisma.ssoConfiguration.findUnique({
    where: { organizationId: orgId },
  });

  if (!config) return false;

  // Validate required fields based on provider
  switch (config.provider) {
    case "okta":
    case "azure_ad":
      return !!(config.metadataUrl && config.clientId && config.clientSecret);
    case "google_workspace":
      return !!(config.clientId && config.clientSecret);
    case "saml":
      return !!(config.idpEntityId && config.ssoUrl && config.certificateX509);
    case "generic_oidc":
      return !!(config.metadataUrl && config.clientId && config.clientSecret);
    default:
      return false;
  }
}
