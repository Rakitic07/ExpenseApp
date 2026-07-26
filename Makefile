# Spendly-Plus — native build helpers (no Android Studio / Xcode GUI needed for Android)
#
# Quick start (Android):
#   1. one-time toolchain install (JDK + Android SDK via Homebrew):
#        make setup-android
#   2. build a debug APK pointed at your deployment:
#        make android CAP_SERVER_URL=https://your-app.vercel.app
#      (or put CAP_SERVER_URL=... in .env and just run `make android`)
#
# iOS needs the full Xcode app from the Mac App Store (Command Line Tools alone
# cannot build/sign an iOS app). Once installed: `make ios CAP_SERVER_URL=...`.

SHELL := /bin/bash

# Deployment URL the native shell should load. Falls back to a CAP_SERVER_URL
# line in .env if present, so you don't have to retype it every time.
CAP_SERVER_URL ?= $(shell grep -E '^CAP_SERVER_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")

# Toolchain locations (auto-detected; override on the command line if needed).
BREW_PREFIX  := $(shell brew --prefix 2>/dev/null)
ANDROID_HOME ?= $(BREW_PREFIX)/share/android-commandlinetools
# Capacitor 7 needs JDK 21. Prefer a system JDK 21; otherwise fall back to the
# keg-only Homebrew openjdk@21 (installed by `make setup-android`, no sudo needed).
JAVA_HOME    ?= $(shell /usr/libexec/java_home -v 21 2>/dev/null || echo $(BREW_PREFIX)/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home)
SDKMANAGER   := $(ANDROID_HOME)/cmdline-tools/latest/bin/sdkmanager

# Android SDK packages to install (API 35 matches Capacitor 6 defaults).
ANDROID_API        ?= 35
ANDROID_BUILDTOOLS ?= 35.0.0

export ANDROID_HOME
export ANDROID_SDK_ROOT = $(ANDROID_HOME)
export JAVA_HOME

.PHONY: help doctor setup-android sync android apk android-release release ios open-android open-ios clean

help:
	@echo "Spendly-Plus native build targets:"
	@echo "  make doctor           - check what toolchain is installed/missing"
	@echo "  make setup-android    - one-time: install JDK 17 + Android SDK (Homebrew)"
	@echo "  make android          - build a debug APK  (needs CAP_SERVER_URL)"
	@echo "  make release CODE=2   - bump version to <CODE> and build the APK (for a new update)"
	@echo "  make android-release  - build an unsigned release APK"
	@echo "  make ios              - build for iOS Simulator (needs full Xcode)"
	@echo "  make sync             - just sync the web config into the native projects"
	@echo "  make open-android / open-ios - open the native IDE (if installed)"
	@echo "  make clean            - remove native build outputs"
	@echo ""
	@echo "Pass your deployment URL once: make android CAP_SERVER_URL=https://your-app.vercel.app"
	@echo "(or add a CAP_SERVER_URL=... line to .env)"

guard-server:
	@if [ -z "$(CAP_SERVER_URL)" ]; then \
		echo "ERROR: CAP_SERVER_URL is not set."; \
		echo "  e.g. make android CAP_SERVER_URL=https://your-app.vercel.app"; \
		echo "  or add 'CAP_SERVER_URL=https://your-app.vercel.app' to .env"; \
		exit 1; \
	fi

doctor:
	@echo "Homebrew : $(if $(BREW_PREFIX),$(BREW_PREFIX),NOT FOUND — see https://brew.sh)"
	@printf "Java 21  : "; if [ -x "$(JAVA_HOME)/bin/java" ]; then echo "$(JAVA_HOME)"; else echo "NOT FOUND — run 'make setup-android'"; fi
	@printf "Android  : "; if [ -x "$(SDKMANAGER)" ]; then echo "$(ANDROID_HOME)"; else echo "NOT FOUND — run 'make setup-android'"; fi
	@printf "Xcode    : "; if xcodebuild -version >/dev/null 2>&1; then xcodebuild -version | head -1; else echo "full Xcode NOT FOUND (needed for iOS) — install from the Mac App Store"; fi
	@printf "Server   : "; if [ -n "$(CAP_SERVER_URL)" ]; then echo "$(CAP_SERVER_URL)"; else echo "unset (pass CAP_SERVER_URL=...)"; fi

setup-android:
	@command -v brew >/dev/null || { echo "Homebrew required: https://brew.sh"; exit 1; }
	brew install openjdk@21 || true
	brew install --cask android-commandlinetools || true
	@echo ">> Accepting Android SDK licenses..."
	yes | "$(SDKMANAGER)" --licenses >/dev/null || true
	@echo ">> Installing SDK packages (platform-tools, android-$(ANDROID_API), build-tools $(ANDROID_BUILDTOOLS))..."
	"$(SDKMANAGER)" "platform-tools" "platforms;android-$(ANDROID_API)" "build-tools;$(ANDROID_BUILDTOOLS)"
	@echo ">> Done. Now run:  make android CAP_SERVER_URL=https://your-app.vercel.app"

# Build the static web bundle (out/) that gets packaged into the app, pointing
# its API calls at the deployed backend, then copy it into the native project.
sync: guard-server
	NEXT_PUBLIC_API_BASE="$(CAP_SERVER_URL)" npm run build:native
	npx cap sync

# --- Android ---------------------------------------------------------------
android apk: guard-server
	@[ -x "$(JAVA_HOME)/bin/java" ] || { echo "Java 21 missing — run 'make setup-android'"; exit 1; }
	@[ -x "$(SDKMANAGER)" ] || { echo "Android SDK missing — run 'make setup-android'"; exit 1; }
	NEXT_PUBLIC_API_BASE="$(CAP_SERVER_URL)" npm run build:native
	npx cap sync android
	@echo "sdk.dir=$(ANDROID_HOME)" > android/local.properties
	cd android && ./gradlew assembleDebug
	@cp android/app/build/outputs/apk/debug/app-debug.apk android/app/build/outputs/apk/debug/spendly-plus.apk
	@echo ""
	@echo "✅ APK: $(CURDIR)/android/app/build/outputs/apk/debug/spendly-plus.apk"

android-release: guard-server
	@[ -x "$(JAVA_HOME)/bin/java" ] || { echo "Java 21 missing — run 'make setup-android'"; exit 1; }
	@[ -x "$(SDKMANAGER)" ] || { echo "Android SDK missing — run 'make setup-android'"; exit 1; }
	NEXT_PUBLIC_API_BASE="$(CAP_SERVER_URL)" npm run build:native
	npx cap sync android
	@echo "sdk.dir=$(ANDROID_HOME)" > android/local.properties
	cd android && ./gradlew assembleRelease
	@cp android/app/build/outputs/apk/release/app-release-unsigned.apk android/app/build/outputs/apk/release/spendly-plus.apk
	@echo ""
	@echo "✅ Unsigned release APK: $(CURDIR)/android/app/build/outputs/apk/release/spendly-plus.apk"
	@echo "   (sign it with apksigner/zipalign before distributing)"

# --- Ship an update --------------------------------------------------------
# Builds the APK. Updates are detected by the APK's sha256 (the release ASSET
# digest), NOT the git tag/commit — so you can keep a single fixed release tag
# ("latest") and just re-upload the new spendly-plus.apk to it. /api/version
# reads the latest release's asset digest live; installed apps compare it to the
# digest they installed and offer the in-app update. No web redeploy needed.
#
#   Usage:  make release                 (build only; then upload the APK)
#           make release CODE=2 NAME=1.0.1   (also bump versionCode/versionName)
release: guard-server
	@if [ -n "$(CODE)" ]; then \
	   NAME="$(NAME)"; NAME="$${NAME:-$(CODE).0}"; \
	   sed -i '' -E "s/versionCode [0-9]+/versionCode $(CODE)/" android/app/build.gradle; \
	   sed -i '' -E "s/versionName \"[^\"]*\"/versionName \"$$NAME\"/" android/app/build.gradle; \
	   echo ">> android/app/build.gradle -> versionCode $(CODE), versionName $$NAME"; \
	 fi
	@$(MAKE) android CAP_SERVER_URL="$(CAP_SERVER_URL)"
	@APK="$(CURDIR)/android/app/build/outputs/apk/debug/spendly-plus.apk"; \
	 echo ""; \
	 echo "➡  Upload this APK to the GitHub release (re-uploading to the same"; \
	 echo "   'latest' tag is fine — the changed sha256 triggers the update):"; \
	 echo "     $$APK"; \
	 echo ""; \
	 echo "   Replace the asset on the existing release (GitHub CLI):"; \
	 echo "     gh release upload latest \"$$APK\" --clobber"; \
	 echo ""; \
	 echo "   Installed apps will detect the new APK sha256 and offer the update."

# --- iOS (requires full Xcode) --------------------------------------------
ios: guard-server
	@xcodebuild -version >/dev/null 2>&1 || { echo "Full Xcode required (you have only Command Line Tools). Install Xcode from the Mac App Store, then: sudo xcode-select -s /Applications/Xcode.app"; exit 1; }
	NEXT_PUBLIC_API_BASE="$(CAP_SERVER_URL)" npm run build:native
	npx cap sync ios
	cd ios/App && xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug -derivedDataPath build build
	@echo ""
	@echo "✅ Simulator .app: $(CURDIR)/ios/App/build/Build/Products/Debug-iphonesimulator/App.app"
	@echo "   For a distributable .ipa, open in Xcode and use Product > Archive."

open-android: guard-server
	NEXT_PUBLIC_API_BASE="$(CAP_SERVER_URL)" npm run build:native
	npx cap sync android
	npx cap open android

open-ios: guard-server
	NEXT_PUBLIC_API_BASE="$(CAP_SERVER_URL)" npm run build:native
	npx cap sync ios
	npx cap open ios

clean:
	rm -rf android/app/build android/build ios/App/build ios/DerivedData out .native-build-bak
	@echo "Cleaned native build outputs."
