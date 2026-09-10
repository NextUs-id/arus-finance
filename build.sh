#!/usr/bin/env bash
# Build Arus APK — minimal WebView wrapper, tanpa Gradle
# Sumber web (single source of truth): index.html, app.js, styles.css, fonts/ di root repo
# Script ini sync otomatis ke app/src/main/assets/ sebelum build.
set -euo pipefail

# SDK bisa dioverride: ANDROID_SDK_ROOT / ANDROID_HOME, fallback ke path lama
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/media/andrew/DATA1/07_System_Apps/Android_SDK}}"
JAVA_HOME="${JAVA_HOME:-$SDK/jdk17}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
PROJ="$(cd "$(dirname "$0")" && pwd)"
OUT="$PROJ/out"

export JAVA_HOME
export PATH="$JAVA_HOME/bin:$BT:$PATH"

echo "== 0/8 sync web -> assets =="
mkdir -p "$PROJ/app/src/main/assets/fonts"
cp -f "$PROJ/index.html" "$PROJ/app/src/main/assets/index.html"
cp -f "$PROJ/app.js" "$PROJ/app/src/main/assets/app.js"
cp -f "$PROJ/styles.css" "$PROJ/app/src/main/assets/styles.css"
cp -f "$PROJ/fonts/"*.woff2 "$PROJ/app/src/main/assets/fonts/" 2>/dev/null || true

echo "== 1/8 bersihkan out =="
rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

echo "== 2/8 aapt2 compile resources =="
aapt2 compile --dir "$PROJ/app/src/main/res" -o "$OUT/res.zip"

echo "== 3/8 aapt2 link (manifest + res + assets) =="
aapt2 link -o "$OUT/base.apk" \
  -I "$PLATFORM" \
  --manifest "$PROJ/app/src/main/AndroidManifest.xml" \
  -R "$OUT/res.zip" \
  --java "$OUT/gen" \
  -A "$PROJ/app/src/main/assets" \
  --auto-add-overlay

echo "== 4/8 javac =="
find "$OUT/gen" "$PROJ/app/src/main/java" -name "*.java" > "$OUT/sources.txt"
javac -source 8 -target 8 -Xlint:-options -bootclasspath "$PLATFORM" -d "$OUT/classes" @"$OUT/sources.txt"

echo "== 5/8 d8 (dex) =="
find "$OUT/classes" -name "*.class" > "$OUT/classes.txt"
d8 --lib "$PLATFORM" --release --output "$OUT/dex" @"$OUT/classes.txt"

echo "== 6/8 masukkan classes.dex ke APK =="
cp "$OUT/base.apk" "$OUT/app-unsigned.apk"
(cd "$OUT/dex" && zip -q -j "$OUT/app-unsigned.apk" classes.dex)

echo "== 7/8 zipalign =="
zipalign -f 4 "$OUT/app-unsigned.apk" "$OUT/app-aligned.apk"

echo "== 8/8 sign (keystore baru) =="
if [ ! -f "$PROJ/arus.keystore" ]; then
  echo "Keystore tidak ada, buat baru (untuk rilis, pakai keystore permanen!)"
  keytool -genkeypair -keystore "$PROJ/arus.keystore" -alias arus -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass arus123 -keypass arus123 \
    -dname "CN=Arus, OU=Dev, O=Arus, L=Jakarta, ST=DKI, C=ID"
fi
apksigner sign --ks "$PROJ/arus.keystore" --ks-pass pass:arus123 --out "$PROJ/Arus.apk" "$OUT/app-aligned.apk" 2>/dev/null || \
apksigner sign --ks "$PROJ/arus.keystore" --ks-pass:arus123 --out "$PROJ/Arus.apk" "$OUT/app-aligned.apk"

echo "== VERIFIKASI =="
apksigner verify --print-certs "$PROJ/Arus.apk"
aapt2 dump badging "$PROJ/Arus.apk" | head -8
ls -la "$PROJ/Arus.apk"
echo "BUILD SELESAI"
