import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function gitCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname, // ancestor lockfiles must not widen tracing beyond this app
  output: "standalone", // lets the Vultr add-on run the same build in a container
  env: { GIT_COMMIT: gitCommit() },
};

export default nextConfig;

