#!/usr/bin/env bash
set -e

# ── 1. Types & mock data ──────────────────────────────────────────────────────
git add src/types/index.ts src/mocks/data.ts
git commit -m "feat: update types and mock data"

# ── 2. PdfViewer component ────────────────────────────────────────────────────
git add src/components/PdfViewer.tsx
git commit -m "feat: add PdfViewer component

- Serve pdf.js worker from /public/pdf.worker.min.mjs (static path)
- Fixes worker fetch failure in production behind Nginx"

# ── 3. PDF layout files ───────────────────────────────────────────────────────
git add public/layouts/
git commit -m "feat: add plant floor plan PDF layouts"

# ── 4. Plants page ────────────────────────────────────────────────────────────
git add src/pages/Plants.tsx
git commit -m "feat(plants): map popup with View Layouts / Plant Details buttons

- Click marker on map shows popup with two action buttons
- Sidebar plant cards get Layout and Details footer buttons
- PDF viewer header shows layout name pill with dropdown picker
- Plant 1 supports multiple selectable layouts via dropdown
- Other plants show No Layouts Available empty state"

# ── 5. GlobalOverview page ────────────────────────────────────────────────────
git add src/pages/GlobalOverview.tsx
git commit -m "feat(overview): update GlobalOverview page"

# ── 6. pdf.js worker setup script ────────────────────────────────────────────
git add setup-pdfjs-worker.js
git commit -m "chore: add setup-pdfjs-worker.js

Copies pdf.worker.min.mjs from node_modules to public/ so the worker
is always served as a plain static file — no dynamic import, no Vite
asset hashing, works in both dev and production."

# ── 7. Vite config + package deps ─────────────────────────────────────────────
git add vite.config.ts package.json package-lock.json
git commit -m "chore: update vite config and dependencies

- build script now runs setup-pdfjs-worker.js before vite build"

echo ""
echo "All commits done."
git log --oneline -7
