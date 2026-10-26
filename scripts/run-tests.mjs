import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
mkdirSync('.test-build', { recursive: true });
writeFileSync('.test-build/package.json', '{"type":"commonjs"}');
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--outDir', '.test-build', '--rootDir', 'src', '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'es2022', '--strict', '--skipLibCheck', 'src/state/model.ts', 'src/state/validation.ts', 'src/state/actions.ts', 'src/persistence/adapter.ts', 'src/persistence/repository.ts', 'src/persistence/backup.ts', 'src/ui/cardAppearance.ts', 'src/dashboard/layout.ts', 'src/extension/runner.ts', 'src/assets/images.ts', 'src/widgets/dates.ts', 'src/widgets/clockPresentation.ts', 'src/widgets/wellbeingSummary.ts', 'src/weather/provider.ts'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--test', ...readdirSync('tests').filter(name => name.endsWith('.test.mjs')).map(name => `tests/${name}`)], { stdio: 'inherit' });


