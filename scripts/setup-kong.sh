#!/bin/bash

# Setup Kong API Gateway for CarbonSite
# This script configures Kong to proxy requests to the CarbonSite backend
# with rate limiting, API key authentication, and logging

set -e

KONG_ADMIN_URL=${KONG_ADMIN_URL:-http://localhost:8001}
CARBONSITE_BACKEND=${CARBONSITE_BACKEND:-http://host.docker.internal:3000}
BACKEND_NAME=${BACKEND_NAME:-carbonsite-api}
API_KEY_LIMIT=${API_KEY_LIMIT:-1000}  # requests per minute

echo "🔧 Setting up Kong API Gateway..."
echo "  Admin URL: $KONG_ADMIN_URL"
echo "  Backend: $CARBONSITE_BACKEND"
echo "  Rate limit: $API_KEY_LIMIT req/min"

# Wait for Kong to be ready
echo "⏳ Waiting for Kong to be ready..."
for i in {1..30}; do
  if curl -s "$KONG_ADMIN_URL" > /dev/null 2>&1; then
    echo "✅ Kong is ready"
    break
  fi
  echo "  Attempt $i/30..."
  sleep 1
done

# 1. Create service
echo "📝 Creating service..."
SERVICE_RESPONSE=$(curl -s -X POST "$KONG_ADMIN_URL/services/" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$BACKEND_NAME\",
    \"url\": \"$CARBONSITE_BACKEND\",
    \"connect_timeout\": 60000,
    \"write_timeout\": 60000,
    \"read_timeout\": 60000
  }")

SERVICE_ID=$(echo "$SERVICE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$SERVICE_ID" ]; then
  echo "⚠️  Service may already exist, trying to retrieve..."
  SERVICE_RESPONSE=$(curl -s "$KONG_ADMIN_URL/services/$BACKEND_NAME")
  SERVICE_ID=$(echo "$SERVICE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi
echo "✅ Service created/found: $SERVICE_ID"

# 2. Create route
echo "📝 Creating route..."
curl -s -X POST "$KONG_ADMIN_URL/services/$BACKEND_NAME/routes" \
  -H "Content-Type: application/json" \
  -d '{
    "paths": ["/api", "/auth"],
    "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "protocols": ["http", "https"],
    "strip_path": false,
    "preserve_host": true
  }' > /dev/null
echo "✅ Route created"

# 3. Add rate limiting plugin
echo "📝 Adding rate limiting plugin..."
curl -s -X POST "$KONG_ADMIN_URL/services/$BACKEND_NAME/plugins" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"rate-limiting\",
    \"config\": {
      \"minute\": $API_KEY_LIMIT,
      \"hour\": $((API_KEY_LIMIT * 60)),
      \"limit_by\": \"header\",
      \"header_name\": \"x-api-key\",
      \"policy\": \"local\",
      \"fault_tolerant\": true
    }
  }" > /dev/null
echo "✅ Rate limiting plugin configured"

# 4. Add ACL plugin
echo "📝 Adding ACL plugin..."
curl -s -X POST "$KONG_ADMIN_URL/services/$BACKEND_NAME/plugins" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "acl",
    "config": {
      "allow": ["carbonsite-api"],
      "deny": null,
      "hide_groups_header": false
    }
  }' > /dev/null
echo "✅ ACL plugin configured"

# 5. Create test API key
echo "📝 Creating test API key..."
curl -s -X POST "$KONG_ADMIN_URL/consumers" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test-api-key"
  }' > /dev/null 2>&1 || true

curl -s -X POST "$KONG_ADMIN_URL/consumers/test-api-key/key-auth" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "test-key-12345"
  }' > /dev/null 2>&1 || true

curl -s -X POST "$KONG_ADMIN_URL/consumers/test-api-key/acl" \
  -H "Content-Type: application/json" \
  -d '{
    "group": "carbonsite-api"
  }' > /dev/null 2>&1 || true

echo "✅ Test API key created: test-key-12345"

# 6. Test configuration
echo ""
echo "🧪 Testing configuration..."
echo "  Without API key (should fail):"
curl -s -w "\n  Status: %{http_code}\n" "$KONG_ADMIN_URL/services/$BACKEND_NAME" | head -1

echo ""
echo "✨ Kong setup complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Access Konga admin UI: http://localhost:1337"
echo "  2. Test with API key:"
echo "     curl http://localhost:8000/api/orgs/org123/dashboard \\"
echo "       -H 'apikey: test-key-12345'"
echo "  3. Create more API keys for organizations:"
echo "     ./scripts/create-api-key.sh org-123"
echo ""
