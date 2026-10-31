import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARCHIVES = ['v1.0.0', 'v1.1.0', 'v1.2.0', 'v1.3.0', 'v2.1.0'];
export const V21_ARCHIVE_MANIFEST_SHA256 = '226e0ad038368528b90a411a2ed7adfbfc844043bdadf2dd191b574106931c65';
export const V21_ARCHIVE_PUBLIC_COMMIT = '41691b5c576cbb15b1c2bcc4a0c728d4956167e1';
export const V21_ARCHIVE_ORIGINAL_TREE = '45d6a60b047fdcf6848d0ceccfb2f9f5b2464feb24bdfd7f3edc275dd652a623';
export const PUBLIC_FILES = [
  '.gitattributes', '.github/workflows/pages.yml', 'README.md',
  'release-manifest.json', 'release-policy.json', 'verify-artifacts.mjs',
];
const ICONS = new Set([
  'apple-touch-icon.png', 'favicon-16.png', 'favicon-32.png', 'favicon.svg',
  'icon-192.png', 'icon-512.png', 'manifest.webmanifest',
]);
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const MAX_FILE = 64 * 1024 * 1024;
const MAX_TREE = 1024 * 1024 * 1024;
export const ordinal = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export class ArtifactError extends Error {
  constructor(rule) { super(`Artifact check failed (${rule}).`); this.rule = rule; }
}
export function requireRule(condition, rule) {
  if (!condition) throw new ArtifactError(rule);
}
function exactKeys(value, keys, rule) {
  requireRule(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort(ordinal).join('\n') === [...keys].sort(ordinal).join('\n'), rule);
}
export function safeRelative(path) {
  requireRule(typeof path === 'string' && path.length <= 240 && path.length > 0, 'PATH');
  // ASCII avoids locale, Unicode-normalization, NTFS alias and cross-platform ambiguity.
  requireRule(/^[A-Za-z0-9_./-]+$/.test(path) && !isAbsolute(path), 'PATH');
  requireRule(path.split('/').every(part => part && part !== '.' && part !== '..'
    && !part.endsWith('.') && !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)), 'PATH');
  requireRule(!path.split('/').some(part => /^\.git(?:$|\.)/i.test(part)), 'GIT_PATH');
  return path;
}
export function inside(root, path) {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
export async function safeAbsolute(path, directory = true) {
  const full = resolve(path);
  let current = full;
  while (true) {
    const info = await lstat(current);
    requireRule(!info.isSymbolicLink(), 'LINK');
    if (current === full) {
      requireRule(directory ? info.isDirectory() : info.isFile(), 'FILE_TYPE');
      if (!directory) requireRule(info.nlink === 1, 'HARDLINK');
    } else requireRule(info.isDirectory(), 'FILE_TYPE');
    const actual = resolve(await realpath(current));
    requireRule(process.platform === 'win32' ? actual.toLowerCase() === current.toLowerCase() : actual === current, 'REALPATH');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return full;
}
async function rejectReparse(paths) {
  if (process.platform !== 'win32') return;
  // lstat covers symlinks/junctions; the native attribute check also rejects other reparse tags.
  const script = '$ErrorActionPreference="Stop"; try { $p=ConvertFrom-Json ([Console]::In.ReadToEnd()); foreach($s in $p) { if (([IO.File]::GetAttributes($s) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { exit 2 } }; [Console]::Out.Write("OK") } catch { exit 3 }';
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    input: JSON.stringify(paths), encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024,
  });
  requireRule(result.status === 0 && result.stdout === 'OK', 'REPARSE');
}
export async function safeRead(path) {
  await safeAbsolute(path, false);
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    requireRule(before.isFile() && before.nlink === 1 && before.size <= MAX_FILE, 'FILE_TYPE');
    const data = await handle.readFile();
    const after = await handle.stat();
    const current = await lstat(path);
    requireRule(!current.isSymbolicLink() && current.nlink === 1
      && before.ino === current.ino && before.dev === current.dev
      && before.size === after.size && before.mtimeMs === after.mtimeMs
      && data.length === before.size, 'FILE_CHANGED');
    return data;
  } finally { await handle.close(); }
}
export async function readTree(root, { checkout = false } = {}) {
  root = await safeAbsolute(root);
  const paths = [];
  const absolutePaths = [root];
  const folded = new Set();
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (checkout && !prefix && entry.name === '.git') {
        const git = await lstat(join(directory, entry.name));
        requireRule(git.isDirectory() && !git.isSymbolicLink(), 'CHECKOUT_GIT');
        absolutePaths.push(join(directory, entry.name));
        continue;
      }
      const path = safeRelative(prefix + entry.name);
      requireRule(!folded.has(path.toLowerCase()), 'CASE_COLLISION');
      folded.add(path.toLowerCase());
      const full = join(root, ...path.split('/'));
      requireRule(inside(root, full), 'PATH_ESCAPE');
      const info = await lstat(full);
      requireRule(!info.isSymbolicLink(), 'LINK');
      absolutePaths.push(full);
      if (info.isDirectory()) {
        const count = paths.length;
        await walk(full, `${path}/`);
        requireRule(paths.length > count, 'EMPTY_DIRECTORY');
      } else {
        requireRule(info.isFile() && info.nlink === 1, 'HARDLINK');
        paths.push(path);
      }
    }
  }
  await walk(root);
  // Check ancestors too, including a potentially redirected volume mount.
  let parent = dirname(root);
  while (true) {
    absolutePaths.push(parent);
    const next = dirname(parent);
    if (next === parent) break;
    parent = next;
  }
  await rejectReparse(absolutePaths);
  paths.sort(ordinal);
  const files = new Map();
  let total = 0;
  for (const path of paths) {
    const data = await safeRead(join(root, ...path.split('/')));
    total += data.length;
    requireRule(total <= MAX_TREE, 'TREE_SIZE');
    files.set(path, data);
  }
  return files;
}
export function parseJson(bytes) {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new ArtifactError('JSON'); }
}
function uniquePaths(paths) {
  requireRule(Array.isArray(paths), 'POLICY');
  const seen = new Set();
  for (const path of paths) {
    safeRelative(path);
    requireRule(!seen.has(path.toLowerCase()), 'CASE_COLLISION');
    seen.add(path.toLowerCase());
  }
}
export function validatePolicy(policy) {
  exactKeys(policy, ['schema', 'files', 'publicFiles', 'notices', 'archiveManifestHashes'], 'POLICY');
  requireRule(policy.schema === 1, 'POLICY');
  uniquePaths(policy.files);
  uniquePaths(policy.publicFiles);
  equalPathSet(policy.publicFiles, PUBLIC_FILES, 'PUBLIC_POLICY');
  uniquePaths(policy.notices);
  exactKeys(policy.archiveManifestHashes, ARCHIVES, 'ARCHIVE_POLICY');
  requireRule(Object.values(policy.archiveManifestHashes).every(hash => SHA.test(hash)), 'ARCHIVE_POLICY');
  requireRule(policy.archiveManifestHashes['v2.1.0'] === V21_ARCHIVE_MANIFEST_SHA256, 'V21_ARCHIVE_PIN');
  for (const path of policy.notices) {
    requireRule(/^(?:versions\/v[0-9]+\.[0-9]+\.[0-9]+\/)?(?:THIRD_PARTY_NOTICES\.txt|LICENSE\.txt|assets\/[A-Za-z0-9_-]+\.js\.LICENSE\.txt)$/.test(path), 'NOTICE_PATH');
    requireRule(policy.files.includes(path), 'NOTICE_PATH');
  }
  for (const path of policy.files) requireRule(allowedPayloadPath(path, policy), 'ALLOWLIST');
  requireRule(policy.files.includes('index.html'), 'ENTRYPOINT');
  for (const version of ARCHIVES) {
    requireRule(policy.files.includes(`versions/${version}/index.html`)
      && policy.files.includes(`versions/${version}/release-manifest.json`), 'ARCHIVE_MISSING');
  }
  return policy;
}
export function allowedPayloadPath(path, policy) {
  if (/(?:^|\/)(?:fixtures?|logs?|tests?|sourcearchives?)(?:[-_.\/]|$)/i.test(path)) return false;
  if (policy.notices.includes(path)) return true;
  const match = /^versions\/(v[0-9]+\.[0-9]+\.[0-9]+)\/(.+)$/.exec(path);
  let local = path;
  if (match) {
    if (!ARCHIVES.includes(match[1])) return false;
    local = match[2];
    if (local === 'release-manifest.json') return true;
  }
  return local === 'index.html' || ICONS.has(local)
    || /^assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{6,}\.(?:js|css)$/.test(local);
}
export function scanContent(bytes) {
  // Inspect every byte, not just selected text extensions. No matched content is logged.
  const text = bytes.toString('latin1');
  // Public SheetJS defaults, not embedded map data or a developer machine path.
  // Match the complete quoted constants only; extensions/payloads remain scanned.
  const content = text.replaceAll('"data:application/octet-stream;base64,"', '""')
    .replaceAll('"file:///C:/SheetJS/"', '""');
  requireRule(!text.toLowerCase().includes(['source', 'mappingurl'].join(''))
    && !/sourceURL\s*=|data\s*:\s*application\/(?:json|octet-stream)|"sourcesContent"\s*:|"mappings"\s*:/i.test(content), 'SOURCE_MAP');
  requireRule(!/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9_.-]{20,})/.test(text), 'TOKEN');
  requireRule(!/(?:^|[^A-Za-z0-9_$])[A-Za-z]:[\\/](?!\/)/i.test(content)
    && !/(?:\/(?:Users|home|workspace|workspaces|mnt|tmp)\/[^/\s"'<>]+(?:\/|\b)|file:\/\/\/|\\\\[^\\\s]+\\(?:Users|private)\\)/i.test(content), 'PRIVATE_PATH');
}
function equalPathSet(actual, expected, rule) {
  requireRule([...actual].sort(ordinal).join('\n') === [...expected].sort(ordinal).join('\n'), rule);
}
export function validatePayload(files, rawPolicy) {
  const policy = validatePolicy(rawPolicy);
  equalPathSet(files.keys(), policy.files, 'FILE_SET');
  for (const [path, bytes] of files) {
    requireRule(allowedPayloadPath(safeRelative(path), policy), 'ALLOWLIST');
    scanContent(bytes);
  }
  for (const version of ARCHIVES) {
    const prefix = `versions/${version}/`;
    const manifestPath = `${prefix}release-manifest.json`;
    requireRule(sha256(files.get(manifestPath)) === policy.archiveManifestHashes[version], 'ARCHIVE_PIN');
    const archive = parseJson(files.get(manifestPath));
    if (version === 'v2.1.0') { validateV21Archive(files); continue; }
    exactKeys(archive, ['version', 'sourceCommit', 'basePath', 'files'], 'ARCHIVE_MANIFEST');
    requireRule(archive.version === version.slice(1) && COMMIT.test(archive.sourceCommit)
      && archive.basePath === `/isoamplar-plot-analysis-t/versions/${version}/`, 'ARCHIVE_MANIFEST');
    requireRule(Array.isArray(archive.files) && archive.files.length > 0, 'ARCHIVE_MANIFEST');
    uniquePaths(archive.files.map(file => file.path));
    const expected = [manifestPath];
    for (const entry of archive.files) {
      exactKeys(entry, ['path', 'bytes', 'sha256'], 'ARCHIVE_MANIFEST');
      const path = prefix + safeRelative(entry.path);
      const bytes = files.get(path);
      requireRule(bytes && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0
        && SHA.test(entry.sha256) && bytes.length === entry.bytes
        && sha256(bytes) === entry.sha256, 'ARCHIVE_BYTES');
      expected.push(path);
    }
    equalPathSet([...files.keys()].filter(path => path.startsWith(prefix)), expected, 'ARCHIVE_FILE_SET');
  }
  return policy;
}
export function validateV21Archive(files) {
  const prefix = 'versions/v2.1.0/';
  const manifestPath = `${prefix}release-manifest.json`;
  const bytes = files.get(manifestPath);
  requireRule(bytes && sha256(bytes) === V21_ARCHIVE_MANIFEST_SHA256, 'V21_ARCHIVE_PIN');
  const archive = parseJson(bytes);
  exactKeys(archive, ['version', 'publicCommit', 'originalTreeHash', 'basePath', 'files'], 'V21_ARCHIVE_MANIFEST');
  requireRule(archive.version === '2.1.0' && archive.publicCommit === V21_ARCHIVE_PUBLIC_COMMIT
    && archive.originalTreeHash === V21_ARCHIVE_ORIGINAL_TREE
    && archive.basePath === '/isoamplar-plot-analysis-t/versions/v2.1.0/', 'V21_ARCHIVE_MANIFEST');
  requireRule(Array.isArray(archive.files) && archive.files.length > 0, 'V21_ARCHIVE_MANIFEST');
  uniquePaths(archive.files.map((entry) => entry.path));
  const expected = [manifestPath];
  for (const entry of archive.files) {
    exactKeys(entry, ['path', 'bytes', 'sha256'], 'V21_ARCHIVE_MANIFEST');
    const path = prefix + safeRelative(entry.path), value = files.get(path);
    requireRule(value && Number.isSafeInteger(entry.bytes) && value.length === entry.bytes
      && SHA.test(entry.sha256) && sha256(value) === entry.sha256, 'V21_ARCHIVE_BYTES');
    scanContent(value); expected.push(path);
  }
  equalPathSet([...files.keys()].filter((path) => path.startsWith(prefix)), expected, 'V21_ARCHIVE_FILE_SET');
}
export function manifestFor(files) {
  const entries = [...files].sort(([a], [b]) => ordinal(a, b))
    .map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
  const lines = entries.map(file => `${file.sha256}  ${file.path}\n`).join('');
  return { schema: 1, treeHash: sha256(Buffer.from(lines, 'utf8')), files: entries };
}
export const manifestBytes = manifest => Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
export function verifyManifest(files, bytes) {
  const expected = manifestBytes(manifestFor(files));
  requireRule(Buffer.isBuffer(bytes) && bytes.equals(expected), 'MANIFEST_BYTES');
  return parseJson(expected);
}
export async function verifySite(site, policy, manifest) {
  const files = await readTree(site);
  validatePayload(files, policy);
  verifyManifest(files, manifest);
  return { files, manifest: manifestFor(files) };
}
export function validatePublicTree(tree) {
  const metadata = [...tree.keys()].filter(path => !path.startsWith('site/'));
  equalPathSet(metadata, PUBLIC_FILES, 'PUBLIC_FILE_SET');
  for (const path of metadata) scanContent(tree.get(path));
  const policy = validatePolicy(parseJson(tree.get('release-policy.json')));
  const payload = new Map([...tree].filter(([path]) => path.startsWith('site/'))
    .map(([path, bytes]) => [path.slice(5), bytes]));
  validatePayload(payload, policy);
  return verifyManifest(payload, tree.get('release-manifest.json'));
}
export async function verifyPublicRoot(root) {
  const tree = await readTree(root, { checkout: true });
  return { tree, manifest: validatePublicTree(tree) };
}
function gitRun(root, args) {
  const result = spawnSync('git', ['--no-optional-locks', '-C', root, ...args], {
    encoding: null, maxBuffer: MAX_FILE, windowsHide: true,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' },
  });
  requireRule(result.status === 0 && !result.error, 'GIT_READ');
  return result.stdout;
}
export function parseGitTree(bytes) {
  const result = [];
  const seen = new Set();
  for (const record of bytes.toString('utf8').split('\0').filter(Boolean)) {
    const match = /^(100644) blob ([a-f0-9]{40}|[a-f0-9]{64})\t(.+)$/.exec(record);
    requireRule(match, 'GIT_MODE');
    const path = safeRelative(match[3]);
    requireRule(!seen.has(path.toLowerCase()), 'CASE_COLLISION');
    seen.add(path.toLowerCase());
    result.push({ path, oid: match[2] });
  }
  return result;
}
export async function verifyGitObjects(root, commit, expectedTree, readGit = gitRun) {
  requireRule(COMMIT.test(commit), 'PUBLIC_COMMIT');
  root = await safeAbsolute(root);
  const tree = new Map();
  let total = 0;
  for (const entry of parseGitTree(readGit(root, ['ls-tree', '-r', '-z', '--full-tree', commit]))) {
    requireRule(entry.path.startsWith('site/') || PUBLIC_FILES.includes(entry.path), 'PUBLIC_FILE_SET');
    const bytes = readGit(root, ['cat-file', 'blob', entry.oid]);
    total += bytes.length;
    requireRule(bytes.length <= MAX_FILE && total <= MAX_TREE, 'TREE_SIZE');
    tree.set(entry.path, bytes);
  }
  const manifest = validatePublicTree(tree);
  if (expectedTree) {
    equalPathSet(tree.keys(), expectedTree.keys(), 'GIT_FILE_SET');
    for (const [path, bytes] of tree) requireRule(bytes.equals(expectedTree.get(path)), 'GIT_BYTES');
  }
  return { tree, manifest };
}
export function approvalRecordBytes({ status = 'approved', publicCommit = null, treeHash = null }) {
  requireRule((status === 'approved' && COMMIT.test(publicCommit ?? '') && SHA.test(treeHash ?? ''))
    || (status === 'revoked' && publicCommit === null && treeHash === null), 'APPROVAL_RECORD');
  return manifestBytes({ schema: 1, status, publicCommit, treeHash });
}
export const gitBlobHash = bytes => createHash('sha1')
  .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8')).update(bytes).digest('hex');
export async function checkCurrentApproval({ repo, sha, treeHash, token, api = 'https://api.github.com', fetcher = fetch }) {
  requireRule(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '') && COMMIT.test(sha ?? '')
    && SHA.test(treeHash ?? '') && api === 'https://api.github.com'
    && (token === undefined || typeof token === 'string' && /^[A-Za-z0-9_.-]+$/.test(token) && token.length < 1024), 'APPROVAL_INPUT');
  async function get(path) {
    try {
      const response = await fetcher(`${api}/repos/${repo}/${path}?release_gate=${Date.now()}`, {
        headers: { Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28', 'Cache-Control': 'no-cache',
          ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
      });
      requireRule(response.status === 200, 'APPROVAL_API');
      const value = await response.json();
      requireRule(JSON.stringify(value).length <= 32768, 'APPROVAL_API');
      return value;
    } catch { throw new ArtifactError('APPROVAL_API'); }
  }
  async function ref(branch) {
    const value = await get(`git/ref/heads/${branch}`);
    requireRule(value?.ref === `refs/heads/${branch}` && value.object?.type === 'commit'
      && COMMIT.test(value.object.sha ?? ''), 'APPROVAL_REF');
    return value.object.sha;
  }
  // Repository Variables read is not a GITHUB_TOKEN permission. The vars job guard
  // remains coarse; this independent, public ref/blob is the live approval authority.
  requireRule(await ref('main') === sha, 'APPROVAL_MISMATCH');
  const control = await ref('release-control');
  const commit = await get(`git/commits/${control}`);
  requireRule(commit?.sha === control && COMMIT.test(commit.tree?.sha ?? ''), 'APPROVAL_COMMIT');
  const tree = await get(`git/trees/${commit.tree.sha}`);
  requireRule(tree?.sha === commit.tree.sha && tree.truncated === false
    && Array.isArray(tree.tree) && tree.tree.length === 1, 'APPROVAL_TREE');
  const entry = tree.tree[0];
  requireRule(entry?.path === 'approval.json' && entry.mode === '100644' && entry.type === 'blob'
    && COMMIT.test(entry.sha ?? '') && Number.isSafeInteger(entry.size)
    && entry.size > 0 && entry.size <= 1024, 'APPROVAL_TREE');
  const blob = await get(`git/blobs/${entry.sha}`);
  requireRule(blob?.sha === entry.sha && blob.encoding === 'base64' && typeof blob.content === 'string'
    && blob.size === entry.size && /^[A-Za-z0-9+/=\n]+$/.test(blob.content), 'APPROVAL_BLOB');
  const encoded = blob.content.replaceAll('\n', '');
  const bytes = Buffer.from(encoded, 'base64');
  requireRule(bytes.length === entry.size && bytes.toString('base64') === encoded
    && gitBlobHash(bytes) === entry.sha, 'APPROVAL_BLOB');
  const approval = parseJson(bytes);
  exactKeys(approval, ['schema', 'status', 'publicCommit', 'treeHash'], 'APPROVAL_RECORD');
  requireRule(approval.schema === 1 && bytes.equals(approvalRecordBytes(approval)), 'APPROVAL_RECORD');
  requireRule(approval.status === 'approved', 'APPROVAL_REVOKED');
  requireRule(approval.publicCommit === sha && approval.treeHash === treeHash, 'APPROVAL_MISMATCH');
  // Catch a revoke/update or main change while following immutable object IDs.
  requireRule(await ref('main') === sha && await ref('release-control') === control, 'APPROVAL_CHANGED');
  return { controlCommit: control, treeHash };
}
async function cli() {
  const args = process.argv.slice(2);
  if (args.length === 3 && args[0] === '--approval' && args[1] === '--root') {
    requireRule(process.env.GITHUB_REF === 'refs/heads/main', 'MAIN_ONLY');
    const { manifest } = await verifyPublicRoot(args[2]);
    await checkCurrentApproval({ repo: process.env.GITHUB_REPOSITORY, sha: process.env.GITHUB_SHA,
      treeHash: manifest.treeHash, token: process.env.GITHUB_TOKEN || undefined });
    process.stdout.write('PASS current main and public P+D approval.\n');
    return;
  }
  requireRule((args.length === 2 || args.length === 4) && args[0] === '--root'
    && (args.length === 2 || args[2] === '--git-ref'), 'CLI');
  const { tree, manifest } = await verifyPublicRoot(args[1]);
  if (args.length === 4) await verifyGitObjects(args[1], args[3], tree);
  process.stdout.write(`PASS files=${manifest.files.length} D=${manifest.treeHash}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().catch(error => {
    process.stderr.write(`FAIL ${error instanceof ArtifactError ? error.rule : 'IO'}\n`);
    process.exitCode = 1;
  });
}
