import { NextResponse } from "next/server";
import {
  ANDROID_RELEASE,
  GITHUB_REPO,
  APK_ASSET_NAME,
  type AndroidRelease,
} from "@/lib/appVersion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GithubAsset = { name: string; browser_download_url: string };
type GithubRelease = {
  tag_name?: string;
  name?: string;
  assets?: GithubAsset[];
};

// Turn a release tag into an integer versionCode to compare against the app's
// own versionCode (from android/app/build.gradle). Tag the release "v<N>" where
// N matches that versionCode (e.g. v2). Falls back to null if it can't parse.
function tagToVersionCode(tag?: string): number | null {
  if (!tag) return null;
  const m = /^v?(\d+)$/.exec(tag.trim());
  return m ? Number(m[1]) : null;
}

// Reads the latest GitHub release so publishing a release (with a bumped "v<N>"
// tag and the APK attached) is all that's needed to push an app update — no web
// redeploy required. Cached briefly to stay well under GitHub's rate limit.
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
    const versionCode = tagToVersionCode(rel.tag_name);
    if (versionCode == null) return null;

    const asset = rel.assets?.find((a) => a.name === APK_ASSET_NAME);
    const url =
      asset?.browser_download_url ??
      `https://github.com/${GITHUB_REPO}/releases/latest/download/${APK_ASSET_NAME}`;

    return {
      versionCode,
      versionName: rel.name?.trim() || rel.tag_name || String(versionCode),
      url,
    };
  } catch {
    return null;
  }
}

// Version endpoint used by the client to detect updates:
//   - `web`: a per-deploy build id. When it changes, the running (cached) web
//     shell is stale and the app offers a one-tap refresh.
//   - `android`: the latest published APK (read live from GitHub Releases, with
//     the bundled constant as an offline fallback). The native app compares its
//     own versionCode against this to offer an in-app binary update.
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
