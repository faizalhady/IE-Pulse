import { cn } from '@/lib/utils';
import {
  ChevronDown,
  Download, ImagePlus, Lock, LockOpen, MousePointer2,
  Pencil, Settings, Trash2, Upload, X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const WORKCELL_OPTIONS = [
  'Arista', 'Keysight', 'Aop', 'Micron',
  'Wabtec', 'Celestica', 'Dyson', 'Flex',
  'Gardena', 'Marin', 'Eldridge', 'Woodpecker',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Zone {
  id: string;
  label: string;
  bayNumber: string;
  workcell: string;
  status: string;
  description: string;
  color: string;
  locked: boolean;
  x: number; y: number; w: number; h: number;
}

type Tool = 'select' | 'draw';

const ZONE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const EXISTING_IMAGES = [
  'P1A.png', 'P1B.png', 'P1B L2.png', 'P1B L3.png', 'P1C.png',
];

const BASE_W = 800;
const BASE_H = 560;

function makeId() {
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LayoutEditor() {
  const [tool, setTool] = useState<Tool>('select');
  const [zones, setZones] = useState<Zone[]>([]);
  const [savedZones, setSavedZones] = useState<Zone[]>([]);
  const hasUnsavedChanges = JSON.stringify(zones) !== JSON.stringify(savedZones);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState('Untitled Layout');
  const [bottomOpen, setBottomOpen] = useState(true);
  const [showImagePicker, setShowImagePicker] = useState(false);

  // ── Viewport: zoom + pan ─────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Panning state (only in select mode, on empty canvas)
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ mx: number; my: number; px: number; py: number } | null>(null);

  // Drawing state
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawRect, setDrawRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Drag/resize state (zone manipulation)
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [resizeOrigin, setResizeOrigin] = useState<{ zone: Zone } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null); // the scrollable outer wrapper
  const canvasRef = useRef<HTMLDivElement>(null); // the actual canvas div
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // ── Coordinate helper: client XY → relative (0–1) on canvas ─────────────

  const toRel = useCallback((clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }, []);

  // ── Scroll wheel zoom (centered on mouse position) ───────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom(z => Math.max(0.3, Math.min(4, z + delta)));
  }, []);

  // ── Canvas mouse events ───────────────────────────────────────────────────

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rel = toRel(e.clientX, e.clientY);

    // ── DRAW mode ──
    if (tool === 'draw') {
      setDrawing(true);
      setDrawStart(rel);
      setDrawRect({ x: rel.x, y: rel.y, w: 0, h: 0 });
      setSelectedId(null);
      return;
    }

    // ── SELECT mode ── check if hitting a zone first
    const hit = [...zones].reverse().find(z =>
      rel.x >= z.x && rel.x <= z.x + z.w &&
      rel.y >= z.y && rel.y <= z.y + z.h
    );

    if (hit) {
      setSelectedId(hit.id);
      setDragging(true);
      setDragOffset({ x: rel.x - hit.x, y: rel.y - hit.y });
    } else {
      // Click on empty canvas → start pan
      setSelectedId(null);
      setPanning(true);
      setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
    }
  }, [tool, zones, toRel, pan]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const rel = toRel(e.clientX, e.clientY);

    // Draw preview
    if (tool === 'draw' && drawing && drawStart) {
      setDrawRect({
        x: Math.min(rel.x, drawStart.x),
        y: Math.min(rel.y, drawStart.y),
        w: Math.abs(rel.x - drawStart.x),
        h: Math.abs(rel.y - drawStart.y),
      });
      return;
    }

    // Zone drag
    if (tool === 'select' && dragging && selectedId && dragOffset) {
      setZones(prev => prev.map(z => {
        if (z.id !== selectedId) return z;
        return {
          ...z,
          x: Math.max(0, Math.min(1 - z.w, rel.x - dragOffset.x)),
          y: Math.max(0, Math.min(1 - z.h, rel.y - dragOffset.y)),
        };
      }));
      return;
    }

    // Zone resize
    if (tool === 'select' && resizing && selectedId && resizeOrigin) {
      setZones(prev => prev.map(z => {
        if (z.id !== selectedId) return z;
        const oz = resizeOrigin.zone;
        let { x, y, w, h } = oz;
        if (resizing === 'se') { w = Math.max(0.02, rel.x - oz.x); h = Math.max(0.02, rel.y - oz.y); }
        else if (resizing === 'sw') { const nx = Math.min(rel.x, oz.x + oz.w - 0.02); w = oz.x + oz.w - nx; x = nx; h = Math.max(0.02, rel.y - oz.y); }
        else if (resizing === 'ne') { w = Math.max(0.02, rel.x - oz.x); const ny = Math.min(rel.y, oz.y + oz.h - 0.02); h = oz.y + oz.h - ny; y = ny; }
        else if (resizing === 'nw') { const nx = Math.min(rel.x, oz.x + oz.w - 0.02); w = oz.x + oz.w - nx; x = nx; const ny = Math.min(rel.y, oz.y + oz.h - 0.02); h = oz.y + oz.h - ny; y = ny; }
        return { ...z, x, y, w, h };
      }));
      return;
    }

    // Pan
    if (panning && panStart) {
      setPan({
        x: panStart.px + (e.clientX - panStart.mx),
        y: panStart.py + (e.clientY - panStart.my),
      });
    }
  }, [tool, drawing, drawStart, dragging, selectedId, dragOffset, resizing, resizeOrigin, panning, panStart, toRel]);

  const handleCanvasMouseUp = useCallback(() => {
    if (tool === 'draw' && drawing && drawRect) {
      if (drawRect.w > 0.01 && drawRect.h > 0.01) {
        const newZone: Zone = {
          id: makeId(),
          locked: false,
          bayNumber: `Bay ${zones.length + 1}`,
          label: `Bay ${zones.length + 1}`,
          workcell: '',
          status: '',
          description: '',
          color: ZONE_COLORS[zones.length % ZONE_COLORS.length],
          ...drawRect,
        };
        setZones(prev => [...prev, newZone]);
        setSelectedId(newZone.id);
        setBottomOpen(true);
      }
      setDrawing(false);
      setDrawStart(null);
      setDrawRect(null);
    }
    setDragging(false);
    setDragOffset(null);
    setResizing(null);
    setResizeOrigin(null);
    setPanning(false);
    setPanStart(null);
  }, [tool, drawing, drawRect, zones.length]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, corner: string, zone: Zone) => {
    e.stopPropagation();
    setResizing(corner);
    setResizeOrigin({ zone: { ...zone } });
    setDragging(false);
  }, []);

  // ── Cursor style ──────────────────────────────────────────────────────────

  const canvasCursor = (() => {
    if (tool === 'draw') return 'crosshair';
    if (panning) return 'grabbing';
    return 'grab';
  })();

  // ── Zone operations ───────────────────────────────────────────────────────

  const updateZone = (id: string, patch: Partial<Zone>) =>
    setZones(prev => prev.map(z => z.id === id ? { ...z, ...patch } : z));

  const deleteZone = (id: string) => {
    setZones(prev => prev.filter(z => z.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const sessionKey = (name: string) => `fsms-zones-${name.replace(/\.[^.]+$/, '')}`;

  const FSMS_API = '/api/fsms';

  const handleSave = async () => {
    // 1. Write to sessionStorage immediately (instant)
    const key = sessionKey(layoutName);
    const payload = { zones, savedAt: new Date().toISOString() };
    sessionStorage.setItem(key, JSON.stringify(payload));
    setSavedZones([...zones]);
    setSavedAt(payload.savedAt);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);

    // 2. Persist to SQLite async (fire and forget)
    try {
      await fetch(`${FSMS_API}/layouts/${encodeURIComponent(layoutName)}/zones`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: imageSrc,
          zones: zones.map(z => ({
            ...z,
            bay_number: z.bayNumber,
          })),
        }),
      });
    } catch {
      // SQLite unavailable — sessionStorage save still succeeded
      console.warn('FSMS API unavailable — saved to session only');
    }
  };

  const restoreFromSession = (name: string): Zone[] | null => {
    const key = sessionKey(name);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return data.zones ?? null;
    } catch { return null; }
  };

  const restoreFromApi = async (name: string): Promise<Zone[] | null> => {
    try {
      const res = await fetch(`${FSMS_API}/layouts/${encodeURIComponent(name)}/zones`);
      if (!res.ok) return null;
      const data = await res.json();
      // Map bay_number back to bayNumber for frontend
      return (data.zones ?? []).map((z: any) => ({ ...z, bayNumber: z.bay_number ?? z.bayNumber ?? '' }));
    } catch { return null; }
  };

  // ── Image loading ─────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '');
    setImageSrc(URL.createObjectURL(file));
    setLayoutName(name);
    setShowImagePicker(false);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    // sessionStorage first, then SQLite
    const fromSession = restoreFromSession(name);
    const initial = fromSession ?? await restoreFromApi(name) ?? [];
    setZones(initial);
    setSavedZones(initial);
  };

  const handlePickExisting = async (name: string) => {
    const cleanName = name.replace('.png', '').replace('.pdf', '');
    setImageSrc(`/layouts/${encodeURIComponent(name)}`);
    setLayoutName(cleanName);
    setShowImagePicker(false);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    // sessionStorage first, then SQLite
    const fromSession = restoreFromSession(cleanName);
    const initial = fromSession ?? await restoreFromApi(cleanName) ?? [];
    setZones(initial);
    setSavedZones(initial);
  };

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setImageSrc(URL.createObjectURL(file));
    setLayoutName(file.name.replace(/\.[^.]+$/, ''));
    setShowImagePicker(false);
    setZones([]);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  // ── Export / Import ───────────────────────────────────────────────────────

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ layoutName, imageSrc, zones }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${layoutName.replace(/\s+/g, '_')}.layout.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.zones) setZones(data.zones);
        if (data.imageSrc) setImageSrc(data.imageSrc);
        if (data.layoutName) setLayoutName(data.layoutName);
        setPan({ x: 0, y: 0 });
        setZoom(1);
      } catch { /* invalid json */ }
    };
    reader.readAsText(file);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) deleteZone(selectedId);
      }
      if (e.key === 'd') setTool('draw');
      if (e.key === 's' || e.key === 'Escape') setTool('select');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-background select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0 gap-3">
        {/* Layout picker dropdown + Add Layout button */}
        <div className="flex items-center gap-2">
          <select
            value={imageSrc ?? ''}
            onChange={e => {
              const name = EXISTING_IMAGES.find(n => `/layouts/${encodeURIComponent(n)}` === e.target.value);
              if (name) handlePickExisting(name);
            }}
            className="text-sm font-semibold bg-transparent border border-border rounded-lg px-2 py-1 text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="" disabled>Select layout...</option>
            {EXISTING_IMAGES.map(name => (
              <option key={name} value={`/layouts/${encodeURIComponent(name)}`}>
                {name.replace('.png', '').replace('.pdf', '')}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowImagePicker(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
          >
            <ImagePlus className="h-3.5 w-3.5" /> Add Layout
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Upload className="h-3.5 w-3.5" /> Import JSON
          </button>
          <button onClick={handleExport} disabled={zones.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40">
            <Download className="h-3.5 w-3.5" /> Export JSON
          </button>
          {/* Save Edit button */}
          <div className="relative">
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || !imageSrc}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                hasUnsavedChanges && imageSrc
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                  : 'bg-muted text-muted-foreground opacity-40 cursor-not-allowed'
              )}
            >
              {showSaved ? '✓ Saved' : 'Save Edit'}
            </button>
            {hasUnsavedChanges && imageSrc && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </div>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* ── Main: toolbar + viewport ── */}
      <div className="flex-1 min-h-0 overflow-hidden relative">

        {/* ── Left toolbar — floating over canvas ── */}
        <div className="absolute left-3 top-3 z-10 flex flex-col items-center gap-1 py-2 px-1.5 bg-card/90 backdrop-blur-sm rounded-xl border border-border shadow-md">
          <ToolBtn icon={MousePointer2} label="Select / Pan (S)" active={tool === 'select'} onClick={() => setTool('select')} />
          <ToolBtn icon={Pencil} label="Draw zone (D)" active={tool === 'draw'} onClick={() => setTool('draw')} />
          <div className="w-6 h-px bg-border my-1" />
          <ToolBtn icon={Trash2} label="Delete selected" onClick={() => { if (selectedId) deleteZone(selectedId); }} disabled={!selectedId} danger />
          <div className="w-6 h-px bg-border my-1" />
          <ToolBtn icon={ImagePlus} label="Change image" onClick={() => setShowImagePicker(true)} />
        </div>

        {/* ── Viewport ── */}
        <div
          ref={viewportRef}
          className="w-full h-full overflow-hidden bg-muted/30 flex items-center justify-center"
          onWheel={handleWheel}
        >
          {!imageSrc ? (
            <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <ImagePlus className="h-8 w-8 opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No floor plan loaded</p>
                <p className="text-xs mt-1">Load an image to start drawing zones</p>
              </div>
              <button onClick={() => setShowImagePicker(true)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                Load Floor Plan
              </button>
            </div>
          ) : (
            /* Canvas — transformed for zoom + pan */
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: panning || dragging || resizing ? 'none' : 'transform 0.05s ease-out',
              }}
            >
              <div
                ref={canvasRef}
                className="relative shadow-xl rounded-lg overflow-hidden"
                style={{ width: BASE_W, height: BASE_H, cursor: canvasCursor }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              >
                {/* Background image */}
                <img
                  src={imageSrc}
                  alt="Floor plan"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />

                {/* SVG overlay */}
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                  {zones.map(zone => {
                    const isSelected = zone.id === selectedId;
                    const px = zone.x * 100;
                    const py = zone.y * 100;
                    const pw = zone.w * 100;
                    const ph = zone.h * 100;
                    const cx = (zone.x + zone.w / 2) * 100;
                    const cy = (zone.y + zone.h / 2) * 100;
                    return (
                      <g key={zone.id}>
                        <rect
                          x={`${px}%`} y={`${py}%`}
                          width={`${pw}%`} height={`${ph}%`}
                          fill={zone.color} fillOpacity={isSelected ? 0.35 : 0.2}
                          stroke={zone.color} strokeWidth={isSelected ? 2 : 1.5}
                          strokeDasharray={isSelected ? 'none' : '4 2'}
                          rx={3}
                          style={{ pointerEvents: 'all', cursor: tool === 'select' ? 'move' : 'default' }}
                          onMouseDown={e => {
                            if (tool !== 'select') return;
                            e.stopPropagation();
                            const rel = toRel(e.clientX, e.clientY);
                            setSelectedId(zone.id);
                            setDragging(true);
                            setDragOffset({ x: rel.x - zone.x, y: rel.y - zone.y });
                          }}
                        />
                        <text
                          x={`${cx}%`} y={`${cy}%`}
                          textAnchor="middle" dominantBaseline="middle"
                          fill={zone.color}
                          fontSize={Math.max(10, Math.min(14, zone.w * BASE_W * 0.12))}
                          fontWeight={600}
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {zone.label}
                        </text>
                        {/* Resize handles */}
                        {isSelected && [
                          { corner: 'nw', cx: px, cy: py },
                          { corner: 'ne', cx: px + pw, cy: py },
                          { corner: 'sw', cx: px, cy: py + ph },
                          { corner: 'se', cx: px + pw, cy: py + ph },
                        ].map(({ corner, cx, cy }) => (
                          <rect
                            key={corner}
                            x={`calc(${cx}% - 5px)`} y={`calc(${cy}% - 5px)`}
                            width={10} height={10}
                            fill="white" stroke={zone.color} strokeWidth={2} rx={2}
                            style={{
                              pointerEvents: 'all',
                              cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                            }}
                            onMouseDown={e => { e.stopPropagation(); handleResizeMouseDown(e as any, corner, zone); }}
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Live draw preview */}
                  {drawing && drawRect && drawRect.w > 0 && drawRect.h > 0 && (
                    <rect
                      x={`${drawRect.x * 100}%`} y={`${drawRect.y * 100}%`}
                      width={`${drawRect.w * 100}%`} height={`${drawRect.h * 100}%`}
                      fill={ZONE_COLORS[zones.length % ZONE_COLORS.length]} fillOpacity={0.2}
                      stroke={ZONE_COLORS[zones.length % ZONE_COLORS.length]}
                      strokeWidth={2} strokeDasharray="6 3" rx={3}
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom zones panel — floats over canvas ── */}
        <div className={cn('absolute bottom-0 left-0 right-0 z-10 border-t border-border bg-card/95 backdrop-blur-sm transition-all duration-200', bottomOpen ? 'h-64' : 'h-9')}>
          <div
            className="flex items-center justify-between px-4 h-9 cursor-pointer hover:bg-muted/40 transition-colors"
            onClick={() => setBottomOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', bottomOpen && 'rotate-180')} />
              <span className="text-xs font-semibold text-foreground">Zones</span>
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-mono">{zones.length}</span>
            </div>

          </div>
          {bottomOpen && (
            <div className="flex gap-2 px-4 pb-3 pt-1 overflow-x-auto h-[calc(100%-2.25rem)]">
              {zones.length === 0 ? (
                <div className="flex items-center justify-center w-full text-xs text-muted-foreground">
                  No zones yet — press <kbd className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">D</kbd> and drag on the canvas
                </div>
              ) : zones.map(zone => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  selected={zone.id === selectedId}
                  onClick={() => setSelectedId(zone.id)}
                  onUpdate={patch => updateZone(zone.id, patch)}
                  onDelete={() => deleteZone(zone.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Image picker modal ── */}
      {showImagePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-96 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Load Floor Plan</h2>
              <button onClick={() => setShowImagePicker(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Upload new image</p>
                <div
                  ref={dropRef}
                  onDragOver={e => { e.preventDefault(); setIsDraggingFile(true); }}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-6 cursor-pointer transition-colors',
                    isDraggingFile
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                  )}
                >
                  <Upload className="h-6 w-6" />
                  <div className="text-center">
                    <p className="text-sm font-medium">Drag & drop or click to upload</p>
                    <p className="text-xs mt-0.5 opacity-70">PNG, JPG, SVG supported</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileUpload} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Or pick existing layout</p>
                <div className="space-y-1">
                  {EXISTING_IMAGES.map(name => (
                    <button key={name} onClick={() => handlePickExisting(name)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm text-foreground hover:bg-accent transition-colors">
                      {name.replace('.png', '').replace('.pdf', '')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Workcell Combobox ───────────────────────────────────────────────────────

function WorkcellCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = WORKCELL_OPTIONS.filter(o =>
    o.toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full text-xs bg-muted/50 border border-border rounded-md px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
        placeholder="Type or select..."
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-y-auto max-h-40">
          {filtered.map(opt => (
            <button
              key={opt}
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
              className={cn(
                'w-full text-left px-2.5 py-1.5 text-xs transition-colors hover:bg-accent',
                value === opt ? 'text-primary font-medium' : 'text-foreground'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const STATUS_OPTIONS = ['Active', 'Reserved', 'Idle', 'Under Maintenance'];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = STATUS_OPTIONS.filter(o =>
    o.toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full text-xs bg-muted/50 border border-border rounded-md px-2 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
        placeholder="Type or select..."
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-y-auto max-h-40">
          {filtered.map(opt => (
            <button
              key={opt}
              onMouseDown={e => { e.preventDefault(); onChange(opt); setOpen(false); }}
              className={cn(
                'w-full text-left px-2.5 py-1.5 text-xs transition-colors hover:bg-accent',
                value === opt ? 'text-primary font-medium' : 'text-foreground'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tool button ───────────────────────────────────────────────────────

function ToolBtn({ icon: Icon, label, active, onClick, disabled, danger }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; active?: boolean; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <div className="relative group">
      <button onClick={onClick} disabled={disabled}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
          active && 'bg-primary text-primary-foreground',
          !active && !danger && 'text-sidebar-foreground hover:bg-sidebar-accent',
          !active && danger && 'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
          disabled && 'opacity-30 pointer-events-none',
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-popover border border-border rounded-md text-xs text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-md">
        {label}
      </div>
    </div>
  );
}

// ─── Zone card ────────────────────────────────────────────────────────────────

function ZoneCard({ zone, selected, onClick, onUpdate, onDelete }: {
  zone: Zone; selected: boolean;
  onClick: () => void; onUpdate: (p: Partial<Zone>) => void; onDelete: () => void;
}) {
  return (
    <div onClick={onClick}
      className={cn(
        'flex-shrink-0 w-64 rounded-xl border p-3 cursor-pointer transition-all space-y-2.5',
        selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:bg-accent/40',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: zone.color }} />
          <input
            value={zone.bayNumber}
            onClick={e => e.stopPropagation()}
            onChange={e => onUpdate({ bayNumber: e.target.value, label: e.target.value })}
            className="text-sm font-semibold bg-transparent border-none outline-none text-foreground min-w-0 flex-1 focus:ring-1 focus:ring-ring rounded px-0.5"
            placeholder="Bay 1"
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Lock toggle — always clickable */}
          <button
            onClick={e => { e.stopPropagation(); onUpdate({ locked: !zone.locked }); }}
            className={cn('p-1 rounded-md transition-colors', zone.locked ? 'text-amber-400 hover:text-amber-500' : 'text-muted-foreground hover:text-foreground')}
            title={zone.locked ? 'Unlock zone' : 'Lock zone'}
          >
            {zone.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          </button>
          {/* Gear — disabled when locked */}
          <button
            onClick={e => e.stopPropagation()}
            disabled={zone.locked}
            className={cn('p-1 rounded-md transition-colors text-muted-foreground hover:text-foreground', zone.locked && 'opacity-30 pointer-events-none')}
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          {/* Delete — disabled when locked */}
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            disabled={zone.locked}
            className={cn('p-1 rounded-md transition-colors text-muted-foreground hover:text-destructive', zone.locked && 'opacity-30 pointer-events-none')}
            title="Delete zone"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Workcell</p>
          <WorkcellCombobox
            value={zone.workcell}
            onChange={v => onUpdate({ workcell: v })}
          />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
          <StatusCombobox
            value={zone.status}
            onChange={v => onUpdate({ status: v })}
          />
        </div>
      </div>
      <input
        value={zone.description}
        onClick={e => e.stopPropagation()}
        onChange={e => onUpdate({ description: e.target.value })}
        className="w-full text-xs bg-muted/50 border border-border rounded-md px-2 py-1.5 text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        placeholder="Description (optional)"
      />
      <div className="flex gap-1.5 flex-nowrap overflow-x-auto pb-1 pt-2">
        {ZONE_COLORS.map(c => (
          <button key={c} onClick={e => { e.stopPropagation(); onUpdate({ color: c }); }}
            className={cn('w-4 h-4 rounded-sm transition-transform hover:scale-110', zone.color === c && 'ring-2 ring-offset-1 ring-foreground')}
            style={{ background: c }} />
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground font-mono">
        {(zone.x * 100).toFixed(1)}% {(zone.y * 100).toFixed(1)}% · {(zone.w * 100).toFixed(1)}×{(zone.h * 100).toFixed(1)}%
      </p>
    </div>
  );
}
