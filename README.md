# HoopTrack v2.0

HoopTrack is a mobile-first, offline-capable basketball stat tracker for one player. This release is designed to deploy directly to GitHub Pages from a repository root.

## Features

- Persistent player, season, league, and team defaults
- Fast live game tracking by quarter plus unlimited overtime periods
- Made/missed free throws, 2-pointers, and 3-pointers
- FG%, 2PT%, 3PT%, FT%, and eFG%
- Assists, rebounds, steals, blocks, turnovers, and personal fouls
- Optional playing-time tracking with IN GAME / ON BENCH control
- Editable in-game notes
- Full event log with deletion of any individual event and Undo Last
- Live running totals and period-by-period breakdown
- End / Resume game workflow
- Double-double, triple-double, 20/30-point, 5-threes, 5-block, 5-steal, 10-assist, and 10-rebound achievements
- Persistent achievement badges
- Favorite/highlight games
- Game search, season filter, league filter, favorites filter, and sorting
- Select two games for side-by-side comparison
- Season highs, last-five averages, league comparison, and performance trend chart
- System / Light / Dark themes
- Optional haptic feedback
- Optional screen wake lock during active games
- JSON backup and restore
- CSV export for Excel / Google Sheets
- Android native Share sheet support
- Offline PWA support

## GitHub Pages deployment

1. Create a GitHub repository, for example `hooptrack`.
2. Put the contents of this folder in the repository root. `index.html`, `app.js`, and `manifest.webmanifest` should be at the top level.
3. Commit and push to the `main` branch.
4. In GitHub go to **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select **main** and **/(root)**, then save.
7. GitHub will publish the app at a URL similar to `https://USERNAME.github.io/hooptrack/`.
8. Open that URL in Chrome on Android and choose **Install app**.

All resource paths, manifest URLs, service-worker scope, and start URL are relative, so the app works correctly from a GitHub Pages project path such as `/hooptrack/`.

## Moving existing localhost data

Browser storage is tied to the site's origin. Data stored under `http://localhost:8080` will not automatically appear at a GitHub Pages URL.

Before switching permanently:

1. Open the old HoopTrack installation.
2. Go to **Settings → Data → Backup JSON**.
3. Save the backup file.
4. Open the GitHub Pages version.
5. Go to **Settings → Data → Restore JSON** and select the backup.

## Data storage

HoopTrack stores its working data in browser local storage. GitHub Pages hosts only the application files; game data is not uploaded to GitHub. Use the JSON Backup feature regularly if the season data is important.
