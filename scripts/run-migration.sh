#!/usr/bin/env bash
set -euo pipefail
# Usage: SUPABASE_DB_URL=postgresql://user:pass@host:5432/db psql -f supabase/migrations/20260824001300_add_recommendation_fingerprint.sql
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Set SUPABASE_DB_URL environment variable to your database connection string (pghost/user)..."
  exit 1
fi
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260824001300_add_recommendation_fingerprint.sql

echo "Migration applied."
