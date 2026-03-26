/**
 * Run this once to copy the world-atlas topojson to the public folder:
 *   node setup-map.js
 */
import { copyFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const src  = join(__dirname, 'node_modules', 'world-atlas', 'countries-50m.json');
const dest = join(__dirname, 'public', 'world-countries.json');

if (!existsSync(src)) {
  console.error('world-atlas not found. Run: npm install world-atlas');
  process.exit(1);
}

copyFileSync(src, dest);
console.log('✅ Copied world-atlas/countries-50m.json → public/world-countries.json');
console.log('   Size:', (statSync(dest).size / 1024).toFixed(0), 'KB');
