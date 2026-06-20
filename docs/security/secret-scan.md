# Secret-scan guard

`scripts/secret-scan.mjs` is a dependency-free (Node 18+, git only) credential scanner. It exists so
a careless `git add -A` can't introduce a new plaintext secret before Phase-2/3 cleanup is complete.

## What it scans
- **Add surface** — `git ls-files --others --exclude-standard` (untracked **and not** gitignored).
  A hit here is a **failure** (exit 1): these files would be committed by `git add -A`.
- **Tracked files** — `git ls-files`. A hit here is a **warning** (exit 0): already committed; fix via
  redaction + rotation, see [`credential-rotation-plan.md`](./credential-rotation-plan.md).
- **Never scanned:** anything gitignored — `.env.local`, `.dev.vars`, `appsettings.Local.json`,
  `secrets-quarantine/`, the gitignored `punnelifosys-*` skill trees. Those hold intentional
  local-only dev secrets (git already excludes them).

It prints `file:line [label]` only — **never the secret value**. Patterns are value-shaped (Meta
`EAA…`, JWT, `sb_secret_`, `sbp_`, `sk-`, `ghp_`, `xox…`, `AKIA…`, `Password=…`, and the known dev
creds) and skip base64 image data to avoid false positives.

## Usage
```bash
node scripts/secret-scan.mjs            # warn on tracked, FAIL on the add surface
node scripts/secret-scan.mjs --staged   # scan only staged files (pre-commit use)
```

## Optional pre-commit hook (opt-in; not installed by default)
To block commits that stage a secret, add `.git/hooks/pre-commit` (not tracked):
```sh
#!/bin/sh
node scripts/secret-scan.mjs --staged || { echo "secret-scan blocked the commit"; exit 1; }
```
Left opt-in deliberately so the guard never silently disrupts the repo for other contributors.

## Current known baseline
Tracked warnings are expected until redaction + rotation finish (customer dossiers — being
redacted; plus `learnings.md`, `rzrz-deep-dive.md`, `apps/web/README.md` still pending —
see the rotation plan's "still-pending redactions"). `memory.md` was redacted in Phase 3b
(now 0 tracked hits). The **add surface must stay at zero**.

> Note: the scanner's `known-dev-cred` rule lists only a few literal tokens, so it under-counts.
> Phase 3b also redacted owner/ops passwords it does not pattern-match (e.g. the `*Ops2026!` /
> `*MenuLink2026!` shapes) by sweeping the credential shape in `memory.md`.
