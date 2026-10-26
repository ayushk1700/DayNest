import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

function verifyModules(root) {
  const packageRoot = resolve(root);
  function visitDirectory(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) visitDirectory(file);
      else if (entry.name.endsWith('.js')) {
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        function check(specifier) {
          assert(ts.isStringLiteral(specifier), `Nonliteral module import in ${file}`);
          const path = specifier.text;
          assert(path.startsWith('./') || path.startsWith('../'), `Module must be bundled locally: ${path}`);
          const target = resolve(dirname(file), path);
          const inside = relative(packageRoot, target);
          assert(inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside), `Module escapes package: ${path}`);
          assert(existsSync(target), `Missing module ${path} imported by ${file}`);
        }
        function visit(node) {
          if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) check(node.moduleSpecifier);
          if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            assert(node.arguments.length > 0, `Missing dynamic import target in ${file}`);
            const specifier = node.arguments[0];
            if (ts.isStringLiteral(specifier)) check(specifier);
            else {
              // PDF.js has one same-origin worker fallback import. pdf-engine.ts pins workerSrc to Vite's packaged worker URL.
              assert(file.includes('pdfStudio-'), `Unexpected nonliteral module import in ${file}`);
              assert(ts.isPropertyAccessExpression(specifier)
                && specifier.expression.kind === ts.SyntaxKind.ThisKeyword
                && specifier.name.text === 'workerSrc', `Unexpected PDF.js dynamic import target in ${file}`);
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  visitDirectory(packageRoot);
}

export function verifyBuild(root = 'dist') {
  const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.chrome_url_overrides.newtab, 'index.html');
  assert.deepEqual(manifest.permissions, ['storage', 'alarms', 'scripting', 'activeTab', 'tabCapture', 'offscreen']);
  assert.deepEqual(manifest.optional_permissions, ['notifications', 'tabs']);
  assert.deepEqual(manifest.background, { service_worker: 'background.js', type: 'module' });
  assert(existsSync(`${root}/background.js`), 'Missing background worker');
  verifyModules(root);
  assert(readdirSync(`${root}/assets`).some(file => /^pdf\.worker.*\.mjs$/.test(file)), 'Missing locally bundled PDF.js worker');
  assert.deepEqual(manifest.host_permissions, ['https://geocoding-api.open-meteo.com/*', 'https://api.open-meteo.com/*', 'https://music.youtube.com/*']);
  assert.deepEqual(manifest.content_scripts, [{ matches: ['https://music.youtube.com/*'], js: ['music-content.js'], run_at: 'document_idle' }]);
  assert(existsSync(`${root}/music-content.js`), 'Missing bundled YouTube Music connector');
  assert(existsSync(`${root}/immersive.html`), 'Missing immersive music page');
  assert.equal(manifest.action.default_popup, 'equalizer.html');
  assert(existsSync(`${root}/equalizer.html`), 'Missing toolbar equalizer popup');
  assert(existsSync(`${root}/equalizer-offscreen.html`), 'Missing equalizer audio processor');
  assert(existsSync(`${root}/pdf.html`), 'Missing PDF Studio page');
  assert(existsSync(`${root}/pdfjs/cmaps/Adobe-Japan1-UCS2.bcmap`), 'Missing PDF.js CMap assets');
  assert(existsSync(`${root}/pdfjs/standard_fonts/FoxitSerif.pfb`), 'Missing PDF.js standard fonts');
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'self' https://geocoding-api.open-meteo.com https://api.open-meteo.com");
  const html = readFileSync(`${root}/index.html`, 'utf8');
  const favicon = html.match(/<link\s+rel="icon"[^>]+href="data:image\/png;base64,([^"]+)"/);
  assert(favicon, 'Expected embedded DayNest tab icon');
  assert.deepEqual(Buffer.from(favicon[1], 'base64'), readFileSync(`${root}/icons/daynest-favicon.png`), 'Tab icon must match the packaged sunflower');
  assert(!/<script[^>]+src=["']https?:/i.test(html));
  const entries = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)];
  assert(entries.length > 0, 'Expected bundled assets');
  for (const [, path] of entries) assert(existsSync(`${root}/${path}`), `Missing ${path}`);
  for (const file of readdirSync(`${root}/assets`).filter(f => f.endsWith('.css'))) {
    const css = readFileSync(`${root}/assets/${file}`, 'utf8');
    assert(!/@import\s|url\(\s*["']?https?:\/\//i.test(css), 'CSS must not load remote assets');
    for (const [, asset] of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g))
      if (!asset.startsWith('data:') && !asset.startsWith('#') && !asset.startsWith('%23')) assert(existsSync(resolve(dirname(resolve(root, 'assets', file)), asset)), `Missing CSS asset ${asset}`);
  }
  assert(existsSync(`${root}/licenses/flaticon.txt`), 'Missing Flaticon license');
  for (const [size, path] of Object.entries(manifest.icons)) {
    const png = readFileSync(`${root}/${path}`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }
  return manifest;
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scripts/verify-build.mjs')) {
  verifyBuild();
  console.log('Extension manifest, local entry assets, PNG dimensions and permission checks passed.');
}

