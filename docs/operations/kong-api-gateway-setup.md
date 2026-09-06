# Kong API Gateway Setup Guide

Kong is an open-source API Gateway that provides centralized API management, authentication, rate limiting, and request logging for MetricOra's production deployment.

## Overview

Kong sits as a reverse proxy in front of the MetricOra Next.js API, handling:
- **Rate limiting**: 1000 requests/min per organization API key
- **Authentication**: API key validation (ACL plugin)
- **Request/Response logging**: Full audit trail for compliance
- **Service routing**: Load balancing across multiple MetricOra instances
- **Plugin ecosystem**: CORS, OAuth2, JWT, request/response transformation

## Architecture

```
Clients (Web, Mobile, Partners)
         ↓
    Kong Gateway (Port 8000)
    ├─ Rate Limiting Plugin
    ├─ Authentication (ACL)
    ├─ Request Logging
    └─ Response Transformation
         ↓
MetricOra Backend (Next.js API, Port 3000)
         ↓
PostgreSQL + R2 Storage
```

## Installation & Setup

### 1. Docker Compose (Recommended for Production)

```yaml
# docker-compose.kong.yml
version: '3.8'
services:
  kong-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: kong
      POSTGRES_PASSWORD: ${KONG_DB_PASSWORD}
      POSTGRES_DB: kong
    ports:
      - "5432:5432"
    volumes:
      - kong-db:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "kong", "-d", "kong"]
      interval: 10s
      timeout: 5s
      retries: 5

  kong-migrations:
    image: kong:3.4-alpine
    command: kong migrations bootstrap
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-db
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: ${KONG_DB_PASSWORD}
    depends_on:
      kong-db:
        condition: service_healthy
    restart: on-failure

  kong:
    image: kong:3.4-alpine
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-db
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: ${KONG_DB_PASSWORD}
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
    ports:
      - "8000:8000"    # Proxy
      - "8001:8001"    # Admin API
      - "8443:8443"    # Proxy HTTPS
      - "8444:8444"    # Admin API HTTPS
    depends_on:
      - kong-migrations
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "kong", "health"]
      interval: 10s
      timeout: 5s
      retries: 5

  konga:
    image: pantsel/konga:latest
    environment:
      NODE_ENV: production
      DB_ADAPTER: postgres
      DB_HOST: kong-db
      DB_USER: kong
      DB_PASSWORD: ${KONG_DB_PASSWORD}
      DB_DATABASE: konga
    ports:
      - "1337:1337"
    depends_on:
      - kong-db
    restart: unless-stopped

volumes:
  kong-db:

```

### 2. Environment Variables

```bash
# .env (Kong configuration)
KONG_DB_PASSWORD=changeme-in-production
KONG_ADMIN_URL=http://localhost:8001
KONG_PROXY_URL=http://localhost:8000
METRICORA_BACKEND=http://host.docker.internal:3000  # Docker desktop
# Or for Linux: http://172.17.0.1:3000
```

### 3. Start Kong

```bash
# Start Kong and dependencies
docker-compose -f docker-compose.kong.yml up -d

# Wait for Kong to be ready
sleep 10

# Verify Kong is running
curl -i http://localhost:8001/
```

## Configuration

### 1. Create Service (Upstream Backend)

```bash
# Add MetricOra as a service in Kong
curl -i -X POST http://localhost:8001/services/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "metricora-api",
    "url": "http://host.docker.internal:3000",
    "connect_timeout": 60000,
    "write_timeout": 60000,
    "read_timeout": 60000
  }'
```

### 2. Create Route

```bash
# Add route to the service
curl -i -X POST http://localhost:8001/services/metricora-api/routes \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/api", "/auth"],
    "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "protocols": ["http", "https"],
    "strip_path": false,
    "preserve_host": true
  }'
```

### 3. Add Rate Limiting Plugin

```bash
# Enable rate limiting on the service
curl -i -X POST http://localhost:8001/services/metricora-api/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "rate-limiting",
    "config": {
      "minute": 1000,
      "hour": 50000,
      "limit_by": "header",
      "header_name": "x-api-key",
      "policy": "local",
      "fault_tolerant": true
    }
  }'
```

### 4. Add ACL (API Key Authentication)

```bash
# Create a consumer for an API client
curl -i -X POST http://localhost:8001/consumers \
  -H "Content-Type: application/json" \
  -d '{
    "username": "org-acme-corp"
  }'

# Create an API key credential
curl -i -X POST http://localhost:8001/consumers/org-acme-corp/acl \
  -H "Content-Type: application/json" \
  -d '{
    "group": "metricora-api"
  }'

# Verify the consumer and ACL were created
curl -s http://localhost:8001/consumers/org-acme-corp/acl | jq .
```

### 5. Add ACL Plugin to Service

```bash
# Enable ACL plugin on the service
curl -i -X POST http://localhost:8001/services/metricora-api/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "acl",
    "config": {
      "allow": ["metricora-api"],
      "deny": null,
      "hide_groups_header": false
    }
  }'
```

### 6. Add Request Logging Plugin

```bash
# Enable request logging for audit trail
curl -i -X POST http://localhost:8001/services/metricora-api/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "request-transformer",
    "config": {
      "add": {
        "headers": ["X-Kong-Consumer-Custom-Header:value"],
        "querystring": ["x_kong_timestamp:$(date +%s)"]
      }
    }
  }'
```

## Testing

### 1. Test Without API Key (Should Fail)

