/**
 * Copy the pinned Basic Pitch model into the static `public/` directory.
 *
 * The model ships inside `@spotify/basic-pitch` (see package.json / lockfile for
 * the exact version), so the deployed assets are always the ones that match the
 * installed runtime. Nothing is fetched from a third-party CDN at runtime.
 *
 * Run automatically by `npm run dev` and `npm run build`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@spotify', 'basic-pitch', 'model');
const target = join(root, 'public', 'model');

if (!existsSync(source)) {
  console.error(`[model] Basic Pitch model not found at ${source}. Run npm install first.`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

const version = JSON.parse(
  readFileSync(join(root, 'node_modules', '@spotify', 'basic-pitch', 'package.json'), 'utf8')
).version;

const files = ['model.json', 'group1-shard1of1.bin'];
let total = 0;
for (const file of files) {
  const path = join(target, file);
  if (!existsSync(path)) {
    console.error(`[model] expected asset missing: ${file}`);
    process.exit(1);
  }
  const size = statSync(path).size;
  total += size;
  // Cloudflare Pages allows at most 25 MiB per asset.
  if (size > 25 * 1024 * 1024) {
    console.error(`[model] ${file} is ${size} bytes, above the Cloudflare Pages 25 MiB asset limit.`);
    process.exit(1);
  }
}

console.log(`[model] copied Basic Pitch v${version} model to public/model (${(total / 1024).toFixed(0)} KiB total)`);
