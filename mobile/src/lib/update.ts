import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { API_BASE } from '../config';

export const APP_VERSION = '1.0';
export const GITHUB_REPO = 'Rakitic07/ExpenseApp';
export const APK_ASSET_NAME = 'spendly-plus.apk';
export const RELEASE_PAGE = `https://github.com/${GITHUB_REPO}/releases/latest`;
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;
export const APK_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/${APK_ASSET_NAME}`;

const SEEN_SHA_KEY = 'spendly.update.sha';
// Path of the last downloaded APK, so we can delete it on the next launch.
const LAST_APK_KEY = 'spendly.update.apk';
// App-specific external dir; matches res/xml/file_paths.xml <external-files-path>.
const UPDATE_DIR = `${RNFS.ExternalDirectoryPath}/updates`;

type ApkInstaller = {
  canInstall(): Promise<boolean>;
  requestInstallPermission(): Promise<boolean>;
  install(path: string): Promise<boolean>;
  installedSha?(): Promise<string>;
};
const Installer: ApkInstaller | undefined = NativeModules.ApkInstaller;

// Normalize either "sha256:ABC…" (GitHub digest) or a bare hex string to
// lowercase hex so the installed APK and the release asset can be compared.
function normalizeSha(s: string): string {
  return s.replace(/^sha256:/i, '').trim().toLowerCase();
}

// Real sha256 of the running APK, via the native bridge. null on old builds
// (no bridge) or if hashing fails — callers fall back to the seen-sha baseline.
async function installedApkSha(): Promise<string | null> {
  try {
    if (!Installer?.installedSha) return null;
    const sha = await Installer.installedSha();
    return sha ? normalizeSha(sha) : null;
  } catch {
    return null;
  }
}

// True only when the native installer bridge is present (i.e. a build that
// includes ApkInstallerModule). Older APKs fall back to a browser download.
export function canAutoInstall(): boolean {
  return Platform.OS === 'android' && !!Installer;
}

// Thrown states surfaced to the UI so it can react (permission vs. hard error).
export class NeedsInstallPermission extends Error {}
export class NativeInstallerUnavailable extends Error {}

type VersionResp = {
  web?: string;
  android?: { versionName?: string; url?: string; assetSha?: string };
};

export type UpdateResult =
  | { status: 'latest'; versionName?: string }
  | { status: 'available'; url: string; versionName?: string }
  | { status: 'error' };

// Detects a new APK by comparing the sha256 of the *installed* binary against
// the latest GitHub release asset's sha256 (see /api/version). When the native
// bridge can read the installed sha we compare digests directly — precise, and
// immune to when the first check happened. Older builds without the bridge fall
// back to a first-seen baseline heuristic.
export async function checkForUpdate(): Promise<UpdateResult> {
  try {
    const res = await fetch(`${API_BASE}/api/version`);
    if (!res.ok) return { status: 'error' };
    const data = (await res.json()) as VersionResp;
    const remoteSha = normalizeSha(data.android?.assetSha ?? '');
    const url = data.android?.url || APK_URL;
    const versionName = data.android?.versionName;

    if (!remoteSha) {
      // Backend couldn't read a digest; nothing reliable to compare.
      return { status: 'latest', versionName };
    }

    // Preferred path: compare the real installed APK sha to the release digest.
    const localSha = await installedApkSha();
    if (localSha) {
      return localSha === remoteSha
        ? { status: 'latest', versionName }
        : { status: 'available', url, versionName };
    }

    // Fallback (old builds): baseline the first sha we see, flag when it changes.
    const seen = await AsyncStorage.getItem(SEEN_SHA_KEY);
    if (!seen) {
      await AsyncStorage.setItem(SEEN_SHA_KEY, remoteSha);
      return { status: 'latest', versionName };
    }
    if (seen !== remoteSha) {
      await AsyncStorage.setItem(SEEN_SHA_KEY, remoteSha);
      return { status: 'available', url, versionName };
    }
    return { status: 'latest', versionName };
  } catch {
    return { status: 'error' };
  }
}

// Diagnostic helper for the debug badge / "Check for updates": returns the
// installed APK sha and the latest release sha (both lowercase hex, or null).
export async function updateShas(): Promise<{ installed: string | null; remote: string | null }> {
  let remote: string | null = null;
  try {
    const res = await fetch(`${API_BASE}/api/version`);
    if (res.ok) {
      const data = (await res.json()) as VersionResp;
      remote = normalizeSha(data.android?.assetSha ?? '') || null;
    }
  } catch {
    remote = null;
  }
  return { installed: await installedApkSha(), remote };
}

// Removes any leftover APKs from a previous update so stale binaries never pile
// up on disk. Safe to call on every cold launch.
export async function purgeStaleApks(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(LAST_APK_KEY);
    if (stored) {
      await RNFS.unlink(stored).catch(() => {});
      await AsyncStorage.removeItem(LAST_APK_KEY);
    }
    if (await RNFS.exists(UPDATE_DIR)) {
      const files = await RNFS.readDir(UPDATE_DIR);
      await Promise.all(
        files
          .filter(f => f.name.endsWith('.apk'))
          .map(f => RNFS.unlink(f.path).catch(() => {})),
      );
    }
  } catch {
    // Best effort — a failed cleanup should never crash the app.
  }
}

// Downloads the APK in the background (reporting 0–100% via onProgress) and then
// hands it to the system installer. Throws NeedsInstallPermission if the user
// must first allow "install unknown apps", or NativeInstallerUnavailable on old
// builds without the native bridge (caller can fall back to a browser download).
export async function downloadAndInstall(
  url: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (!Installer) throw new NativeInstallerUnavailable('native installer missing');

  if (!(await Installer.canInstall())) {
    await Installer.requestInstallPermission();
    throw new NeedsInstallPermission('install permission required');
  }

  // Clear old binaries first, then fetch fresh into a unique filename.
  await purgeStaleApks();
  await RNFS.mkdir(UPDATE_DIR).catch(() => {});
  const dest = `${UPDATE_DIR}/spendly-plus-${Date.now()}.apk`;

  const { promise } = RNFS.downloadFile({
    fromUrl: url,
    toFile: dest,
    progressInterval: 250,
    progressDivider: 1,
    progress: res => {
      if (res.contentLength > 0 && onProgress) {
        onProgress(Math.min(100, Math.round((res.bytesWritten / res.contentLength) * 100)));
      }
    },
  });

  const result = await promise;
  if (result.statusCode && result.statusCode >= 400) {
    await RNFS.unlink(dest).catch(() => {});
    throw new Error(`download failed (${result.statusCode})`);
  }

  // Remember for post-install cleanup on the next launch, then hand off.
  await AsyncStorage.setItem(LAST_APK_KEY, dest);
  await Installer.install(dest);
}
