# Gym Tracker

A mobile-first strength-training log: Strong CSV import, per-exercise estimated-1RM
charts, auto progressions, gym-aware routines (Main Gym / HOA Gym), rest timer, and
JSON backup. Installs to the iPhone home screen as a standalone app. Data is stored
locally on the device (localStorage).

Built with React + Vite. No backend, no accounts, free to host.

## Features

- **Strong CSV import** (auto-repairs malformed rows, ignores typo rep counts)
- **Light "Chalk" UI** — paper-white, cobalt accent, monospace data readouts
- **Repeat last workout** — one tap reloads your most recent session, progressed
- **One-tap routines** per gym, including coach-generated ones
- **Confirm-all** — finish a whole exercise (or the whole session) in one tap
- **Progress charts** — estimated 1RM over time, PRs, suggested next targets
- **Settings** — weight increment, rest timer, rep range, units
- **Gym Coach handoff** — import routines built by the Gym Coach skill in Claude

---

## Run locally (optional)

```bash
npm install
npm run dev
```

## Ship it (first time, ~5 min)

1. **Publish to GitHub** — VS Code → Source Control → **Publish to GitHub** → Private,
   name it `gym-tracker`.
2. **Enable hosting** — github.com → repo → **Settings → Pages → Source: GitHub Actions**.
3. Live in ~1 min at `https://<your-username>.github.io/gym-tracker/`.
   (Repo name doesn't matter — `vite.config.js` uses a relative base.)

## Update later

VS Code → Source Control → commit message → **Commit** → **Sync Changes**.

## Install on iPhone

Open the live URL **in Safari** → **Share → Add to Home Screen → Add.** Opens fullscreen.
Tap **Backup** in the app every so often (iOS can clear unused web-app data; the backup
also moves history between devices).

## The Gym Coach loop (in Claude)

1. In the app: **Backup / share with coach** → save the JSON.
2. In Claude with the **Gym Coach** skill: attach that backup, say what you want
   (e.g. "8-week block to bring up bench" or "in-season plan for soccer").
3. The coach returns a `*-routines.json` file.
4. In the app: **Add coach routines** → pick that file. New routines appear under the
   right gym, tagged "coach", ready to run.

---

## Routine import format (used by the Gym Coach skill)

```json
{
  "type": "gymtracker-routines",
  "version": 1,
  "routines": [
    {
      "name": "Bench Push — Week 1",
      "gym": "main",
      "exercises": [
        { "name": "Bench Press (Barbell)", "sets": 4, "reps": 6, "weight": 135 }
      ]
    }
  ]
}
```

- `gym`: `"main"` or `"hoa"` (unknown values fall back to Main Gym).
- `weight`: a number, or `0` to let the app auto-fill from your history on start.
- Exercise `name` should match how it appears in your history when possible.

## Project layout

```
index.html                     shell + PWA/Apple meta
vite.config.js                 relative-base config
public/manifest.webmanifest    installability
public/icons/                  cobalt app icons
src/App.jsx                    the whole app
.github/workflows/deploy.yml   auto build + deploy
```

## Notes

- Storage lives in `loadKey`/`saveKey` at the top of `App.jsx` (localStorage in browser,
  `window.storage` if pasted into a Claude artifact). Swap for an API to add sync later.
- `recharts` is the largest dependency; lazy-load the Progress screen if bundle size matters.
