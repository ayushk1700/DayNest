import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('music experience provides disconnected actions and immersive copy', () => {
  const ui = read('../src/music/MusicExperience.tsx');
  assert.match(ui, /Open YouTube Music/);
  assert.match(ui, /Immersive/);
  assert.match(ui, /Your music, in its own space\./);
});
test('music connector is restricted to the player bar and supported controls', () => {
  const connector = read('../src/extension/music-content.ts');
  const background = read('../src/extension/music-background.ts');
  assert.match(connector, /ytmusic-player-bar/);
  assert.match(connector, /function control\(action: MusicAction\)/);
  assert.match(connector, /document\.title/);
  assert.match(connector, /meta\[name="music:musician"\]/);
  assert.match(background, /scripting\.executeScript/);
  assert.match(connector, /__daynestMusicConnectorLoaded/);
  assert.doesNotMatch(connector, /shuffle|repeat|seek/i);
});
test('Music is a stored widget type but only the top-bar launcher is exposed', () => {
  const model = read('../src/state/model.ts');
  const picker = read('../src/dashboard/Dashboard.tsx');
  const layout = read('../src/dashboard/layout.ts');
  const renderer = read('../src/widgets/DashboardWidgets.tsx');
  const validation = read('../src/state/validation.ts');
  assert.match(model, /music: Record<string, never>/);
  assert.doesNotMatch(picker, /\['Music', 'play'\]/);
  assert.match(picker, /className="music-toggle"/);
  assert.match(layout, /music: \{ width: 250, height: 280 \}/);
  assert.match(renderer, /<MusicExperience widget=\{widget\}\s*\/>/);
  assert.match(validation, /if \(w\.type === 'music'\)/);
});
test('immersive page is included in extension output configuration', () => {
  const config = read('../vite.config.ts');
  const manifest = JSON.parse(read('../public/manifest.json'));
  assert.match(config, /immersive:'immersive\.html'/);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://music.youtube.com/*']);
  assert.deepEqual(manifest.permissions, ['storage', 'alarms', 'scripting']);
});
test('immersive experience uses the live album artwork gallery and dock layout', () => {
  const ui = read('../src/music/MusicExperience.tsx');
  const css = read('../src/music/music.css');
  assert.match(ui, /gallery-showcase/);
  assert.match(ui, /gallery-vinyl/);
  assert.match(ui, /gallery-dock/);
  assert.match(css, /\.gallery-vinyl/);
  assert.match(css, /\.gallery-timeline/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
