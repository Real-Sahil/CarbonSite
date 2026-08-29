import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { apiError, handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';

const TestRequestSchema = z.object({
  provider: z.enum(['okta', 'azure_ad', 'google_workspace', 'generic_oidc', 'saml']),
  metadataUrl: z.string().url(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin');

    const body = await req.json();
    const { provider, metadataUrl } = TestRequestSchema.parse(body);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(metadataUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return apiError(
          'METADATA_FETCH_FAILED',
          `Failed to fetch metadata: ${response.status} ${response.statusText}`,
          400
        );
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return apiError(
          'INVALID_METADATA_FORMAT',
          'Metadata endpoint must return JSON content type',
          400
        );
      }

      const metadata = await response.json();

      if (provider === 'saml') {
        if (!metadata.entityID && !metadata.sso) {
          return apiError(
            'INVALID_SAML_METADATA',
            'SAML metadata missing required fields (entityID, sso)',
            400
          );
        }
      } else {
        const requiredFields = ['authorization_endpoint', 'token_endpoint', 'userinfo_endpoint'];
        const missing = requiredFields.filter((field) => !metadata[field]);

        if (missing.length > 0) {
          return apiError(
            'INVALID_OIDC_METADATA',
            `OIDC metadata missing required fields: ${missing.join(', ')}`,
            400
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: 'SSO provider connection successful',
        metadata: {
          issuer: metadata.issuer,
          authorization_endpoint: metadata.authorization_endpoint,
          token_endpoint: metadata.token_endpoint,
          userinfo_endpoint: metadata.userinfo_endpoint,
          jwks_uri: metadata.jwks_uri,
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof TypeError && fetchError.message.includes('signal')) {
        return apiError(
          'METADATA_TIMEOUT',
          'Connection to metadata endpoint timed out after 10 seconds',
          504
        );
      }

      if (fetchError instanceof Error) {
        return apiError(
          'METADATA_CONNECTION_ERROR',
          `Failed to connect to metadata endpoint: ${fetchError.message}`,
          400
        );
      }

      throw fetchError;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(
        'INVALID_REQUEST',
        'Invalid request parameters',
        400
      );
    }

    return handleRouteError(error);
  }
}
