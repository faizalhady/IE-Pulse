/**
 * setup-pdfjs-worker.js
 *
 * Copies the pdf.js worker bundle from node_modules into /public so it is
 * served as a plain static file. This makes it work in both dev and
 * production (Nginx / serve) without any dynamic import or Vite hashing.
 *
 * Run once after npm install, or add to your "build" script:
 *   "build": "node setup-pdfjs-worker.js && vite build"
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const src = resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const dest = resolve(__dirname, 'public/pdf.worker.min.mjs');

if (!existsSync(src)) {
  console.error('ERROR: pdfjs-dist worker not found at', src);
  console.error('Run: npm install pdfjs-dist');
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log('✓ pdf.worker.min.mjs copied to public/');
