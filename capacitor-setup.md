# Capacitor Setup - Paušal Box

Native Android and iOS apps are configured via [Capacitor](https://capacitorjs.com/).

## Prerequisites

- **Android**: [Android Studio](https://developer.android.com/studio) and JDK 17+
- **iOS**: [Xcode](https://developer.apple.com/xcode/) (macOS only)

## Commands

| Command | Description |
|--------|-------------|
| `npm run cap:sync` | Build web app and sync to native projects |
| `npm run cap:android` | Open Android project in Android Studio |
| `npm run cap:ios` | Open iOS project in Xcode |

## Running the Apps

1. Install [Android Studio](https://developer.android.com/studio) (Android) and/or [Xcode](https://developer.apple.com/xcode/) (iOS, macOS only)
2. Run `npm run cap:sync` to build and sync
3. Run `npm run cap:android` or `npm run cap:ios` to open the native IDE
4. In Android Studio: select a device/emulator and click Run
5. In Xcode: select a simulator or device and click Run

## App Icons & Splash Screens

Icons and splash screens are generated from `assets/logo.png` and `assets/logo-dark.png` using [@capacitor/assets](https://github.com/ionic-team/capacitor-assets).

To regenerate after changing the logo:

```bash
npx capacitor-assets generate --iconBackgroundColor '#faf8f5' --iconBackgroundColorDark '#0f172a' --splashBackgroundColor '#faf8f5' --splashBackgroundColorDark '#0f172a'
```

## Workflow

1. Make changes to the web app
2. Run `npm run cap:sync` to build and copy assets into `android/` and `ios/`
3. Open the native project and run on device/simulator

## Project Structure

- `dist/` – Built web assets (output of `npm run build`)
- `assets/` – Source logos for icons/splash (`logo.png`, `logo-dark.png`)
- `android/` – Android native project
- `ios/` – iOS native project
- `capacitor.config.ts` – Capacitor configuration

## Native Push Notifications

See **NATIVE_PUSH_SETUP.md** for full setup instructions:

- Run migration for `native_push_tokens` table
- Android: Firebase project + `google-services.json` in `android/app/`
- iOS: Push capability in Xcode + AppDelegate handlers (already added)
- Backend: Set FCM/APNs secrets; `send-notification-emails` sends to native tokens

## Notes

- The app loads the built web assets in a WebView
- `base: './'` in `vite.config.ts` is required for Capacitor loading
- Supabase auth uses production URL (`https://pausalbox.aiknjigovodja.rs`) for redirects
