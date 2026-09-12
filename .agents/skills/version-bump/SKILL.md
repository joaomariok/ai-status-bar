---
name: version-bump
description: Use when the user asks to cut, bump, or ship a patch or minor release of AI Status Bar (e.g. "bump patch to X", "cut a minor release").
---

# version-bump

Runs this repo's release pipeline for a `patch` or `minor` version bump, from
a clean `main` up to (and including, on explicit approval) pushing the
release tag to GitHub. See [docs/build-and-release.md](../../../docs/build-and-release.md)
for the background this skill automates.

Argument: `patch` or `minor`. Reject anything else, including `major` — a
major bump is a deliberate human decision, not this skill's job.

## Pipeline

1. **Preflight.** `git status` must be clean and the current branch must be
   `main` (up to date with `origin/main`) — stop and tell the user otherwise
   rather than working around it. Read the current version from
   `package.json`.

2. **Branch.** `git checkout -b chore/release_<new_version_underscored>`
   (e.g. `chore/release_1_1_1`). Compute `<new_version>` first — see step 3.

3. **Bump.** Run `npm run bump:<patch|minor>:compile` (i.e.
   `npm run bump:patch:compile` or `npm run bump:minor:compile`). This runs
   `npm version <patch|minor> --no-git-tag-version && npm run compile` —
   updates `package.json` and lets npm update `package-lock.json` itself.
   Never hand-edit either file, and never hand-edit `out/`.

4. **Changelog.** Insert a new section into `CHANGELOG.md` directly above the
   previous version's section, matching the existing heading format exactly:
   `## <new_version> - <YYYY-MM-DD>` (today's date). Derive the bullet list
   from `git log v<previous_version>..HEAD --oneline` — one bullet per
   user-visible change, in plain English, matching the tone of existing
   entries. Omit purely internal changes only if they truly have no
   user-visible effect; when in doubt, include them (see 1.1.1's entry for a
   worked example of including dev-tooling changes).

   This step cannot be skipped: the release workflow extracts this section
   as the GitHub Release notes and **fails the whole release if the section
   is missing**.

5. **Gate.** Run `npm run gate` (typecheck → tests → packaging dry-run) and
   `node scripts/releasenotes.mjs <new_version>` to confirm the new changelog
   section extracts cleanly. Also re-check `package.json`'s `"version"` field
   reads `<new_version>` exactly — the release workflow fails if the pushed
   tag and this field disagree.

6. **STOP — commit approval.** Show the user: the branch name, the exact
   paths to stage (always `package.json`, `package-lock.json`,
   `CHANGELOG.md` — never `git add .` / `git add -A`), the gate output, and
   the commit message `chore: release <new_version>`. Wait for explicit
   approval before doing anything below this line.

   Once approved, land it immediately (this is the standing "lgtm" land-it
   sequence — see the `lgtm` skill if present):
   - `git add package.json package-lock.json CHANGELOG.md`
   - `git commit -m "chore: release <new_version>"`
   - `git checkout main && git merge --ff-only chore/release_<new_version_underscored>`
     — if this is not a fast-forward (main has diverged), stop and tell the
     user instead of forcing anything.
   - `git branch -d chore/release_<new_version_underscored>`
   - `git push origin main`

7. **STOP — tag/publish approval.** Separately from step 6, ask before
   tagging and pushing the tag — this is what triggers
   `.github/workflows/release.yml` and publishes the GitHub Release:
   - `git tag -a v<new_version> -m "AI Status Bar <new_version>"`
   - `git push origin v<new_version>`

   Never combine steps 6 and 7 into one approval — a single "lgtm" after
   step 6 authorizes only the commit/merge/push-to-main sequence, not the
   tag push.

## What can go wrong

- **Tag/`package.json` mismatch** — the release workflow checks the pushed
  tag's version against `package.json` and fails the build if they differ.
- **Missing changelog section** — `scripts/releasenotes.mjs` throws if the
  version has no `## <version> - ...` section, and the release workflow
  fails the same way; step 5 catches this before it reaches CI.
- **Hand-edited `package-lock.json` or `out/`** — both are generated; let
  `npm version` and `npm run compile` produce them.
- **Non-fast-forward merge in step 6** — means `main` moved since the branch
  was cut; stop and ask rather than rebasing or force-pushing.
