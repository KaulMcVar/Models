'use strict';
// Exports the site as plain files into docs/ for GitHub Pages.
// Only the page, packs.json and the preview pictures are copied.
// Pack files (configs, models, textures, zips) are never copied.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadCatalog } = require('./lib/catalog');

const ROOT = path.resolve(process.env.MCMODELS_ROOT || path.join(__dirname, '..'));
const DIST = path.join(__dirname, 'dist');
const OUT = path.join(__dirname, 'docs');

execFileSync(process.execPath, [path.join(__dirname, 'build.js')], { stdio: 'inherit' });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });

// Built page files, without source maps.
(function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name);
    const dst = path.join(to, e.name);
    if (e.isDirectory()) copyDir(src, dst);
    else if (!e.name.endsWith('.map')) fs.copyFileSync(src, dst);
  }
})(DIST, OUT);

const { data, images } = loadCatalog(ROOT);
fs.writeFileSync(path.join(OUT, 'packs.json'), JSON.stringify(data));

let bytes = 0;
for (const [id, file] of images) {
  if (!/^[a-z0-9-]+\.(png|webp|jpe?g|gif)$/.test(id)) throw new Error('Unexpected picture id: ' + id);
  fs.copyFileSync(file, path.join(OUT, 'img', id));
  bytes += fs.statSync(file).size;
}

// Tells GitHub Pages to serve files as they are (no Jekyll).
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log(`Exported docs/: ${data.packs.length} packs, ${images.size} pictures (${(bytes / 1048576).toFixed(1)} MB)`);
