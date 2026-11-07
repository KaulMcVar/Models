'use strict';
// Bundles src/ into dist/ with esbuild. Works with React 16 (classic JSX).
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

async function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

  const result = await esbuild.build({
    entryPoints: [path.join(SRC, 'index.jsx')],
    bundle: true,
    minify: true,
    sourcemap: true,
    target: ['chrome90', 'firefox88', 'safari14', 'edge90'],
    outdir: path.join(DIST, 'assets'),
    entryNames: 'app-[hash]',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'css' },
    metafile: true,
    logLevel: 'warning',
  });

  const outputs = Object.keys(result.metafile.outputs).map((f) => path.basename(f));
  const js = outputs.find((f) => f.endsWith('.js'));
  const css = outputs.find((f) => f.endsWith('.css'));
  if (!js || !css) throw new Error('Build did not produce both JS and CSS');

  const html = fs
    .readFileSync(path.join(SRC, 'index.html'), 'utf8')
    .replace('%CSS%', 'assets/' + css)
    .replace('%JS%', 'assets/' + js);
  fs.writeFileSync(path.join(DIST, 'index.html'), html);
  fs.copyFileSync(path.join(SRC, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
  console.log('Built dist/ (' + js + ', ' + css + ')');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
