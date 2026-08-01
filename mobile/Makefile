# Spendly-Plus — React Native (bare) build helpers.
#
# Goal: build a phone APK locally with ONE command, no Android Studio GUI.
#
#   make setup      # one-time: install JDK 17 + Android SDK + NDK (Homebrew)
#   make android    # build a release APK -> outputs/spendly-plus.apk
#   make install    # build + adb install onto a connected device
#   make dev        # start the Metro bundler (JS dev server)
#   make run        # install a debug build + run on device/emulator
#   make clean      # clean android build artifacts
#   make doctor     # show detected toolchain
#
# After `make android`, install outputs/spendly-plus.apk on your phone (or
# upload it to a GitHub release and download it there).

SHELL := /bin/bash

APP_NAME     := spendly-plus
OUT_DIR      := outputs
RELEASE_APK  := android/app/build/outputs/apk/release/app-release.apk

# --- Toolchain autodetection ------------------------------------------------
BREW_PREFIX  := $(shell brew --prefix 2>/dev/null)
# Reuse the same Homebrew Android SDK location the Capacitor build used, so you
# don't download the SDK twice. Override with ANDROID_HOME=... if yours differs.
ANDROID_HOME ?= $(BREW_PREFIX)/share/android-commandlinetools
SDKMANAGER   := $(ANDROID_HOME)/cmdline-tools/latest/bin/sdkmanager

# RN 0.86 targets these exact versions (see android/build.gradle).
ANDROID_API        ?= 36
ANDROID_BUILDTOOLS ?= 36.0.0
NDK_VERSION        ?= 27.1.12297006

# Gradle 9.x needs JDK 17+. Prefer a system/Homebrew JDK 17; fall back to 21.
JAVA_HOME ?= $(shell /usr/libexec/java_home -v 17 2>/dev/null \
	|| echo $(BREW_PREFIX)/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home)
ifeq ($(wildcard $(JAVA_HOME)/bin/java),)
JAVA_HOME := $(shell /usr/libexec/java_home -v 21 2>/dev/null \
	|| echo $(BREW_PREFIX)/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home)
endif

export ANDROID_HOME
export ANDROID_SDK_ROOT := $(ANDROID_HOME)
export JAVA_HOME

.PHONY: help setup deps android install run dev clean doctor local-properties

help:
	@echo "Spendly-Plus (React Native) build targets:"
	@echo "  make setup     One-time: install JDK 17 + Android SDK + NDK (Homebrew)"
	@echo "  make deps      Install JS dependencies (npm install)"
	@echo "  make android   Build release APK -> $(OUT_DIR)/$(APP_NAME).apk"
	@echo "  make install   Build + adb install on a connected device"
	@echo "  make dev       Start the Metro bundler"
	@echo "  make run       Install a debug build and run on device/emulator"
	@echo "  make clean     Clean android build artifacts"
	@echo "  make doctor    Print detected JDK / Android SDK"

doctor:
	@echo "Homebrew     : $(if $(BREW_PREFIX),$(BREW_PREFIX),NOT FOUND — see https://brew.sh)"
	@printf "JDK          : "; if [ -x "$(JAVA_HOME)/bin/java" ]; then "$(JAVA_HOME)/bin/java" -version 2>&1 | head -1; else echo "NOT FOUND — run 'make setup'"; fi
	@printf "Android SDK  : "; if [ -x "$(SDKMANAGER)" ]; then echo "$(ANDROID_HOME)"; else echo "NOT FOUND — run 'make setup'"; fi
	@printf "NDK $(NDK_VERSION): "; if [ -d "$(ANDROID_HOME)/ndk/$(NDK_VERSION)" ]; then echo "found"; else echo "MISSING — run 'make setup'"; fi

setup:
	@command -v brew >/dev/null || { echo "Homebrew required: https://brew.sh"; exit 1; }
	brew install openjdk@17 || true
	brew install --cask android-commandlinetools || true
	@echo ">> Accepting Android SDK licenses..."
	@yes | "$(SDKMANAGER)" --licenses >/dev/null 2>&1 || true
	@echo ">> Installing SDK packages (platform-tools, android-$(ANDROID_API), build-tools $(ANDROID_BUILDTOOLS), ndk $(NDK_VERSION), cmake)..."
	"$(SDKMANAGER)" "platform-tools" "platforms;android-$(ANDROID_API)" "build-tools;$(ANDROID_BUILDTOOLS)" "ndk;$(NDK_VERSION)" "cmake;3.22.1"
	@echo ">> Toolchain ready. Now run:  make android"

deps:
	npm install

# Writes android/local.properties so gradle can locate the SDK.
local-properties:
	@echo "sdk.dir=$(ANDROID_HOME)" > android/local.properties
	@echo "-> android/local.properties (sdk.dir=$(ANDROID_HOME))"

android: local-properties
	@[ -x "$(JAVA_HOME)/bin/java" ] || { echo "JDK missing — run 'make setup'"; exit 1; }
	@[ -x "$(SDKMANAGER)" ] || { echo "Android SDK missing — run 'make setup'"; exit 1; }
	@echo "==> Building release APK (first build compiles native C++/Hermes; later builds are much faster)…"
	cd android && ./gradlew assembleRelease
	@mkdir -p $(OUT_DIR)
	@cp "$(RELEASE_APK)" "$(OUT_DIR)/$(APP_NAME).apk"
	@echo ""
	@echo "✅ Built $(OUT_DIR)/$(APP_NAME).apk"
	@ls -lh "$(OUT_DIR)/$(APP_NAME).apk"

install: android
	adb install -r "$(OUT_DIR)/$(APP_NAME).apk"

dev:
	npx react-native start

run: local-properties
	npx react-native run-android

clean:
	cd android && ./gradlew clean || true
	rm -rf $(OUT_DIR)
