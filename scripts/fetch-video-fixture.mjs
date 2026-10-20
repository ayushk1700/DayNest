// Test-only Chromium media fixture; never included in the extension or user dashboard.
import { mkdir, writeFile } from 'node:fs/promises';
const url = 'https://raw.githubusercontent.com/chromium/chromium/main/media/test/data/bear.webm';
const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw Error(`Test fixture download failed: ${response.status}`);
const bytes = new Uint8Array(await response.arrayBuffer());
if (bytes.length > 5 * 1024 * 1024 || ![0x1a, 0x45, 0xdf, 0xa3].every((value, i) => bytes[i] === value)) throw Error('Unexpected test fixture format.');
await mkdir('.test-build', { recursive: true });
await writeFile('.test-build/browser-fixture.webm', bytes);
console.log(`Saved ${bytes.length} bytes of test-only Chromium WebM footage.`);
