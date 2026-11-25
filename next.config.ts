import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import { unconfirmed } from "./src/content/unconfirmed";
import { isIndexable } from "./src/lib/indexing";
import { assertLaunchReady } from "./src/lib/launch-gate";

// Launch gate: SITE_INDEXABLE=true with any unconfirmed item fails the build,
// naming the items.
assertLaunchReady(process.env, unconfirmed);

function git(cmd: string): string | null {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

function buildSha(): string {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercel) return vercel.slice(0, 7);
  const sha = git("rev-parse --short=7 HEAD");
  if (!sha) return "nogit";
  const dirty = git("status --porcelain");
  return dirty ? `${sha}-dirty` : sha;
}

const nextConfig: NextConfig = {
  env: {
    BUILD_SHA: buildSha(),
    BUILD_TIME: new Date().toISOString(),
  },
  async headers() {
    if (isIndexable()) return [];
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
