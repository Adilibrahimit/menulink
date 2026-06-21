#!/usr/bin/env node
// secret-scan.mjs — dependency-free credential scanner for the MenuLink repo.
//
// Scans the two surfaces git can commit:
//   1. untracked-but-NOT-ignored files (the `git add -A` surface)  -> FAIL (exit 1)
//   2. tracked files                                               -> WARN (exit 0)
// Ignored files (.env.local, .dev.vars, appsettings.Local.json, secrets-quarantine/,
// the gitignored punnelifosys-* skill trees, etc.) are never scanned — git excludes them.
//
// Prints file:line + a pattern LABEL only. Never prints the matched secret value.
//
// Usage:  node scripts/secret-scan.mjs            (warn on tracked, fail on add-surface)
//         node scripts/secret-scan.mjs --staged   (scan only staged files; good as a pre-commit hook)
// Requires: git on PATH + Node 18+. No npm install.

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const STAGED_ONLY = process.argv.includes("--staged");

// label -> regex. Value-shaped patterns only (not bare identifiers).
const RULES = [
  ["meta-token", /EAA[A-Za-z0-9_]{30,}/],
  ["jwt", /eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}/],
  ["supabase-service-key", /sb_secret_[A-Za-z0-9]/],
  ["supabase-pat", /sbp_[A-Za-z0-9]{20,}/],
  ["openai-key", /sk-[A-Za-z0-9]{20,}/],
  ["github-token", /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/],
  ["slack-token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ["aws-key", /AKIA[0-9A-Z]{16}/],
  ["sql-password", /(?:Password|PWD)=(?!<)[^\s;"'<]{3,}/i],
  ["known-dev-cred", /sa@123|jopaul477|Koko2026!|OpsMenuLink2026!|RzRz2026Temp!/],
];

// Skip lines that are clearly not secrets (base64 image data).
const LINE_SKIP = /data:image\/|;base64,/;
// Files to never scan (they legitimately contain pattern strings).
const PATH_SKIP = /^(scripts\/secret-scan\.mjs|docs\/security\/(secret-scan|credential-rotation-plan)\.md)$/;
const BINARY_EXT = /\.(png|jpe?g|jfif|gif|webp|pdf|xlsx|docx|zip|rar|ico|woff2?|ttf|mp4|webm)$/i;

function gitList(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\n").map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function scan(files) {
  const hits = [];
  for (const f of files) {
    if (PATH_SKIP.test(f) || BINARY_EXT.test(f)) continue;
    let text;
    try {
      if (statSync(f).size > 2 * 1024 * 1024) continue; // skip >2MB
      text = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue; // binary file
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (LINE_SKIP.test(line)) continue;
      for (const [label, re] of RULES) {
        if (re.test(line)) hits.push({ file: f, line: i + 1, label });
      }
    }
  }
  return hits;
}

const addSurface = STAGED_ONLY
  ? gitList(["diff", "--cached", "--name-only", "--diff-filter=ACM"])
  : gitList(["ls-files", "--others", "--exclude-standard"]);
const tracked = STAGED_ONLY ? [] : gitList(["ls-files"]);

const addHits = scan(addSurface);
const trackedHits = STAGED_ONLY
  ? []
  : scan(tracked).filter(h => !addHits.some(a => a.file === h.file && a.line === h.line));

const fmt = h => `  ${h.file}:${h.line}  [${h.label}]`;

if (addHits.length) {
  console.error(`\n❌ ${STAGED_ONLY ? "STAGED" : "ADD-SURFACE"} secrets (would be committed) — ${addHits.length}:`);
  addHits.forEach(h => console.error(fmt(h)));
}
if (trackedHits.length) {
  console.log(`\n⚠️  TRACKED secrets (already committed; rotate + redact — see docs/security/credential-rotation-plan.md) — ${trackedHits.length}:`);
  trackedHits.forEach(h => console.log(fmt(h)));
}
if (!addHits.length && !trackedHits.length) {
  console.log("✅ no credential values found on the scanned surface.");
}

process.exit(addHits.length ? 1 : 0);
