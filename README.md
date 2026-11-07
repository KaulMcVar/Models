# McModels Catalog (React 16 + Node.js)

View-only website for the sorted packs. Visitors can browse, search and look at
previews. They can not download pack files.

## Run it

Double-click `Start Website.bat`, or:

```
npm install
npm run build
npm start
```

Then open http://127.0.0.1:4321

## Launch it for other people

The server only listens on this computer by default. To let others reach it,
start it with `HOST=0.0.0.0` (and optionally `PORT=80`), or put it behind a
host or tunnel (for example Cloudflare Tunnel) that points at port 4321.

PowerShell:

```
$env:HOST="0.0.0.0"; node server.js
```

## What the server sends (and does not)

- Sends: the page, the pack list (`/api/packs`: names, status, item names,
  notes), and each pack's `preview.png` / creator image (`/img/...`).
- Never sends: configs, models, textures, zips, .jar files, README.txt,
  INDEX.html, `_check_data`, folder paths or source maps. Pictures are looked
  up by id in a fixed list, so a typed address can not reach other files.
- Only GET and HEAD requests. Strict security headers (CSP, nosniff, no framing).

Note: any picture shown in a browser can still be screenshotted. The site
blocks drag and right-click save on pictures, but that only slows people down.

## Updating

The pack list is read from `../README.txt` and `../_check_data/*.json` when
the server starts. Restart the server after changing the packs.

## Tests

`npm test` builds the site and checks that every pack and picture loads and
that pack files, paths and source maps can not be fetched.
