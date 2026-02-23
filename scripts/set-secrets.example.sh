#!/bin/bash
# Set native push secrets. Copy to set-secrets.sh, fill in values, run.
# Or run these manually in Supabase Dashboard → Project Settings → Edge Functions → Secrets.

# Link project first: npx supabase link --project-ref kskpmgohvrljbdphyzkw

# Firebase (minified JSON, single line)
# npx supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'

# APNs
# npx supabase secrets set APNS_KEY_ID='YOUR_KEY_ID'
# npx supabase secrets set APNS_TEAM_ID='YOUR_TEAM_ID'
# npx supabase secrets set APNS_BUNDLE_ID='rs.aiknjigovodja.pausalbox'
# npx supabase secrets set APNS_KEY_P8='-----BEGIN PRIVATE KEY-----
# ...contents of .p8 file...
# -----END PRIVATE KEY-----'
# npx supabase secrets set APNS_PRODUCTION='false'
