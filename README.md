# Noodle

A browser extension for Formula 1 fans. Click the toolbar icon and a panel drops down with three tabs:

- **Standings**: driver and constructor championship points for the current season
- **Results**: the full classification of the latest Grand Prix, with gaps, places gained or lost and the fastest lap
- **News**: the latest headlines from Formula1.com, BBC Sport and Autosport, newest first

The first time you open it, Noodle asks you to pick your team. The panel then takes on that team's colors and highlights its drivers in the standings and results. Change team any time with the team button in the top bar. The choice is saved in your browser, so there's no account or server involved.

Data refreshes each time you open the panel. It's cached for a few minutes so the panel opens instantly, and the refresh button in the corner fetches everything again. Before the first race of a season, it shows the previous season's final standings and last race.

## Install it in your browser

You need [Node.js](https://nodejs.org/) 22.12 or newer.

1. Install dependencies and build:
   ```sh
   npm install
   npm run build
   ```
2. Open `chrome://extensions` (in Edge `edge://extensions`, in Brave `brave://extensions`).
3. Turn on **Developer mode**, click **Load unpacked** and choose the `dist` folder.
4. Open the extensions menu (the puzzle-piece icon) and pin **Noodle** so it stays in the toolbar.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Rebuilds `dist` whenever a file changes. Reopen the panel to see changes; after editing `public/manifest.json`, click the reload icon on the extension's card in `chrome://extensions`. |
| `npm run build` | Typechecks, then builds `dist`. |
| `npm test` | Runs the unit tests. |
| `npm run typecheck` | Typechecks without building. |

To debug the panel, right-click inside it and choose **Inspect**.

### Layout

```
public/manifest.json   extension manifest (permissions, icons, popup)
public/icons/          toolbar icons, rendered from assets/icon.svg
src/popup.html|css|ts  the drop-down panel
src/lib/f1.ts          standings and results from the Jolpica F1 API
src/lib/news.ts        news feeds: the list of sources, fetching and RSS/Atom parsing
src/lib/cache.ts       short-lived cache so the panel opens instantly
src/lib/teams.ts       the teams on the grid and their colors (used by the team picker and theme)
```

## Data sources

- **Standings and results** come from the [Jolpica F1 API](https://github.com/jolpica/jolpica-f1), the free, community-run successor to the Ergast API. It needs no key. Its rate limits (4 requests a second, 500 an hour) are far above what the panel uses. Results appear a few hours after a race ends. This is not live timing during a session.
- **News** comes from the sites' public RSS feeds. To add or remove a feed, edit `NEWS_SOURCES` in `src/lib/news.ts` and add the site to `host_permissions` in `public/manifest.json`. A unit test fails if the two don't match.

Noodle is an unofficial fan project and isn't associated with Formula 1 or any team.
