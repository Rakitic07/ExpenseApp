// GitHub repo (owner/name) and release asset that host the Android binary.
export const GITHUB_REPO = "Rakitic07/ExpenseApp";
export const APK_ASSET_NAME = "spendly-plus.apk";

// Offline / rate-limited FALLBACK for the latest Android binary.
//
// The live value comes from the latest GitHub Release (see /api/version), so
// normally you only publish a release to ship an update. Keep `versionCode` here
// in rough sync with android/app/build.gradle just so the fallback is sane when
// GitHub can't be reached; the GitHub release tag ("v<N>") is the real source.
export type AndroidRelease = {
  versionCode: number;
  versionName: string;
  url: string;
  // sha256 of the latest APK asset (e.g. "sha256:..."), or a fallback token that
  // still changes on every re-upload. The app remembers the digest it installed
  // and offers an update whenever this differs — works even when re-uploading to
  // a single fixed tag like "latest".
  assetSha: string;
};

export const ANDROID_RELEASE: AndroidRelease = {
  versionCode: 1,
  versionName: "1.0",
  url: `https://github.com/${GITHUB_REPO}/releases/latest/download/${APK_ASSET_NAME}`,
  assetSha: "",
};
