#!/usr/bin/env python3
"""
Rebuild the single portable file from the split project.

    python3 build.py src/ mcu-tracker.html

Inlines the stylesheet, the code and both data blocks, and folds every poster
back in as base64 so the result needs no network and no server.
"""
import base64, json, os, re, sys

MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def main(src, out):
    page = open(os.path.join(src, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(src, "styles.css"), encoding="utf-8").read()
    js = open(os.path.join(src, "app.js"), encoding="utf-8").read()
    titles = json.load(open(os.path.join(src, "data", "titles.json"), encoding="utf-8"))
    art = json.load(open(os.path.join(src, "data", "artwork.json"), encoding="utf-8"))

    folded = 0
    for entry in art.values():
        p = entry.get("p", "")
        if p and not p.startswith(("data:", "http")):
            path = os.path.join(src, p)
            if not os.path.exists(path):
                print("  missing poster, left as a path: " + p)
                continue
            mime = MIME.get(os.path.splitext(path)[1].lower(), "image/jpeg")
            entry["p"] = "data:%s;base64,%s" % (
                mime, base64.b64encode(open(path, "rb").read()).decode())
            folded += 1

    def j(o):
        s = json.dumps(o, separators=(",", ":"), ensure_ascii=False)
        if "</script" in s:
            sys.exit("data contains a closing script tag; refusing to build")
        return s

    # the hosted site's manifest file doesn't travel with the single file; the app
    # builds its own manifest at run time when no <link rel="manifest"> is present
    # (untested: no Python was available when this was added)
    page = re.sub(r'<link rel="manifest"[^>]*>(<!--.*?-->)?\r?\n', '', page)
    page = page.replace('<link rel="stylesheet" href="styles.css">',
                        "<style>\n" + css.strip() + "\n</style>")
    js = js.replace("/*TITLES*/",
        "/* ==== BEGIN TITLES ==== */\nconst DATA = %s;\n/* ==== END TITLES ==== */" % j(titles))
    js = js.replace("/*ARTWORK*/",
        "/* ==== BEGIN ARTWORK ==== */\nconst BUILTIN_ART=%s;\n/* ==== END ARTWORK ==== */" % j(art))
    # src/index.html starts the app through dev-loader.js (which fetches the JSON);
    # the single file needs neither, so that tag becomes the inlined code.
    # NOTE: this change is untested; Python was not available when it was made.
    inline = "<script>\n" + js.strip() + "\n</script>"
    page = page.replace('<script src="dev-loader.js"></script>', inline)
    page = page.replace('<script src="app.js"></script>', inline)
    if re.search(r'<script src="(dev-loader|app)\.js">', page):
        sys.exit("could not inline the script")

    open(out, "w", encoding="utf-8").write(page)
    print("built %s  (%.2f MB, %d posters inlined)" % (out, len(page) / 1048576, folded))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
