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

sync: guard-server
	CAP_SERVER_URL="$(CAP_SERVER_URL)" npx cap sync

# --- Android ---------------------------------------------------------------
android apk: guard-server
	@[ -x "$(JAVA_HOME)/bin/java" ] || { echo "Java 21 missing — run 'make setup-android'"; exit 1; }
	@[ -x "$(SDKMANAGER)" ] || { echo "Android SDK missing — run 'make setup-android'"; exit 1; }
	CAP_SERVER_URL="$(CAP_SERVER_URL)" npx cap sync android
	@echo "sdk.dir=$(ANDROID_HOME)" > android/local.properties
	cd android && ./gradlew assembleDebug
	@cp android/app/build/outputs/apk/debug/app-debug.apk android/app/build/outputs/apk/debug/spendly-plus.apk
	@echo ""
	@echo "✅ APK: $(CURDIR)/android/app/build/outputs/apk/debug/spendly-plus.apk"

android-release: guard-server
	@[ -x "$(JAVA_HOME)/bin/java" ] || { echo "Java 21 missing — run 'make setup-android'"; exit 1; }
	@[ -x "$(SDKMANAGER)" ] || { echo "Android SDK missing — run 'make setup-android'"; exit 1; }
	CAP_SERVER_URL="$(CAP_SERVER_URL)" npx cap sync android
	@echo "sdk.dir=$(ANDROID_HOME)" > android/local.properties
	cd android && ./gradlew assembleRelease
	@cp android/app/build/outputs/apk/release/app-release-unsigned.apk android/app/build/outputs/apk/release/spendly-plus.apk
	@echo ""
	@echo "✅ Unsigned release APK: $(CURDIR)/android/app/build/outputs/apk/release/spendly-plus.apk"
	@echo "   (sign it with apksigner/zipalign before distributing)"

# --- Ship an update --------------------------------------------------------
# Bumps the Android versionCode/versionName and builds the APK in one step, so
# the in-app updater actually sees a newer binary. After it finishes, create a
# GitHub release tagged "v<CODE>" (the tag MUST match CODE) and attach the APK;
# installed apps then detect and offer the update automatically — no web
# redeploy needed (/api/version reads the latest GitHub release live).
#   Usage:  make release CODE=2            (versionName defaults to <CODE>.0)
#           make release CODE=2 NAME=1.0.1
release: guard-server
	@[ -n "$(CODE)" ] || { echo "Usage: make release CODE=2 [NAME=1.0.1]"; exit 1; }
	@NAME="$(NAME)"; NAME="$${NAME:-$(CODE).0}"; \
	 sed -i '' -E "s/versionCode [0-9]+/versionCode $(CODE)/" android/app/build.gradle; \
	 sed -i '' -E "s/versionName \"[^\"]*\"/versionName \"$$NAME\"/" android/app/build.gradle; \
	 echo ">> android/app/build.gradle -> versionCode $(CODE), versionName $$NAME"
	@$(MAKE) android CAP_SERVER_URL="$(CAP_SERVER_URL)"
	@echo ""
	@echo "➡  Now publish a GitHub release:"
	@echo "     tag = v$(CODE)   (must match versionCode)"
	@echo "     attach = $(CURDIR)/android/app/build/outputs/apk/debug/spendly-plus.apk"
	@echo "   Installed apps will then show the in-app update automatically."

# --- iOS (requires full Xcode) --------------------------------------------
ios: guard-server
	@xcodebuild -version >/dev/null 2>&1 || { echo "Full Xcode required (you have only Command Line Tools). Install Xcode from the Mac App Store, then: sudo xcode-select -s /Applications/Xcode.app"; exit 1; }
	CAP_SERVER_URL="$(CAP_SERVER_URL)" npx cap sync ios
	cd ios/App && xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug -derivedDataPath build build
	@echo ""
	@echo "✅ Simulator .app: $(CURDIR)/ios/App/build/Build/Products/Debug-iphonesimulator/App.app"
	@echo "   For a distributable .ipa, open in Xcode and use Product > Archive."

open-android: guard-server
	CAP_SERVER_URL="$(CAP_SERVER_URL)" npx cap sync android
	npx cap open android

open-ios: guard-server
	CAP_SERVER_URL="$(CAP_SERVER_URL)" npx cap sync ios
	npx cap open ios

clean:
	rm -rf android/app/build android/build ios/App/build ios/DerivedData
	@echo "Cleaned native build outputs."
