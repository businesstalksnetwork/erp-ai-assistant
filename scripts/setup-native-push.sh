#!/bin/bash
# Setup script for native push: migration, secrets, google-services.json
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=== 1. Run migration ==="
echo ""
echo "Option A: Supabase Dashboard"
echo "  1. Open https://supabase.com/dashboard/project/kskpmgohvrljbdphyzkw/sql"
echo "  2. Paste and run the SQL from: supabase/migrations/20260220120000_native_push_tokens.sql"
echo ""
echo "Option B: Supabase CLI (if linked)"
echo "  npx supabase link   # first time only"
echo "  npx supabase db push"
echo ""
read -p "Press Enter after migration is done..."

echo ""
echo "=== 2. Set Edge Function secrets ==="
echo ""
echo "Add these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:"
echo "  FIREBASE_SERVICE_ACCOUNT  (full JSON from Firebase Console → Service Accounts)"
echo "  APNS_KEY_ID"
echo "  APNS_TEAM_ID"
echo "  APNS_BUNDLE_ID = rs.aiknjigovodja.pausalbox"
echo "  APNS_KEY_P8    (contents of .p8 file)"
echo "  APNS_PRODUCTION = true or false"
echo ""
echo "Or via CLI: npx supabase secrets set FIREBASE_SERVICE_ACCOUNT='{\"type\":\"service_account\",...}'"
echo ""
read -p "Press Enter after secrets are set..."

echo ""
echo "=== 3. Add google-services.json (Android) ==="
echo ""
echo "  1. Open https://console.firebase.google.com/"
echo "  2. Create/select project → Add Android app"
echo "  3. Package: rs.aiknjigovodja.pausalbox"
echo "  4. Download google-services.json"
echo "  5. Copy to: android/app/google-services.json"
echo ""
if [ -f "android/app/google-services.json" ]; then
  echo "✓ google-services.json found"
else
  echo "✗ google-services.json NOT found. Add it to android/app/"
  echo "  cp /path/to/downloaded/google-services.json android/app/"
fi

echo ""
echo "Done. See NATIVE_PUSH_SETUP.md for full details."
