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
            check(node.arguments[0]);
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
  assert.deepEqual(manifest.permissions, ['storage', 'alarms']);
  assert.deepEqual(manifest.optional_permissions, ['notifications']);
  assert.deepEqual(manifest.background, { service_worker: 'background.js', type: 'module' });
  assert(existsSync(`${root}/background.js`), 'Missing background worker');
  verifyModules(root);
  assert.deepEqual(manifest.host_permissions, ['https://geocoding-api.open-meteo.com/*', 'https://api.open-meteo.com/*']);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'; base-uri 'none'; connect-src https://geocoding-api.open-meteo.com https://api.open-meteo.com");
  const html = readFileSync(`${root}/index.html`, 'utf8');
  assert(!/<script[^>]+src=["']https?:/i.test(html));
  const entries = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)];
  assert(entries.length > 0, 'Expected bundled assets');
  for (const [, path] of entries) assert(existsSync(`${root}/${path}`), `Missing ${path}`);
  for (const file of readdirSync(`${root}/assets`).filter(f => f.endsWith('.css'))) {
    const css = readFileSync(`${root}/assets/${file}`, 'utf8');
    assert(!/@import\s|https?:\/\//i.test(css), 'CSS must not load remote assets');
    for (const [, asset] of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g))
      if (!asset.startsWith('data:')) assert(existsSync(resolve(dirname(resolve(root, 'assets', file)), asset)), `Missing CSS asset ${asset}`);
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

