#!/bin/bash

# Create API key for an organization in Kong
# Usage: ./scripts/create-api-key.sh org-123

if [ -z "$1" ]; then
  echo "Usage: $0 <org-id>"
  echo "Example: $0 org-123"
  exit 1
fi

ORG_ID=$1
KONG_ADMIN_URL=${KONG_ADMIN_URL:-http://localhost:8001}
API_KEY=$(openssl rand -hex 32)

echo "🔑 Creating API key for organization: $ORG_ID"
echo "   Kong Admin: $KONG_ADMIN_URL"

# 1. Create consumer
echo "📝 Creating consumer..."
CONSUMER_RESPONSE=$(curl -s -X POST "$KONG_ADMIN_URL/consumers" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"org-$ORG_ID\"}")

echo "$CONSUMER_RESPONSE" | grep -q "org-$ORG_ID" || echo "⚠️  Consumer may already exist"

# 2. Create API key (key-auth credential)
echo "📝 Creating API key credential..."
KEY_RESPONSE=$(curl -s -X POST "$KONG_ADMIN_URL/consumers/org-$ORG_ID/key-auth" \
  -H "Content-Type: application/json" \
  -d "{\"key\": \"$API_KEY\"}")

CREATED_KEY=$(echo "$KEY_RESPONSE" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CREATED_KEY" ]; then
  echo "⚠️  Failed to create key, trying to retrieve existing..."
  KEY_RESPONSE=$(curl -s "$KONG_ADMIN_URL/consumers/org-$ORG_ID/key-auth")
  CREATED_KEY=$(echo "$KEY_RESPONSE" | grep -o '"key":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

# 3. Add to ACL group
echo "📝 Adding to API access group..."
curl -s -X POST "$KONG_ADMIN_URL/consumers/org-$ORG_ID/acl" \
  -H "Content-Type: application/json" \
  -d '{"group": "carbonsite-api"}' > /dev/null 2>&1 || true

echo ""
echo "✅ API key created successfully!"
echo ""
echo "📋 API Key Details:"
echo "   Organization ID: $ORG_ID"
echo "   Consumer Name: org-$ORG_ID"
echo "   API Key: $CREATED_KEY"
echo ""
echo "🧪 Test the API key:"
echo "   curl -H 'apikey: $CREATED_KEY' http://localhost:8000/api/orgs/$ORG_ID/dashboard"
echo ""
echo "💾 Save this API key securely - it cannot be recovered if lost!"
echo ""
