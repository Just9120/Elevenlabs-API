import { mkdir, writeFile } from "node:fs/promises";

const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const exactCommit = /^[0-9a-f]{40}$/;
const runtimeEnvironment = globalThis.process.env;
const releaseVersion = runtimeEnvironment.STUDIO_RUNTIME_RELEASE_VERSION ?? "unknown";
const commitSha = runtimeEnvironment.STUDIO_RUNTIME_COMMIT_SHA ?? "unknown";
const buildId = runtimeEnvironment.STUDIO_RUNTIME_BUILD_ID ?? "unknown";
const valid =
  safeId.test(releaseVersion) &&
  releaseVersion.toLowerCase() !== "unknown" &&
  exactCommit.test(commitSha) &&
  safeId.test(buildId) &&
  buildId.toLowerCase() !== "unknown";

const payload = valid
  ? {
      component: "web",
      release_version: releaseVersion,
      build_id: buildId,
      commit_sha: commitSha,
    }
  : { status: "unavailable" };

await mkdir("dist", { recursive: true });
await writeFile("dist/build-meta.json", `${JSON.stringify(payload)}\n`, "utf8");
