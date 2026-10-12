# CLAUDE.md

Notes for Claude Code sessions in this repo.

## Project
Gym Tracker: a mobile-first strength log PWA (React + Vite, JS; the sync layer is TS in `src/sync/`).
Deploys to GitHub Pages from `main` (`.github/workflows/deploy.yml`). Work on a branch, merge to `main` to deploy.

## Sync and data (added 2026-10-11)
Read `docs/sync.md` before touching sync, merge or storage. Short version:
- Phone data syncs to Dropbox `Apps/GymTracker/data.json`; merge is non-destructive (`src/sync/merge.ts`).
- Anything that deletes a workout or routine must also record a tombstone (`withTomb`); anything that edits a
  routine or settings must stamp `updated` / `settingsAt`. Otherwise sync can resurrect or lose it.
- Keep `data.json` under budget (`src/sync/archive.ts`); never store media or base64 in it.
- Run `npm test`, `npm run typecheck` and `npm run build` before every push.
- The Dropbox app key is public (PKCE). Never add a secret. `.local/` holds real phone backups: never commit.
- Skill with the general pattern: `mobile-dropbox-sync`.
