/* Development loader: only used when running the src/ folder through a web server.
   Reads the two data files, hands them to the app, then starts app.js.
   build.ps1 / build.py replace this script tag with everything inlined, so the
   single portable file never uses it. Needs http(s): file:// can't read the JSON. */
(async () => {
  try {
    const get = async f => {
      const r = await fetch(f, { cache: "no-store" });
      if (!r.ok) throw new Error(f + ": " + r.status);
      return r.json();
    };
    [window.DATA, window.BUILTIN_ART] = await Promise.all([get("data/titles.json"), get("data/artwork.json")]);
    const s = document.createElement("script");
    s.src = "app.js";
    document.body.appendChild(s);
  } catch (e) {
    document.body.insertAdjacentHTML("afterbegin",
      '<pre style="color:#ff8a80;padding:1em;white-space:pre-wrap">Could not load the data files (' +
      String(e.message || e).replace(/[<&]/g, "") +
      '). Run this folder through a web server, e.g. serve.ps1, not by opening the file.</pre>');
  }
})();
