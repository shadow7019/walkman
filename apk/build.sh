#!/bin/bash
# Builds the Walkman Android APK without Gradle using aapt2 + javac + d8 + apksigner.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-$HERE/android-sdk}"
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
OUT="$HERE/build"
KEYSTORE="$HERE/walkman.keystore"
FINAL="$HERE/walkman.apk"

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/dex" "$OUT/apk" "$OUT/gen"

echo "[1/7] aapt2 compile resources"
"$BT/aapt2" compile --dir "$HERE/res" -o "$OUT/res.zip"

echo "[2/7] aapt2 link (manifest + resources + android.jar)"
"$BT/aapt2" link \
  -I "$PLATFORM" \
  --manifest "$HERE/AndroidManifest.xml" \
  --java "$OUT/gen" \
  -o "$OUT/base.apk" \
  "$OUT/res.zip"

echo "[3/7] javac compile (ecj)"
java -jar "$SDK/ecj.jar" \
  -source 1.8 -target 1.8 \
  -bootclasspath "$PLATFORM" \
  -classpath "$PLATFORM" \
  -d "$OUT/classes" \
  -nowarn \
  $(find "$HERE/java" -name '*.java') \
  "$OUT/gen/com/walkman/app/R.java"

echo "[4/7] d8 dex"
"$BT/d8" \
  --release \
  --lib "$PLATFORM" \
  --output "$OUT/dex" \
  $(find "$OUT/classes" -name '*.class')

echo "[5/7] package dex into APK"
cd "$OUT/apk"
cp "$OUT/base.apk" .
zip -q base.apk classes_dex_placeholder 2>/dev/null || true
cd "$HERE"
# add classes.dex (must be stored at APK root)
cd "$OUT/dex" && zip -q -j "$OUT/apk/base.apk" classes.dex && cd "$HERE"

echo "[6/7] zipalign"
"$BT/zipalign" -f 4 "$OUT/apk/base.apk" "$OUT/aligned.apk"

echo "[7/7] sign"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -alias walkman \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass walkman123 -keypass walkman123 \
    -dname "CN=Walkman, OU=Walkman, O=Walkman, L=Internet, C=US"
fi
"$BT/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias walkman \
  --ks-pass pass:walkman123 \
  --out "$FINAL" \
  "$OUT/aligned.apk"

"$BT/apksigner" verify "$FINAL" && echo "APK OK -> $FINAL"
ls -la "$FINAL"
