# IsoAmplar Plot Analysis T

This repository contains prebuilt static site files and executable historical versions.
User-provided analysis data is processed in the browser.

`site/` is the complete deployment payload. `release-manifest.json` records every
payload file's byte length and SHA-256. It is outside the payload to avoid self-hashing.
D is SHA-256 of the UTF-8 concatenation of `sha256`, two spaces, relative POSIX path,
and LF for each file, sorted by ordinal ASCII path order. No newline conversion is
permitted. The immutable historical release manifests are themselves payload files.

Verify locally with Node 22 or later, without installing packages:

```sh
node verify-artifacts.mjs --root .
node verify-artifacts.mjs --root . --git-ref <exact-public-commit-P>
```

Only `site/` is uploaded to Pages. The workflow does not install dependencies,
build source, or upload test reports. A release requires main and the repository's
`ISOAMPLAR_APPROVED_RELEASE_SHA` to equal the exact public commit P, not a source SHA.

Deployment is sequential. The `vars` condition is only a coarse job-start gate,
not a fresh revocation check. The repository Variables API needs Variables read,
which is not an available workflow-token permission. No PAT or configured secret is added.
[API permissions](https://docs.github.com/en/rest/actions/variables#get-a-repository-variable),
[workflow permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions).

The authoritative live approval is the public `release-control` branch. Its tree
contains exactly one ordinary non-executable file, `approval.json`, and no workflow.
An approval is canonical LF JSON with `schema: 1`, `status: "approved"`,
`publicCommit: "<P>"`, and `treeHash: "<D>"`. Revocation has `status: "revoked"`
and both identity fields null. This record is never part of `main` or `site/`.

Immediately before deploy the verifier reads public main and release-control,
follows pinned commit/tree/blob IDs, verifies the blob bytes and exact P+D record,
then rereads both refs. Local checks can use public unauthenticated reads. CI uses
only its ephemeral built-in read-only workflow token for these Git-object reads,
avoiding the lower anonymous API quota. There is no stale-context fallback.
Missing/revoked/moved/malformed control, mismatched P/D, or API errors including
rate limits block deployment. Public Git objects support unauthenticated reads.
[Git reference API](https://docs.github.com/en/rest/git/refs#get-a-reference),
[Git blob API](https://docs.github.com/en/rest/git/blobs#get-a-blob).

Only designated release maintainers may update the control branch. To approve:
freeze all deployment paths, clear the variable, cancel and confirm termination of
old/queued runs, retain rollback bytes, and publish a revoked control record first.
After review and explicit publication approval, publish verified P with D while
the variable is unset. Append an approved P+D control commit, set the variable to
P, and dispatch that exact P. Recheck both refs and keep main/control changes frozen
until the run terminates. Control updates are append-only, with the expected old
control head checked; do not force-push, reset, delete, or reuse old approval commits.

To revoke, append a revoked control commit first, clear the variable, cancel all
queued/running deployments and confirm termination. Clearing only the variable is
insufficient for runs whose context was evaluated earlier. An already submitted
deployment may still finish; inspect production before claiming revocation or
rollback success. Rollback uses preserved bytes D in a new public commit P and
repeats the full freeze/approval sequence. Updating a workflow cannot fix old runs.
The final API check is not an atomic server-side lock; these operational freezes
are mandatory. API checks do not certify maintainer identity or stop a repository
writer from changing the workflow; access governance remains a separate boundary.

Historical v1.x files and their existing manifests are preserved byte for byte;
their existing metadata does not imply that new development source is published.
Bundled third-party license notices must be retained. Compiled JavaScript is public
and inspectable; lack of source maps does not provide access control.
