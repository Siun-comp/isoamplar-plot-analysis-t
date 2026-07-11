import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

const [command, ...args] = process.argv.slice(2);

if (command === "snapshot") {
  const [manifestPath, treePath] = args;
  if (!manifestPath || !treePath) throw new Error("Usage: snapshot <manifest-path> <tree-hash-path>");
  await snapshotDist(manifestPath, treePath);
} else if (command === "compare") {
  const [beforePath, afterPath, evidencePath] = args;
  if (!beforePath || !afterPath || !evidencePath) {
    throw new Error("Usage: compare <before-manifest> <after-manifest> <evidence-path>");
  }
  await compareManifests(beforePath, afterPath, evidencePath);
} else {
  throw new Error("Expected the snapshot or compare command.");
}

async function snapshotDist(manifestPath, treePath) {
  const distRoot = resolve("dist");
  const files = await listFiles(distRoot);
  if (files.length === 0) throw new Error("dist is empty; build before recording integrity evidence.");

  const lines = [];
  for (const filePath of files) {
    const relativePath = relative(distRoot, filePath).split(sep).join("/");
    const hash = createHash("sha256").update(await readFile(filePath)).digest("hex");
    lines.push(`${hash}  ${relativePath}`);
  }

  const manifest = `${lines.join("\n")}\n`;
  const treeHash = createHash("sha256").update(manifest).digest("hex");
  await writeText(manifestPath, manifest);
  await writeText(treePath, `${treeHash}  ${manifestPath.split(sep).join("/")}\n`);
  process.stdout.write(`${treeHash}\n`);
}

async function compareManifests(beforePath, afterPath, evidencePath) {
  const before = await readFile(beforePath, "utf8");
  const after = await readFile(afterPath, "utf8");
  if (before !== after) {
    await writeText(evidencePath, "FAIL: dist tree changed while browser tests were running.\n");
    throw new Error("The tested dist differs from the built dist.");
  }

  const message = "PASS: complete dist tree is byte-identical after Playwright.\n";
  await writeText(evidencePath, message);
  process.stdout.write(message);
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = resolve(root, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    })
  );
  return nested.flat().sort((left, right) => left.localeCompare(right, "en"));
}

async function writeText(filePath, contents) {
  await mkdir(dirname(resolve(filePath)), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}
