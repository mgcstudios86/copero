#!/bin/bash
# MGC-1506 — eas build --local sobre fix/mgc1506-version-settings (92e3b01)
# Settings modal + VersionBadge global + link ⚙ en SiteHeader.
# Output: builds/build-PR-383-15-92e3b01.apk
set -euo pipefail

source ~/.paperclip-runtime/toolchain.sh
export EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP=1

WT=/Users/matiasgonzalocalvo/.paperclip/instances/default/projects/2bfc6b80-84c1-4b52-b941-18b23ed2b1a6/e18760fd-f96a-421c-90ac-1a2b13d3a65d/_default/copero-mgc358
SHA=$(git -C "$WT" rev-parse --short HEAD)
APK_DIR=/Users/matiasgonzalocalvo/Desktop/mgcstudios/copero/qa/builds
LOG="$WT/builds/build-PR-383-15-${SHA}.log"
APK="$APK_DIR/build-PR-383-15-${SHA}.apk"

mkdir -p "$WT/builds" "$APK_DIR"

cd "$WT"

BR=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BR" != "fix/mgc1506-version-settings" ]]; then
  echo "ABORT: branch $BR != fix/mgc1506-version-settings" >&2
  exit 1
fi
HEAD_SHA=$(git rev-parse HEAD)
export EAS_BUILD_GIT_COMMIT_HASH="$HEAD_SHA"
echo "[$(date +%H:%M:%S)] HEAD $HEAD_SHA branch $BR EAS_BUILD_GIT_COMMIT_HASH=$EAS_BUILD_GIT_COMMIT_HASH" | tee "$LOG"

INFISICAL_JWT=$(infisical login --method universal-auth \
  --client-id "$INFISICAL_CLIENT_ID" --client-secret "$INFISICAL_CLIENT_SECRET" --plain 2>/dev/null | tail -1)
export INFISICAL_JWT
echo "[$(date +%H:%M:%S)] infisical JWT refrescado (${#INFISICAL_JWT} chars)" | tee -a "$LOG"

while pgrep -fl "eas-cli-local-build-plugin" 2>/dev/null | grep -v "$$" >/dev/null 2>&1; do
  echo "[$(date +%H:%M:%S)] esperando eas process previo..." | tee -a "$LOG"
  sleep 30
done

echo "[$(date +%H:%M:%S)] eas --local kickoff" | tee -a "$LOG"

infisical run --env=prod --path=/copero --token="$INFISICAL_JWT" \
  -- eas build --local --platform android --profile preview \
  --non-interactive --output "$APK" 2>&1 | tee -a "$LOG"

echo "[$(date +%H:%M:%S)] eas --local finished" | tee -a "$LOG"

if [[ -f "$APK" ]]; then
  APK_SHA=$(shasum -a 256 "$APK" | awk '{print $1}')
  APK_SIZE=$(stat -f %z "$APK")
  echo "[$(date +%H:%M:%S)] APK SHA256: $APK_SHA  size: $APK_SIZE bytes" | tee -a "$LOG"

  TMPDIR=$(mktemp -d)
  unzip -q "$APK" -d "$TMPDIR"
  BUNDLE="$TMPDIR/assets/index.android.bundle"
  if [[ -f "$BUNDLE" ]]; then
    BUNDLE_SHA=$(shasum -a 256 "$BUNDLE" | awk '{print $1}')
    BUNDLE_SIZE=$(stat -f %z "$BUNDLE")
    echo "[$(date +%H:%M:%S)] BUNDLE SHA256: $BUNDLE_SHA  size: $BUNDLE_SIZE bytes" | tee -a "$LOG"
  else
    echo "[$(date +%H:%M:%S)] WARN: index.android.bundle NO encontrado" | tee -a "$LOG"
  fi
  rm -rf "$TMPDIR"
fi
