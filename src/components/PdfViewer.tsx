/**
 * PdfViewer.tsx
 *
 * Renders a PDF file (served from /public) onto a <canvas> using PDF.js.
 * Supports:
 *   - Scroll-wheel zoom (centred on cursor position)
 *   - Zoom-in / zoom-out buttons + fit-to-width reset
 *   - Click-and-drag to pan
 *   - Multi-page rendering (each page stacked vertically)
 *
 * Usage:
 *   <PdfViewer src="/layouts/P1A%20L1%201.pdf" />
 *
 * Install dependency first:
 *   npm install pdfjs-dist
 */

import { AlertCircle, Loader2, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// PDF.js bootstrap
// We import the ESM build.  The worker must point to the same version bundle.
// ---------------------------------------------------------------------------
import * as pdfjsLib from 'pdfjs-dist';

// Worker is copied to /public/pdf.worker.min.mjs by setup-pdfjs-worker.js
// so it is always served as a plain static file in both dev and production.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;
const INITIAL_SCALE = 1.5; // render resolution multiplier (higher = sharper)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PdfViewerProps {
  /** URL of the PDF, e.g. "/layouts/P1A%20L1%201.pdf" */
  src: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PdfViewer({ src }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  // Rendered canvases per page
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // State
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Pan state (stored in a ref to avoid re-renders on every mouse move)
  const pan = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // PDF document reference
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // ── Load & render ─────────────────────────────────────────────────────────
  const renderAllPages = useCallback(
    async (doc: pdfjsLib.PDFDocumentProxy, scale: number) => {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefs.current[i - 1];
        if (!canvas) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';

        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;
      }
    },
    []
  );

  useEffect(() => {
    if (!src) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNumPages(0);
    pan.current = { x: 0, y: 0 };
    if (canvasWrapRef.current) {
      canvasWrapRef.current.style.transform = `translate(0px, 0px) scale(1)`;
    }

    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(src);
        const doc = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);

        // Give React a tick to create canvas elements
        await new Promise((r) => setTimeout(r, 0));
        if (cancelled) return;

        await renderAllPages(doc, INITIAL_SCALE);
      } catch (err) {
        if (!cancelled) {
          setError(`Failed to load PDF: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, renderAllPages]);

  // ── CSS transform for zoom + pan ──────────────────────────────────────────
  const applyTransform = useCallback((z: number, px: number, py: number) => {
    if (!canvasWrapRef.current) return;
    canvasWrapRef.current.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
  }, []);

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

  const setZoomAt = useCallback(
    (newZoom: number, originX?: number, originY?: number) => {
      const z = clampZoom(newZoom);
      if (canvasWrapRef.current && originX !== undefined && originY !== undefined) {
        // Adjust pan so zoom centres on cursor position
        const rect = canvasWrapRef.current.getBoundingClientRect();
        const offsetX = originX - rect.left - rect.width / 2;
        const offsetY = originY - rect.top - rect.height / 2;
        const scale = z / zoom;
        pan.current = {
          x: pan.current.x + offsetX * (1 - scale),
          y: pan.current.y + offsetY * (1 - scale),
        };
      }
      setZoom(z);
      applyTransform(z, pan.current.x, pan.current.y);
    },
    [zoom, applyTransform]
  );

  const zoomIn = () => setZoomAt(zoom + ZOOM_STEP);
  const zoomOut = () => setZoomAt(zoom - ZOOM_STEP);
  const zoomReset = () => {
    pan.current = { x: 0, y: 0 };
    setZoom(1);
    applyTransform(1, 0, 0);
  };

  // ── Scroll-wheel zoom ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoomAt(zoom + delta, e.clientX, e.clientY);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, setZoomAt]);

  // ── Drag to pan ────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      px: pan.current.x,
      py: pan.current.y,
    };
    e.preventDefault();
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    pan.current = { x: dragStart.current.px + dx, y: dragStart.current.py + dy };
    applyTransform(zoom, pan.current.x, pan.current.y);
  };

  const onMouseUp = () => {
    dragging.current = false;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden bg-[hsl(var(--muted)/0.15)] select-none"
      style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* ── Toolbar ── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-card/90 backdrop-blur border border-border rounded-lg px-2 py-1.5 shadow-sm">
        <button
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          title="Zoom out"
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-accent disabled:opacity-30 transition-colors"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="text-[11px] font-mono text-muted-foreground w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          title="Zoom in"
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-accent disabled:opacity-30 transition-colors"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button
          onClick={zoomReset}
          title="Fit to width"
          className="flex items-center justify-center w-7 h-7 rounded hover:bg-accent transition-colors"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading layout…</p>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 px-8">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      {/* ── Canvas pages (transform wrapper) ── */}
      {!error && (
        <div
          className="absolute inset-0 flex items-start justify-center overflow-visible pointer-events-none"
          style={{ paddingTop: '24px' }}
        >
          <div
            ref={canvasWrapRef}
            className="flex flex-col gap-4 pointer-events-none"
            style={{
              transformOrigin: 'center top',
              willChange: 'transform',
              transition: 'none',
            }}
          >
            {Array.from({ length: numPages }).map((_, i) => (
              <canvas
                key={i}
                ref={(el) => { canvasRefs.current[i] = el; }}
                className="shadow-lg rounded-sm bg-white"
                style={{ maxWidth: '100%', display: 'block' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
