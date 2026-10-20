import test from 'node:test';
import { verifyBuild } from '../scripts/verify-build.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('production output is a self-contained new-tab extension with storage/alarms and optional notifications', () => {
  verifyBuild();
});

test('package verification rejects missing, remote, escaping and nonliteral worker imports', () => {
  const directory = mkdtempSync(join(tmpdir(), 'purrductivity-package-test-'));
  try {
    const cases = [
      ['import "./assets/missing-worker.js";', /Missing module/],
      ['export { value } from "./assets/missing-export.js";', /Missing module/],
      ['import("./assets/missing-lazy.js");', /Missing module/],
      ['import "https://example.invalid/remote.js";', /bundled locally/],
      ['import "../outside.js";', /escapes package/],
      ['import(globalThis.modulePath);', /Nonliteral module import/],
    ];
    for (const [index, [code, expected]] of cases.entries()) {
      const root = join(directory, String(index));
      cpSync('dist', root, { recursive: true });
      appendFileSync(join(root, 'background.js'), `\n${code}\n`);
      assert.throws(() => verifyBuild(root), expected);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

