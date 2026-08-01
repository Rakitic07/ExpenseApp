# Spendly-Plus for Android — v1.0 (native rewrite)

**A brand-new, fully native Android app.** Spendly-Plus has been rebuilt from
the ground up in **React Native**, replacing the old Capacitor/WebView build.
No more scroll stutter — every screen now runs on real native views.

## What's new
- ⚡ **Native performance** — smooth scrolling and instant tab switches (native
  UI instead of a WebView wrapping the website).
- 📊 **Skia-powered charts** — category donut + monthly trend that render fast.
- 🧾 **Redesigned expense flow** — quick add/edit with **payment mode**
  (Cash / UPI / Card) and currency-aware providers, category picker, and a
  floating **+** button.
- 🎯 **Budget ring** with today / avg-per-day stats and top categories at a glance.
- 📴 **Offline-first** — opens instantly from cache; your changes are saved
  locally and sync automatically when you're back online.
- 🔒 Same secure backend and account — signs in to your existing space with
  token-based auth.

## Install
1. Download **`spendly-plus.apk`** from this release.
2. On your phone, open it and allow "install from unknown sources" if prompted.
3. Installing over a previous build upgrades it in place (same signer).

> Built for **arm64-v8a** (all modern phones). For an emulator or older 32-bit
> device, build a universal APK from source — see `mobile/README.md`.

## Notes
- Under the hood: React Native 0.86 (Hermes, New Architecture),
  React Navigation, victory-native (Skia), Reanimated, AsyncStorage.
- The website's **"Download for Android"** button always serves the APK attached
  to this release.

---
_Technical: `applicationId com.spendlynative`, versionName 1.0 (versionCode 1)._
