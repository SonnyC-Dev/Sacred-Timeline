#!/usr/bin/env python3
"""
Split mcu-tracker.html into an editable project.

    python3 split.py mcu-tracker.html src/

Produces:
    src/index.html            the page, with placeholders where the parts go
    src/styles.css            the stylesheet
    src/app.js                the application code
    src/data/titles.json      the 62 titles
    src/data/artwork.json     runtimes, episode counts, poster references
    src/assets/posters/*.jpg  posters decoded out of the base64

build.py reverses this and produces a single portable file again.
"""
import base64, json, os, re, sys


def main(src, out):
    html = open(src, encoding="utf-8").read()
    os.makedirs(os.path.join(out, "data"), exist_ok=True)
    os.makedirs(os.path.join(out, "assets", "posters"), exist_ok=True)

    def block(name, decl):
        m = re.search(r"/\* ==== BEGIN %s ==== \*/\s*%s\s*(.*?);\s*/\* ==== END %s ==== \*/"
                      % (name, decl, name), html, re.S)
        if not m:
            sys.exit("missing data block: " + name)
        return m

    titles_m = block("TITLES", r"const DATA =")
    art_m = block("ARTWORK", r"const BUILTIN_ART=")
    titles, art = json.loads(titles_m.group(1)), json.loads(art_m.group(1))

    # posters come out as real files; base64 costs about a third more than the bytes
    saved = 0
    for key, entry in art.items():
        p = entry.get("p", "")
        if p.startswith("data:image/"):
            kind = p.split(";")[0].split("/")[1]
            raw = base64.b64decode(p.split(",", 1)[1])
            name = "%s.%s" % (key, "jpg" if kind == "jpeg" else kind)
            open(os.path.join(out, "assets", "posters", name), "wb").write(raw)
            entry["p"] = "assets/posters/" + name
            saved += 1

    css = re.search(r"<style>(.*?)</style>", html, re.S)
    js = re.findall(r"<script>(.*?)</script>", html, re.S)[-1]

    open(os.path.join(out, "data", "titles.json"), "w", encoding="utf-8").write(
        json.dumps(titles, indent=1, ensure_ascii=False))
    open(os.path.join(out, "data", "artwork.json"), "w", encoding="utf-8").write(
        json.dumps(art, indent=1, ensure_ascii=False))
    open(os.path.join(out, "styles.css"), "w", encoding="utf-8").write(css.group(1).strip() + "\n")
    # the data markers sit inside the script, so strip them there, not in the page
    js_out = js.replace(titles_m.group(0), "/*TITLES*/").replace(art_m.group(0), "/*ARTWORK*/")
    open(os.path.join(out, "app.js"), "w", encoding="utf-8").write(js_out.strip() + "\n")

    page = html
    page = page.replace(css.group(0), '<link rel="stylesheet" href="styles.css">')
    page = page.replace("<script>" + js + "</script>", '<script src="app.js"></script>')
    assert '<script src="app.js">' in page, "could not detach the script"
    open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(page)

    print("split into %s" % out)
    print("  titles: %d   posters written: %d" % (len(titles), saved))
    print("  app.js expects the data to be injected; use build.py to produce a")
    print("  runnable file, or wire the JSON in yourself when you restructure.")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
