#!/bin/bash
# Deploy pending Prisma migrations to production Supabase

set -e

echo "🚀 Deploying pending migrations..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not set. Set it and try again:"
  echo "  export DATABASE_URL='postgresql://...'"
  exit 1
fi

# Run migrations
pnpm prisma migrate deploy

echo "✅ Migrations deployed successfully"
echo ""
echo "Verify in Supabase SQL Editor:"
echo "  SELECT * FROM information_schema.columns"
echo "  WHERE table_name='organizations' AND column_name='is_pilot'"
