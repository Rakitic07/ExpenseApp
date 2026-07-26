import { NextResponse } from "next/server";
import {
  ANDROID_RELEASE,
  GITHUB_REPO,
  APK_ASSET_NAME,
  type AndroidRelease,
} from "@/lib/appVersion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GithubAsset = {
  name: string;
  browser_download_url: string;
  // sha256 of the uploaded file, e.g. "sha256:c4f2764...". Present on newer
  // uploads; when absent we fall back to fields that still change on re-upload.
  digest?: string | null;
  updated_at?: string;
  id?: number;
};
type GithubRelease = {
  tag_name?: string;
  name?: string;
  assets?: GithubAsset[];
};

// Optional versionCode hint if the tag looks like "v<N>". Not required — the
// app detects updates by the APK's sha256 (see `assetSha`), so a fixed tag like
// "latest" that gets re-uploaded still works.
function tagToVersionCode(tag?: string): number {
  if (!tag) return 0;
  const m = /^v?(\d+)$/.exec(tag.trim());
  return m ? Number(m[1]) : 0;
}

// A value that changes whenever a NEW APK is uploaded — even to the same tag.
// Prefer the real sha256 digest; fall back to the asset's updated timestamp /
// id, both of which change on every re-upload (GitHub replaces the asset).
function assetFingerprint(asset?: GithubAsset): string {
  if (!asset) return "";
  if (asset.digest) return asset.digest.toLowerCase();
  if (asset.updated_at) return `u:${asset.updated_at}`;
  if (asset.id != null) return `id:${asset.id}`;
  return "";
}

// Reads the latest GitHub release. Publishing (or just re-uploading the APK to
// the existing release) is all that's needed to ship an update — no web
// redeploy. Cached briefly to stay well under GitHub's rate limit.
async function latestAndroidFromGithub(): Promise<AndroidRelease | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "spendly-plus",
        },
        // Cache for 5 minutes across requests (GitHub allows 60 calls/hr/IP).
        next: { revalidate: 300 },
      }
    );
    if (!res.ok) return null;

    const rel = (await res.json()) as GithubRelease;
    const asset = rel.assets?.find((a) => a.name === APK_ASSET_NAME);
    const url =
      asset?.browser_download_url ??
      `https://github.com/${GITHUB_REPO}/releases/latest/download/${APK_ASSET_NAME}`;

    return {
      versionCode: tagToVersionCode(rel.tag_name),
      versionName: rel.name?.trim() || rel.tag_name || "latest",
      url,
      assetSha: assetFingerprint(asset),
    };
  } catch {
    return null;
  }
}

// Version endpoint the native app polls to detect updates. `android.assetSha`
// is the sha256 of the latest APK on GitHub Releases; the app remembers the
// digest it last installed and offers an in-app update whenever this differs —
// so re-uploading a new binary to the same tag ("latest") is enough to ship it.
export async function GET() {
  const web =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "dev";

  const android = (await latestAndroidFromGithub()) ?? ANDROID_RELEASE;

  return NextResponse.json(
    { web, android },
    { headers: { "Cache-Control": "no-store" } }
  );
}
