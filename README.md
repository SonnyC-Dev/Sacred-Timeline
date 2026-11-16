# Sacred Timeline

A personal Marvel watch tracker. 62 films and series, six orderings, watch
history, ratings, stats. One self-contained HTML file — no build step, no
dependencies, no network.

Live site: https://sonnyc-dev.github.io/Sacred-Timeline/ — published from
`src/` by `.github/workflows/pages.yml` on every push to `main` (GitHub Pages,
Source: GitHub Actions). Takes a minute or two after a push.

Older hosted copies (claude.ai, private; downloads don't work there):
https://claude.ai/artifact/JGoSWpQjedarHP2GbKkHEr (original) and
https://claude.ai/artifact/VUQWaRLbghdnQguh5FkbZG (with the intro).

---

## Project layout

**`src/` is the master copy. Edit there only.** It was split out of the
original single file once; the split scripts have been removed (they are in
git history) because re-running them would overwrite edits in `src/`.

This machine has no Python, so each script has a PowerShell twin:

```
powershell -ExecutionPolicy Bypass -File serve.ps1 -Root src             # run it: http://localhost:8000
powershell -ExecutionPolicy Bypass -File build.ps1 src mcu-tracker.build.html   # fold into one portable file
```

`src/` must be served over http; opening `index.html` as a file can't read the
JSON. `dev-loader.js` reads the two data files and then starts `app.js`; the
build swaps it for everything inlined, so the single file never uses it.
`build.py` has the same change but was not tested (no Python at the time).

```
src/index.html          page shell
src/dev-loader.js       loads the JSON, then app.js (src/ only)
src/styles.css          44 KB
src/app.js              112 KB
src/data/titles.json    the 62 titles
src/data/artwork.json   runtimes, episode counts, poster paths
src/assets/posters/     62 JPEGs, 1.8 MB
```

Built-in posters in `src/` are file paths (`assets/posters/…`); in the built
file they are embedded images. `isURL()` and `isLocal()` accept both, so the
app treats them the same way.

Base64 inflates bytes by about a third, so the single file is 2.4 MB where the
project is 2.0 MB.

---

## Data provenance

Do not regenerate these from memory. Each was sourced.

| What | Source |
| --- | --- |
| Film runtimes (40) | Murphy's Multiverse runtime table, July 2026 |
| Series episode counts (20) | Wikipedia list of Marvel TV series; Marvel Animation for the four-part shows |
| Series total runtimes (20) | MCU Watchlist, TMDB-derived, to one decimal hour — so ±3 minutes |
| Posters, some runtimes | TMDB, fetched with the key in `DEFAULT_TMDB` |
| Chronology (`c`) | Fan consensus. Deliberately so — there is no official ordering |

Known soft spots: the two specials' runtimes are approximate. Avengers:
Doomsday and Secret Wars have no announced runtime and are deliberately blank —
TMDB lists 165 minutes for Doomsday, which is a placeholder.

Not yet in the dataset, researched and ready to add: Wonder Man (27 Jan 2026,
8 eps), Daredevil: Born Again S2 (24 Mar 2026, 8 eps), The Punisher: One Last
Kill (12 May 2026, special), X-Men '97 S2 (1 Jul 2026, 9 eps), VisionQuest
(13 Oct 2026, 8 eps, ~6h48m), Your Friendly Neighborhood Spider-Man S2
(13 Jan 2027, 10 eps).

---

## Things that will bite you

1. **Storage** goes through a shim: artifact storage if present, else
   `localStorage`. Keys `mcu-tracker:v1` and `mcu-meta:v2`. Keep both paths.
2. **`history.pushState` throws** in sandboxed frames. Every call is wrapped and
   disables itself on first failure. Keep the guard.
3. **Copying an image to a canvas needs a cache-busting query param.** A cached
   copy fetched without cross-origin headers cannot be copied, and fails
   silently. This cost several rounds to find.
4. **`IMG()` must not prefix `data:` URLs.** It once assumed every value was a
   TMDB path and mangled every embedded image into a broken URL.
5. **Season entries carry `sea:1`** — Loki, What If…?, X-Men '97, Daredevil.
   TMDB reports whole-series episode counts, which are wrong for them.
6. **`backdrop-filter` with `clip-path` breaks rendering on phones.** Both are
   switched off below 620px on purpose.
7. **Reserved hashes on claude.ai**: `#settings` is taken, hence `#prefs`.
   An `=` in a hash may not survive, hence `#title-im1`.
8. **No API key ships in this file.** `DEFAULT_TMDB` is deliberately empty.
   Nothing needs a key now that artwork is embedded — it is only for fetching
   titles you add later. Paste one in Settings → Artwork when needed; it is
   stored in the browser. After the split, keep it in `src/config.local.js`
   and gitignore that file. Never commit it: git keeps secrets in history even
   after you delete them.

---

## Secrets

Nothing in this repo is secret, and it should stay that way. A `.gitignore`
covering `config.local.js` and `*.local.*` is in place. If a key ever does get
committed, rewriting history is awkward — regenerating the key on themoviedb.org
is free and takes a minute, so do that instead.

## Sync between devices (GitHub Gist)

Settings → Sync between devices. Optional; each device connects once with a
**tracker name** and a **GitHub fine-grained token** whose only permission is
Account → Gists: Read and write.

- Each tracker name is its own **secret** Gist on that account, described
  "Sacred Timeline sync — <name>". Two people can share one account and keep
  separate trackers by using different names. Secret means unlisted, not
  private: anyone with the Gist's URL can read it.
- Synced: watched (with dates), ratings, notes, episode progress, hidden titles.
  Not synced: artwork and display preferences, which stay per device.
- Merge is per title: `save()` records when each title last changed (removals
  too) and the newer change wins on both sides. Data from before sync was
  switched on keeps the device's version and adds titles only the Gist has.
- Syncs on opening, about 2.5s after a change, when the app comes back into
  view, and when it is hidden with changes pending.
- The token is stored in the browser (`mcu-sync:v1`) and nowhere else: not in
  backups, progress codes or this repo. "Stop syncing on this device" erases it.
- If a token leaks, revoke it on GitHub (Settings → Developer settings) and
  make a new one; the Gists are unaffected.

## Still to do

- **Regenerate the TMDB key.** The original was pasted into a chat and shipped
  inside published HTML before being removed, so treat it as exposed. It is a
  free read-only key, so the realistic worst case is someone spending your
  quota, but regenerating it on themoviedb.org takes a minute. Paste the new
  one into Settings → Artwork only when you next need to fetch a title; it
  stays in the browser and never in this repo.

- Service worker and real hosting, for offline and an install prompt. The
  manifest exists but is generated at runtime as a blob, which will not satisfy
  Android's install criteria.
- Add the six Phase 6 titles above.
- Post-credits scene flags per title.
- Marathon builder: given N hours, assemble a running order that fits.
