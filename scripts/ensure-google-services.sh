#!/bin/bash
# Ensures google-services.json exists and opens Firebase Console if not.
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$PROJECT_ROOT/android/app/google-services.json"

if [ -f "$FILE" ]; then
  echo "✓ google-services.json exists"
  exit 0
fi

echo "google-services.json not found."
echo ""
echo "To add it:"
echo "  1. Open https://console.firebase.google.com/"
echo "  2. Create/select project → Add Android app"
echo "  3. Package name: rs.aiknjigovodja.pausalbox"
echo "  4. Download google-services.json"
echo "  5. Copy to: android/app/google-services.json"
echo ""
if command -v open &>/dev/null; then
  open "https://console.firebase.google.com/"; echo "Opened Firebase Console"
elif command -v xdg-open &>/dev/null; then
  xdg-open "https://console.firebase.google.com/"; echo "Opened Firebase Console"
fi
