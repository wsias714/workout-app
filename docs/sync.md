# Dropbox sync and data budget

Why: history lived only in the phone's `localStorage` (one iOS storage purge or a phone swap
loses it). It now syncs to Dropbox, merges safely across devices, and cleans up after itself so
the Dropbox folder stays small. Pattern and rules: the `mobile-dropbox-sync` skill
(`~/.claude/skills/mobile-dropbox-sync`), first built in `~/Projects/ListenMore`.

## Who writes what
Dropbox folder `Apps/GymTracker/` (a Dropbox "App folder": the app can reach nothing else).

| Path | Written by | Contents |
|---|---|---|
| `data.json` | the app | workouts, meta (routines, gyms, settings, tombstones), activity |
| `archive/<year>.json` | the app | full-detail workouts that were rolled up (cold storage) |
| `backups/premigration-*.json` | the app, once per phone | safety copy before the first sync |
| `backups/auto-YYYY-MM-DD.json` | the app, weekly | copy of the file about to be replaced |
| `inbox/`, `coach.json` | reserved | phase 2: Health auto-export drops, scheduled coach output |

One writer per file. Writes are rev-checked: on a conflict the app re-reads, merges and retries.

## Merge rules (`src/sync/merge.ts`, pure, tested)
- **workouts:** union by id; they are never edited, only added or deleted. Deletes are tombstones.
- **routines:** union by id, later `updated` wins; a delete beats any older edit.
- **settings:** the whole object, later `settingsAt` wins. **customExercises** by name, **gyms** by id.
- **activity:** union by id. **activeGym:** per device, never synced.
- A rolled-up ("compact") workout beats its full twin.
- Strong CSV imports get deterministic ids, so importing the same CSV twice or on two phones can't duplicate.
- Restore (JSON) merges back and never deletes.

## Size budget (`src/sync/archive.ts`)
- `data.json`: stays under 1 MB (minified). Whole folder: under 25 MB. Settings shows both meters and warns at 70%.
- Over 1 MB, workouts older than the keep window (24, then 12, 6, 3 months until it fits) are rolled
  up to each exercise's best set (same shape, so charts, PRs and progression keep working) and the
  **full originals are written to `archive/<year>.json` first**. Still over: activity older than
  12 months collapses to monthly totals.
- Tombstones expire after 180 days (must exceed the longest a phone stays offline).
- Backups: premigration copies are kept; auto backups keep the newest 3 plus the newest of each of the last 6 months.
- "Export everything" in Settings merges the archive back in.

## In-progress workout
Saved to device-local `gym:session` on every change and restored on reload (up to 12 hours old). Never synced.

## One-time setup
1. <https://www.dropbox.com/developers/apps> -> Create app -> Scoped access -> App folder -> name `GymTracker`.
2. Permissions: `files.metadata.read/write`, `files.content.read/write` -> Submit.
3. Settings -> OAuth 2: Redirect URIs (add each): the live Pages URL (with trailing slash),
   `http://localhost:5173/`, `http://localhost:4173/`. Allow public clients (PKCE). Short-lived tokens.
4. Put the App key in `src/config.ts` (public under PKCE; never add a secret).
5. On the phone: Settings (gear) -> Connect Dropbox. If the sign-in doesn't return to the app, use "Use a code".

Note: `vite.config.js` uses `base: "./"`, so the redirect URI is built from `location.pathname`,
not `BASE_URL`.

## Tests
`npm test` (merge, archive, sync engine against an in-memory fake Dropbox), `npm run typecheck`.
Real phone backups go in `.local/` (gitignored, never commit).

## Phase 2 (designed, not built)
Weekly desktop job reads `data.json`, asks Claude Haiku for a short coaching note, writes `coach.json`
for the Coach tab; a daily iPhone Shortcut drops Apple Health numbers into `inbox/`.