```bash
curl -v http://localhost:8000/api/orgs/org123/dashboard
# Expected: 403 Forbidden (missing authentication)
```

### 2. Create API Key for Testing

```bash
# Create test consumer and API key
curl -i -X POST http://localhost:8001/consumers \
  -H "Content-Type: application/json" \
  -d '{"username": "test-api-key"}'

curl -i -X POST http://localhost:8001/consumers/test-api-key/key-auth \
  -H "Content-Type: application/json" \
  -d '{"key": "test-key-12345"}'

# Add to ACL group
curl -i -X POST http://localhost:8001/consumers/test-api-key/acl \
  -H "Content-Type: application/json" \
  -d '{"group": "metricora-api"}'
```

### 3. Test With API Key (Should Succeed)

```bash
curl -v http://localhost:8000/api/orgs/org123/dashboard \
  -H "apikey: test-key-12345"
# Expected: 200 OK (proxied to MetricOra)
```

### 4. Test Rate Limiting

```bash
# Send 1001 requests in a minute - 1001st should be rate limited
for i in {1..1001}; do
  curl -s http://localhost:8000/api/orgs/org123/dashboard \
    -H "apikey: test-key-12345" \
    -H "x-api-key: test-key-12345"
done | tail -5
# Last request should return 429 Too Many Requests
```

## Konga Admin UI

Konga provides a web interface for Kong management:

1. Open: http://localhost:1337
2. Initial setup:
   - Set up new connection to Kong
   - Add Kong admin URL: `http://kong:8001`
   - Create admin user account

Through Konga you can:
- Manage services, routes, consumers
- Configure plugins visually
- Monitor API traffic and errors
- Test API endpoints

## Production Deployment

### Docker Swarm / Kubernetes

For production, deploy Kong using:

```yaml
# kubernetes/kong-values.yaml
gateway:
  type: LoadBalancer
  externalTrafficPolicy: Local
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"

postgres:
  enabled: true
  architecture: standalone

plugins:
  enabled:
    - acl
    - rate-limiting
    - cors
    - request-transformer

env:
  kong_log_level: info
  kong_admin_access_log: /dev/stdout
  kong_proxy_access_log: /dev/stdout
```

```bash
# Deploy via Helm
helm repo add kong https://charts.konghq.com
helm install kong kong/kong -f kubernetes/kong-values.yaml
```

### Environment Variables (Production)

```bash
# .env.production
KONG_PROXY_URL=https://api.metricora.io  # Public endpoint
KONG_DATABASE=postgres
KONG_PG_HOST=postgres.internal
KONG_PG_PORT=5432
KONG_PG_USER=kong
KONG_PG_PASSWORD=${DB_PASSWORD}
KONG_ADMIN_LISTEN=127.0.0.1:8001  # Only internal access
KONG_PROXY_ACCESS_LOG=/var/log/kong/proxy.log
KONG_ADMIN_ACCESS_LOG=/var/log/kong/admin.log

# TLS/HTTPS
KONG_SSL_CERT=/etc/kong/tls/cert.pem
KONG_SSL_CERT_KEY=/etc/kong/tls/key.pem
```

## Monitoring & Logging

### View Logs

```bash
# Proxy access logs
docker-compose -f docker-compose.kong.yml logs kong | grep "method"

# Check rate limiting events
docker-compose logs kong | grep "rate-limiting"

# Admin API activity
docker-compose logs kong | grep "admin_api"
```

### Prometheus Metrics

```bash
# Enable Prometheus plugin for metrics
curl -i -X POST http://localhost:8001/services/metricora-api/plugins \
  -H "Content-Type: application/json" \
  -d '{
    "name": "prometheus",
    "config": {
      "metrics": ["request_count", "latency", "status_count", "upstream_latency"]
    }
  }'

# Metrics endpoint
curl http://localhost:8001/metrics
```

## Troubleshooting

### Kong Won't Start

```bash
# Check logs
docker-compose -f docker-compose.kong.yml logs kong

# Verify database connection
docker-compose -f docker-compose.kong.yml logs kong-db

# Reset and start over
docker-compose -f docker-compose.kong.yml down -v
docker-compose -f docker-compose.kong.yml up -d
```

### Service Returns 503

```bash
# Check if MetricOra backend is running
curl http://localhost:3000/api/health

# Verify service configuration in Kong
curl http://localhost:8001/services/metricora-api

# Check route configuration
curl http://localhost:8001/services/metricora-api/routes
```

### Rate Limiting Not Working

```bash
# Verify rate limiting plugin is enabled
curl http://localhost:8001/services/metricora-api/plugins

# Check if consumer has correct ACL group
curl http://localhost:8001/consumers/org-acme-corp/acl

# Test rate limiting headers
curl -v http://localhost:8000/api/... \
  -H "apikey: your-key" \
  2>&1 | grep -i "rate-limit\|x-kong"
```

## Next Steps

1. Deploy Kong to production infrastructure (Docker Swarm/Kubernetes)
2. Configure TLS certificates for HTTPS
3. Set up automated failover and health checks
4. Integrate Kong metrics with Prometheus/Grafana
5. Create API key management UI for customers
6. Document API authentication for developer partners
7. Monitor and tune rate limit thresholds based on usage patterns

## References

- [Kong Official Documentation](https://docs.konghq.com/)
- [Kong Admin API Reference](https://docs.konghq.com/gateway-oss/latest/admin-api/)
- [Kong Plugins](https://docs.konghq.com/hub/)
- [Konga UI](https://pantsel.github.io/konga/)
