# Sacred Timeline

A personal Marvel watch tracker. 62 films and series, six orderings, watch
history, ratings, stats. One self-contained HTML file — no build step, no
dependencies, no network.

Hosted copy: https://claude.ai/artifact/JGoSWpQjedarHP2GbKkHEr

---

## Moving to a project layout

```
python3 split.py mcu-tracker.html src/     # explode into editable files
cd src && python3 -m http.server 8000      # the JSON blocks need http, not file://
python3 build.py src/ mcu-tracker.html     # fold it back into one portable file
```

The round-trip is verified: a rebuilt file passes the same tests as the
original. Keep both — edit the project, ship the single file.

```
src/index.html          page shell with placeholders
src/styles.css          44 KB
src/app.js              112 KB
src/data/titles.json    the 62 titles
src/data/artwork.json   runtimes, episode counts, poster paths
src/assets/posters/     62 JPEGs, 1.8 MB
```

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
