#!/usr/bin/env bash
set -euo pipefail
SOURCE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SOURCE/../../.." && pwd)"
SDK="${ANDROID_SDK_ROOT:-/tmp/quillayaa-android-sdk}"
OUT="$ROOT/generated-artifacts/android"
BUILD="$(mktemp -d /tmp/quillayaa-apk-build.XXXXXX)"
trap 'rm -rf "$BUILD"' EXIT
URL="${1:-}"
if [[ ! "$URL" =~ ^https://[a-zA-Z0-9.-]+(/[^\"\\]*)?$ ]]; then
  echo "Uso: bash build.sh https://dominio-del-proyecto/login" >&2; exit 1
fi
if [[ -z "${JAVA_HOME:-}" ]]; then
  if command -v javac >/dev/null; then
    JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
  else
    JAVA_BIN=""
    for candidate in /nix/store/*-openjdk-21*/bin/javac; do
      if [[ -x "$candidate" ]]; then JAVA_BIN="$candidate"; break; fi
    done
    [[ -n "$JAVA_BIN" ]] || { echo "Se requiere JDK 21." >&2; exit 1; }
    JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
  fi
fi
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"
mkdir -p "$SDK" "$OUT" "$BUILD/classes" "$BUILD/dex"
if [[ ! -f "$SDK/android-15/lib/d8.jar" ]]; then
  curl -fsSL --retry 2 https://dl.google.com/android/repository/build-tools_r35_linux.zip -o "$SDK/build-tools.zip"
  echo "2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc  $SDK/build-tools.zip" | sha1sum -c -
  unzip -q "$SDK/build-tools.zip" -d "$SDK"
fi
if [[ ! -f "$SDK/android-35/android.jar" ]]; then
  curl -fsSL --retry 2 https://dl.google.com/android/repository/platform-35_r02.zip -o "$SDK/platform.zip"
  echo "0bb560a90a7a2cbd0dd8348224d518b638fe7949  $SDK/platform.zip" | sha1sum -c -
  unzip -q "$SDK/platform.zip" -d "$SDK"
fi
TOOLS="$SDK/android-15"
ANDROID="$SDK/android-35/android.jar"
printf 'package pe.quillayaa.pruebas; public final class BuildConfig { public static final String HOME_URL = "%s"; }\n' "$URL" > "$BUILD/BuildConfig.java"
"$TOOLS/aapt2" compile --dir "$SOURCE/res" -o "$BUILD/resources.zip"
"$TOOLS/aapt2" link -o "$BUILD/base.apk" -I "$ANDROID" --manifest "$SOURCE/AndroidManifest.xml" "$BUILD/resources.zip"
javac --release 8 -classpath "$ANDROID" -d "$BUILD/classes" \
  "$BUILD/BuildConfig.java" "$SOURCE/src/pe/quillayaa/pruebas/MainActivity.java"
find "$BUILD/classes" -name '*.class' -print0 | xargs -0 java -cp "$TOOLS/lib/d8.jar" \
  com.android.tools.r8.D8 --lib "$ANDROID" --min-api 29 --output "$BUILD/dex"
cp "$BUILD/base.apk" "$BUILD/unsigned.apk"
(cd "$BUILD/dex" && zip -q "$BUILD/unsigned.apk" classes.dex)
"$TOOLS/zipalign" -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"
# Disposable test signing key, not a production/release identity.
keytool -genkeypair -keystore "$BUILD/test-signing.p12" -storepass android -keypass android \
  -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 365 \
  -dname "CN=QUILLAYAA Test, O=QUILLAYAA, C=PE" >/dev/null 2>&1
java -jar "$TOOLS/lib/apksigner.jar" sign --ks "$BUILD/test-signing.p12" \
  --ks-pass pass:android --key-pass pass:android --out "$OUT/QUILLAYAA-pruebas.apk" "$BUILD/aligned.apk"
java -jar "$TOOLS/lib/apksigner.jar" verify --verbose "$OUT/QUILLAYAA-pruebas.apk"
"$TOOLS/aapt2" dump badging "$OUT/QUILLAYAA-pruebas.apk" | head -18
echo "APK: $OUT/QUILLAYAA-pruebas.apk"
