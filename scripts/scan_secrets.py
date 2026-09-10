#!/usr/bin/env python3
"""Look for a credential in the working tree and in every commit ever made.

SEC-076. The plan asked for a secret scanner over the tree and the full
history. gitleaks and trufflehog are not installed on either of the owner's
machines and neither is in the group's tool list, so this is a scanner written
against the shapes THIS project's credentials actually take, which has one real
advantage over a general-purpose tool: it knows what the group uses, so it
looks for a Cloudflare token and a Mailgun key by name rather than reporting
every long string as an entropy hit.

    python3 scripts/scan_secrets.py            the working tree
    python3 scripts/scan_secrets.py --history  every blob in every commit
    python3 scripts/scan_secrets.py --all      both
    python3 scripts/scan_secrets.py --staged   only files staged for commit (pre-commit hook)

Exit status is 1 if anything was found, so it can gate a deploy.

WHY THE HISTORY MATTERS SEPARATELY. Removing a key from a file removes it from
the next checkout and from nothing else: it stays in the commit that added it,
readable by anybody who can clone, for as long as the repository exists. The
repository is private today, which is the only reason this is not already an
incident, and "private today" is not a control.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
from pathlib import Path

import os
ROOT = Path(os.environ.get('SCAN_ROOT', Path(__file__).resolve().parent.parent))

# Each pattern is a shape a real credential takes, not a guess at entropy.
# Named so a finding says what was found rather than "possible secret".
PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("AWS access key id", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("AWS secret access key",
     re.compile(r"aws_secret_access_key\s*[=:]\s*['\"]?[A-Za-z0-9/+=]{40}")),
    ("Stripe live secret key", re.compile(r"\bsk_live_[0-9a-zA-Z]{16,}")),
    ("Stripe test secret key", re.compile(r"\bsk_test_[0-9a-zA-Z]{16,}")),
    ("Stripe restricted key", re.compile(r"\brk_live_[0-9a-zA-Z]{16,}")),
    ("Stripe webhook signing secret", re.compile(r"\bwhsec_[0-9a-zA-Z]{16,}")),
    ("OpenAI key", re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}")),
    ("Anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{24,}")),
    ("Mailgun key", re.compile(r"\bkey-[0-9a-f]{32}\b")),
    ("Twilio auth token", re.compile(r"\bSK[0-9a-f]{32}\b")),
    ("Twilio account sid", re.compile(r"\bAC[0-9a-f]{32}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("Cloudflare API token", re.compile(r"\b[A-Za-z0-9_-]{40}\b(?=.{0,40}(?i:cloudflare))")),
    # A Turnstile SITE key and SECRET key share the 0x4AAAAAA prefix, so the
    # prefix alone cannot tell them apart and flagging it flags the site key,
    # which is public by design and shipped to every browser. The variable
    # name is what distinguishes them, so that is what this matches.
    ("Turnstile secret key",
     re.compile(r"TURNSTILE_SECRET_KEY\s*[=:]\s*['\"]?(?!\$|your-)[A-Za-z0-9_-]{20,}")),
    ("private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY")),
    ("JWT secret assignment",
     re.compile(r"JWT_SECRET\s*[=:]\s*['\"]?(?!\$\{|your-|change-me|placeholder)[^\s'\"]{16,}")),
    ("database URL with a password",
     re.compile(r"\b(?:postgres|postgresql|redis|mysql)://[^:\s/]+:(?!password\b|changeme\b)[^@\s]{6,}@")),
    ("gate credential assignment",
     re.compile(r"DEV_BASIC_AUTH_PASS\s*=\s*(?!\$|['\"]?$)['\"]?[^\s'\"]{4,}")),
    ("beta staff passwords",
     re.compile(r"BETA_STAFF_PASSWORDS\s*=\s*(?!\$|['\"]?$)['\"]?[^\s'\"]{4,}")),
]

# Paths that are allowed to look like they hold a secret, with the reason.
# Every one of these is checked to be an EXAMPLE rather than a credential.
SKIP_DIRS = {".git", "node_modules", ".next", "dist", "__pycache__",
             ".venv", "venv", "reports", "vendor", "var", "_archive", ".claude"}
SKIP_SUFFIXES = {".db", ".sqlite", ".sqlite3", ".ttf", ".woff", ".woff2",
                 ".png", ".jpg", ".jpeg", ".webp", ".ico", ".pdf", ".gz",
                 ".zip", ".dump", ".map", ".lock",
                 # Media and office binaries: a regex over compressed or encoded
                 # bytes finds nothing, and a 900 MB folder of photos turned a
                 # two-second scan into two minutes. Office files ARE zip
                 # archives, so a key inside a .docx is invisible to any line
                 # scanner; MonacoViews learned that the hard way. Treat an
                 # office document in a tracked path as something to open by
                 # hand, not something the scanner has cleared.
                 ".heic", ".tif", ".tiff", ".bmp", ".gif", ".psd", ".svgz",
                 ".mov", ".mp4", ".m4v", ".avi", ".mp3", ".wav", ".aiff",
                 ".docx", ".xlsx", ".pptx", ".otf", ".eot", ".tar", ".7z",
                 ".rar", ".dmg", ".pkg", ".jar", ".class", ".pyc", ".so",
                 ".dylib", ".wasm", ".tsbuildinfo"}

# A finding whose text is one of these is a documented example, not a
# credential. Kept narrow and explicit: an allowlist of whole strings, never a
# pattern, so a real key cannot hide behind a rule that is too loose.
KNOWN_EXAMPLES = {
    "sk_test_51H",                      # the shape, in a comment
    "AKIAIOSFODNN7EXAMPLE",             # AWS's own documentation value
    # Two development defaults in the docker-compose.yml of 4 September 2026,
    # found by the --history scan and checked against the live box on 9
    # September: production's DATABASE_URL does not contain this password and
    # its JWT_SECRET is a 44-character random value, not this placeholder.
    # Neither was ever a live credential, so neither needs rotating. They are
    # listed rather than deleted from history: rewriting 533 commits to remove
    # a local compose password would be a large, disruptive operation to no
    # security end, and doing it would also invalidate every clone.
    "postgresql://privateplates:privateplates_dev_2026@",
    "JWT_SECRET:-dev-jwt-secret-change-in-production",
    # MonacoViews local-dev default in docker-compose.yml and docs/DEPLOYMENT.md.
    # Verified 10 Sep 2026 against the live Lightsail box: production's
    # DATABASE_URL (in .env and in the running backend container) carries a
    # different password, and postgres is bound to 127.0.0.1 only. Never a live
    # credential, so not rotated; listed rather than purged from 900+ commits.
    "postgresql://monaco:monaco_dev_2024@",
    # garage-data franchise-dealers/.env.example: a commented-out sample URL whose
    # password is the literal word "garage", pointing at a local dev database.
    "postgres://garage:garage@",
    # fuel.co.uk integration-test harness: fixture values assigned into
    # process.env before the app is imported. Test-only by construction, the
    # word "test" is in each value, and the harness never runs in production.
    "JWT_SECRET: 'test-jwt-secret-that-is-comfortably-long-enough",
    "TURNSTILE_SECRET_KEY: 'test-turnstile-secret",
}


# Identifiers that are allowed but must not be spelled out, even here. GitHub's
# push protection refused a public repository holding a Twilio account SID in
# this very allowlist, and a value copied into ten repositories is ten more
# places it lives. These are md5 digests of the exact matched text, so the
# match is still exact and a different SID still fails the gate.
KNOWN_EXAMPLE_HASHES = {
    # The group's one Twilio ACCOUNT SID. An account identifier, not a
    # credential: it is sent in every API URL and cannot authenticate without
    # the auth token, which is what the scanner must catch. Inventories may
    # name the account without failing the gate.
    "497ceb1e29a608e5f679cc3eecbeb3aa",
}


def looks_like_example(line: str) -> bool:
    """Is this line teaching rather than telling?"""
    low = line.lower()
    return any(w in low for w in (
        "example", "placeholder", "your-", "changeme", "change-me",
        "<paste", "xxxx", "redacted", "not-a-real", "dummy", "sk_test_your",
        "change_me", "process.env", "getenv", "os.environ",
        "change-in-production", "_dev_2026",
        "your_", "generate_fresh", "openssl_rand", "-----\\n...",
    ))


def scan_text(where: str, text: str) -> list[str]:
    out = []
    for i, line in enumerate(text.splitlines(), 1):
        if len(line) > 4000:
            continue
        for name, rx in PATTERNS:
            m = rx.search(line)
            if not m:
                continue
            if (m.group(0) in KNOWN_EXAMPLES
                    or hashlib.md5(m.group(0).encode()).hexdigest() in KNOWN_EXAMPLE_HASHES
                    or looks_like_example(line)):
                continue
            out.append(f"{where}:{i}  {name}: {m.group(0)[:24]}...")
    return out


def tracked_files() -> set[str]:
    """What git actually holds. A secret in one of these is published to every
    clone; a secret in an untracked file is on this machine only, which is a
    different problem with a different answer."""
    try:
        return set(git("ls-files").splitlines())
    except subprocess.CalledProcessError as err:
        print(f"  could not list tracked files: {err}", file=sys.stderr)
        return set()


def tree() -> list[str]:
    found = []
    import os
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            path = Path(dirpath) / fn
            if path.suffix.lower() in SKIP_SUFFIXES:
                continue
            try:
                text = path.read_text("utf-8", errors="ignore")
            except OSError as err:
                print(f"  could not read {path}: {err}", file=sys.stderr)
                continue
            found += scan_text(str(path.relative_to(ROOT)), text)
    return found


def staged() -> list[str]:
    """Only the files this commit would publish. A pre-commit hook must answer
    in a second or two on any repository; a full-tree walk cannot, and a hook
    people wait two minutes for is a hook people disable."""
    found = []
    try:
        names = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0")
    except subprocess.CalledProcessError as err:
        print(f"  could not list staged files: {err}", file=sys.stderr)
        return found
    for name in filter(None, names):
        if Path(name).suffix.lower() in SKIP_SUFFIXES:
            continue
        try:
            text = subprocess.run(("git", "show", f":{name}"), cwd=ROOT, capture_output=True,
                                  check=True).stdout.decode("utf-8", "ignore")
        except subprocess.CalledProcessError as err:
            print(f"  could not read staged {name}: {err}", file=sys.stderr)
            continue
        found += scan_text(name, text)
    return found


def git(*args: str) -> str:
    return subprocess.run(("git", *args), cwd=ROOT, capture_output=True,
                          text=True, check=True).stdout


def history() -> list[str]:
    """Every blob that has ever been committed, scanned once each.

    By blob rather than by commit: the same file content appears in hundreds of
    commits, and scanning it once per commit would be hundreds of times the
    work for exactly the same answer.
    """
    found = []
    listing = git("rev-list", "--objects", "--all")
    seen: set[str] = set()
    blobs: list[tuple[str, str]] = []
    for row in listing.splitlines():
        parts = row.split(" ", 1)
        if len(parts) != 2:
            continue
        sha, name = parts
        if sha in seen:
            continue
        seen.add(sha)
        if Path(name).suffix.lower() in SKIP_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in Path(name).parts):
            continue
        blobs.append((sha, name))

    print(f"  {len(blobs)} distinct blobs to read")
    for sha, name in blobs:
        try:
            kind = git("cat-file", "-t", sha).strip()
        except subprocess.CalledProcessError:
            continue
        if kind != "blob":
            continue
        try:
            text = subprocess.run(("git", "cat-file", "blob", sha), cwd=ROOT,
                                  capture_output=True, check=True).stdout
        except subprocess.CalledProcessError as err:
            print(f"  could not read blob {sha[:8]} ({name}): {err}", file=sys.stderr)
            continue
        found += scan_text(f"{name}@{sha[:8]}", text.decode("utf-8", "ignore"))
    return found


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--history", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--staged", action="store_true", help="only files staged for commit (pre-commit hook)")
    args = ap.parse_args()

    found: list[str] = []
    if args.staged:
        print("\nSCANNING STAGED FILES\n")
        found += staged()
        held = set(filter(None, git("diff", "--cached", "--name-only", "-z").split("\0")))
        if found:
            print("  STAGED FOR COMMIT. Every one is either a credential to rotate")
            print("  or a pattern to add to KNOWN_EXAMPLES with a reason:")
            for line in found:
                print(f"    {line}")
            print(""); return 1
        print("  nothing in any staged file.\n"); return 0
    if not args.history or args.all:
        print("\nSCANNING THE WORKING TREE\n")
        found += tree()
    if args.history or args.all:
        print("\nSCANNING EVERY COMMIT\n")
        found += history()

    # A secret in a file git tracks is in every clone and needs rotating. A
    # secret in an untracked file is a real credential doing its job on one
    # machine: it is reported so nobody mistakes silence for absence, but it
    # does not fail the scan.
    held = tracked_files()
    published, local = [], []
    for line in found:
        path = line.split(":", 1)[0].split("@", 1)[0]
        (published if path in held else local).append(line)

    print("")
    if local:
        print("  Local, untracked, not in any clone (a credential in use):")
        for line in local:
            print(f"    {line}")
        print("")
    if published:
        print("  IN FILES GIT TRACKS. Every one is either a credential to rotate")
        print("  or a pattern to add to KNOWN_EXAMPLES with a reason:")
        for line in published:
            print(f"    {line}")
        print("")
        return 1
    print("  nothing in any tracked file.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
