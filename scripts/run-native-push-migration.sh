#!/bin/bash
# Run the native_push_tokens migration.
# Option 1: If Supabase CLI is installed and project is linked:
#   supabase db push
# Option 2: Copy the SQL below and run it in Supabase Dashboard → SQL Editor
echo "=== Run this SQL in Supabase Dashboard → SQL Editor ==="
echo ""
cat "$(dirname "$0")/../supabase/migrations/20260220120000_native_push_tokens.sql"
echo ""
echo "=== Or run: supabase db push (if CLI is linked) ==="
