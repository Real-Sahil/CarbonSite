/**
 * Kong API Gateway Configuration
 * 
 * Kong acts as reverse proxy providing:
 * - API key authentication (ACL)
 * - Rate limiting (1000 req/min per org)
 * - Request/response logging
 * - Service mesh integration
 */

export interface KongService {
  name: string;
  url: string;
  description: string;
}

export interface KongRoute {
  name: string;
  service: string;
  paths: string[];
  methods?: string[];
  stripPath: boolean;
}

export interface KongPlugin {
  name: string;
  service?: string;
  config: Record<string, unknown>;
}

export interface KongConsumer {
  username: string;
  customId: string;
  tags?: string[];
}

export const KONG_SERVICES: KongService[] = [
  {
    name: 'carbonsite-api',
    url: 'http://localhost:3000',
    description: 'CarbonSite main API',
  },
];

export const KONG_ROUTES: KongRoute[] = [
  {
    name: 'orgs-api',
    service: 'carbonsite-api',
    paths: ['/api/orgs'],
    methods: ['GET', 'POST'],
    stripPath: false,
  },
  {
    name: 'reports-api',
    service: 'carbonsite-api',
    paths: ['/api/orgs/*/reports'],
    methods: ['GET', 'POST'],
    stripPath: false,
  },
];

export const KONG_PLUGINS: KongPlugin[] = [
  {
    name: 'key-auth',
    service: 'carbonsite-api',
    config: { key_names: ['apikey'], hide_credentials: true },
  },
  {
    name: 'rate-limiting',
    service: 'carbonsite-api',
    config: { minute: 1000, policy: 'local' },
  },
  {
    name: 'cors',
    service: 'carbonsite-api',
    config: {
      origins: ['http://localhost:3000', 'https://carbonsite.app'],
      credentials: true,
    },
  },
];
