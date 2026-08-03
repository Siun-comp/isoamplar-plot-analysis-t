import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { RELEASE_HISTORY } from "../../src/releaseHistory";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryRoots: string[] = [];

afterEach(() => {
  temporaryRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe("GPT-5.6 audit remediation evidence", () => {
  it("keeps the immutable v1.0.0 Pages archive byte-identical to its SHA-256 manifest", () => {
    const archiveRoot = join(projectRoot, "public", "versions", "v1.0.0");
    const manifest = JSON.parse(readFileSync(join(archiveRoot, "release-manifest.json"), "utf8")) as {
      version: string;
      sourceCommit: string;
      basePath: string;
      files: Array<{ path: string; bytes: number; sha256: string }>;
    };

    expect(manifest.version).toBe("1.0.0");
    expect(manifest.sourceCommit).toBe("fdd3b31ea67b3db769b2c4287e23e1ac79fe9274");
    expect(manifest.basePath).toBe("/isoamplar-plot-analysis-t/versions/v1.0.0/");
    expect(
      execFileSync("git", ["rev-parse", "v1.0.0^{commit}"], { cwd: projectRoot, encoding: "utf8" }).trim()
    ).toBe(manifest.sourceCommit);
    const release = RELEASE_HISTORY.find((entry) => entry.version === manifest.version);
    expect(release?.manifestSha256).toBe(
      createHash("sha256").update(readFileSync(join(archiveRoot, "release-manifest.json"))).digest("hex")
    );
    expect(manifest.files.length).toBeGreaterThan(10);
    const actualFiles = listFiles(archiveRoot)
      .map((path) => path.replaceAll("\\", "/"))
      .filter((path) => path !== "release-manifest.json")
      .sort();
    expect(manifest.files.map((file) => file.path).sort()).toEqual(actualFiles);
    for (const file of manifest.files) {
      const bytes = readFileSync(join(archiveRoot, ...file.path.split("/")));
      expect(bytes.byteLength, file.path).toBe(file.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), file.path).toBe(file.sha256);
    }
    expect(readFileSync(join(archiveRoot, "index.html"), "utf8")).toContain(manifest.basePath);
    const archiveScript = readFileSync(join(projectRoot, "scripts", "archive-version.mjs"), "utf8");
    expect(archiveScript).not.toContain("manifest-only");
    expect(archiveScript).toContain('"status", "--porcelain", "--untracked-files=all"');
    expect(archiveScript).toContain('["run", "build"]');
    expect(archiveScript).toContain("VITE_BASE_PATH: basePath");
  });

  it("rejects a dist tree that changes after the integrity baseline", () => {
    const root = mkdtempSync(join(tmpdir(), "isoamplar-dist-integrity-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, "dist", "assets"), { recursive: true });
    writeFileSync(join(root, "dist", "index.html"), "<main>synthetic</main>");
    writeFileSync(join(root, "dist", "assets", "app.js"), "console.log('synthetic');");

    const script = join(projectRoot, "scripts", "dist-integrity.mjs");
    runIntegrity(root, script, "snapshot", "evidence/before.sha256", "evidence/before-tree.sha256");
    runIntegrity(root, script, "snapshot", "evidence/after.sha256", "evidence/after-tree.sha256");
    runIntegrity(root, script, "compare", "evidence/before.sha256", "evidence/after.sha256", "evidence/result.txt");
    expect(readFileSync(join(root, "evidence", "result.txt"), "utf8")).toContain("byte-identical");

    writeFileSync(join(root, "dist", "assets", "app.js"), "console.log('changed');");
    runIntegrity(root, script, "snapshot", "evidence/changed.sha256", "evidence/changed-tree.sha256");
    expect(() =>
      runIntegrity(root, script, "compare", "evidence/before.sha256", "evidence/changed.sha256", "evidence/failure.txt")
    ).toThrow();
    expect(readFileSync(join(root, "evidence", "failure.txt"), "utf8")).toContain("FAIL");
  });

  it("keeps CI and Pages promotion on fresh base-path-tested dist with least deployment permissions", () => {
    const playwright = readFileSync(join(projectRoot, "playwright.config.ts"), "utf8");
    const appE2e = readFileSync(join(projectRoot, "tests", "e2e", "app.spec.ts"), "utf8");
    const branchCi = readFileSync(join(projectRoot, ".github", "workflows", "s1-ci.yml"), "utf8");
    const pages = readFileSync(join(projectRoot, ".github", "workflows", "pages.yml"), "utf8");

    expect(playwright).toContain('"http://127.0.0.1:4174"');
    expect(playwright).toContain("--strictPort");
    expect(playwright).toContain("reuseExistingServer: false");
    expect(playwright).toContain('serviceWorkers: "block"');
    expect(playwright).toContain('trace: "retain-on-failure"');
    expect(appE2e).not.toContain('page.goto("/")');
    expect(appE2e).toContain('page.goto("./")');
    expect(appE2e).toContain("routeWebSocket");

    for (const workflow of [branchCi, pages]) {
      expect(workflow).toContain('E2E_BASE_URL: "http://127.0.0.1:4174/isoamplar-plot-analysis-t/"');
      expect(workflow).toContain('VITE_BASE_PATH: "/isoamplar-plot-analysis-t/"');
      expect(workflow).toContain("npm audit --omit=dev --audit-level=high");
      expect(workflow).toContain("npm run check:dist:before");
      expect(workflow).toContain("npm run check:dist:unchanged");
      expect(workflow).toContain("--fail-on-flaky-tests");
      expect(workflow).toContain("fetch-depth: 0");
      expect(workflow).toContain("git diff --check");
    }

    expect(pages.indexOf("npm run check:dist:unchanged")).toBeLessThan(pages.indexOf("actions/upload-pages-artifact@v3"));
    expect(pages).toContain("permissions:\n  contents: read");
    expect(pages).toContain("permissions:\n      pages: write\n      id-token: write");
  });
});

function runIntegrity(root: string, script: string, ...args: string[]) {
  execFileSync(process.execPath, [script, ...args], { cwd: root, stdio: "pipe" });
}

function listFiles(root: string, relativeDirectory = ""): string[] {
  const directory = join(root, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDirectory, entry.name);
    return entry.isDirectory() ? listFiles(root, relativePath) : statSync(join(root, relativePath)).isFile() ? [relativePath] : [];
  });
}
