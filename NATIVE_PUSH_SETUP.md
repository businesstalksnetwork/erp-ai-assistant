# Native Push Notifications Setup

## 1. Run the migration

The `native_push_tokens` table must exist.

**Option A: Supabase Dashboard** (easiest)
1. Open [SQL Editor](https://supabase.com/dashboard/project/kskpmgohvrljbdphyzkw/sql/new)
2. Paste and run the contents of `supabase/migrations/20260220120000_native_push_tokens.sql`

**Option B: Via database URL**
```bash
# Get connection string from Supabase Dashboard → Settings → Database
SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.kskpmgohvrljbdphyzkw.supabase.co:5432/postgres" npm run migration:native-push
```

**Option C: Supabase CLI** (if linked)
```bash
npx supabase link --project-ref kskpmgohvrljbdphyzkw
npx supabase db push
```

---

## 2. Android (Firebase / FCM)

### Create Firebase project and app

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project or use an existing one
3. Add an **Android** app with package name: `rs.aiknjigovodja.pausalbox`
4. Download `google-services.json`
5. Place it in `android/app/google-services.json`

### Get service account for backend

1. Firebase Console → Project Settings → Service Accounts
2. Click **Generate new private key** (downloads a JSON file)
3. Add to Supabase: Project Settings → Edge Functions → Secrets
   - `FIREBASE_SERVICE_ACCOUNT` – full JSON string of the downloaded file (minified, single line)

---

## 3. iOS (APNs)

### Xcode setup

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select the **App** target → Signing & Capabilities
3. Click **+ Capability** → add **Push Notifications**
4. Add **Background Modes** → enable **Remote notifications**

### Apple Developer / APNs

1. Go to [Apple Developer](https://developer.apple.com/) → Certificates, Identifiers & Profiles
2. Create an **APNs Auth Key** (.p8):
   - Keys → Create a key → enable **Apple Push Notifications service (APNs)**
   - Download the .p8 file (only once) and note the **Key ID**
3. Add to Supabase Edge Function secrets:
   - `APNS_KEY_ID` – Key ID (e.g. `ABC123XYZ`)
   - `APNS_TEAM_ID` – Team ID (from Apple Developer account)
   - `APNS_BUNDLE_ID` – `rs.aiknjigovodja.pausalbox`
   - `APNS_KEY_P8` – full contents of the .p8 file
   - `APNS_PRODUCTION` – `true` for production, `false` for development/sandbox

---

## 4. Edge function

The `send-notification-emails` function already sends to both web push and native tokens. After setting the secrets below, it will deliver to FCM (Android) and APNs (iOS).

## 5. Edge function secrets

Set these in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

| Secret | Description |
|--------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | Full JSON of Firebase service account (for FCM) |
| `APNS_KEY_ID` | APNs key ID |
| `APNS_TEAM_ID` | Apple Team ID |
| `APNS_BUNDLE_ID` | `rs.aiknjigovodja.pausalbox` |
| `APNS_KEY_P8` | Contents of .p8 key file |
| `APNS_PRODUCTION` | `true` or `false` |
