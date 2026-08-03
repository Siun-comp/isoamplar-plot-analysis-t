import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

const [version, sourceRevision] = process.argv.slice(2);
if (!/^v\d+\.\d+\.\d+$/u.test(version ?? "")) {
  throw new Error("Usage: node scripts/archive-version.mjs vX.Y.Z <source-commit-or-tag>");
}
if (!sourceRevision) throw new Error("A source commit or tag is required.");

const root = resolve(import.meta.dirname, "..");
const source = join(root, "dist");
const target = join(root, "public", "versions", version);
const basePath = `/isoamplar-plot-analysis-t/versions/${version}/`;
const sourceCommit = execFileSync("git", ["rev-parse", `${sourceRevision}^{commit}`], {
  cwd: root,
  encoding: "utf8"
}).trim();
const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
if (currentCommit !== sourceCommit) {
  throw new Error(`HEAD ${currentCommit} does not match archive source ${sourceCommit}.`);
}
const worktreeStatus = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
  cwd: root,
  encoding: "utf8"
}).trim();
if (worktreeStatus) throw new Error("Archive creation requires a clean worktree.");
const packageVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
if (packageVersion !== version.slice(1)) {
  throw new Error(`package.json version ${packageVersion} does not match ${version}.`);
}

if (existsSync(target)) throw new Error(`${relative(root, target)} already exists and immutable archives are not overwritten.`);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
execFileSync(npmCommand, ["run", "build"], {
  cwd: root,
  env: { ...process.env, VITE_BASE_PATH: basePath },
  stdio: "inherit",
  shell: process.platform === "win32"
});
if (!existsSync(source)) throw new Error("Version-specific production build did not create dist.");
if (!readFileSync(join(source, "index.html"), "utf8").includes(basePath)) {
  throw new Error(`dist was not built for ${basePath}.`);
}
mkdirSync(target, { recursive: true });
for (const entry of readdirSync(source)) {
  if (entry === "versions") continue;
  cpSync(join(source, entry), join(target, entry), { recursive: true, errorOnExist: true });
}

const files = listFiles(target)
  .filter((file) => basename(file) !== "release-manifest.json")
  .sort((left, right) => left.localeCompare(right))
  .map((file) => ({
    path: relative(target, file).split(sep).join("/"),
    bytes: statSync(file).size,
    sha256: createHash("sha256").update(readFileSync(file)).digest("hex")
  }));
writeFileSync(
  join(target, "release-manifest.json"),
  `${JSON.stringify({
    version: version.slice(1),
    sourceCommit,
    basePath,
    files
  }, null, 2)}\n`,
  "utf8"
);

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}
