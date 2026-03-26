import { Factory, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from 'react-simple-maps';

// world-atlas countries-50m.json copied to /public by setup-map.js
// Malaysia id in world-atlas numeric ISO: "458"
const GEO_URL = '/world-countries.json';

// ─── Plants ───────────────────────────────────────────────────────────────────
// Coordinates: [longitude, latitude] (GeoJSON convention)
// labelOffset: [dx, dy] in SVG units — how far the label pill is displaced
// from the pin centre. A diagonal line bridges the gap.
// Plant 1 & 2 are <2 km apart so they branch left/right to avoid overlap.
const PLANTS = [
  {
    id: 'plant-1',
    name: 'Plant 1',
    coordinates: [100.29174229999985, 5.303891949783533] as [number, number],
    labelOffset: [-110, -55] as [number, number], // branch left
    workcellId: 'arista',
    status: 'operational' as const,
    bays: 4,
    productivity: 87,
  },
  {
    id: 'plant-2',
    name: 'Plant 2',
    coordinates: [100.29589037997687, 5.320837923159554] as [number, number],
    labelOffset: [110, -55] as [number, number],  // branch right
    workcellId: 'keysight',
    status: 'warning' as const,
    bays: 6,
    productivity: 63,
  },
  {
    id: 'batu-kawan',
    name: 'Batu Kawan',
    coordinates: [100.43451413785162, 5.218109834099721] as [number, number],
    labelOffset: [110, -45] as [number, number],  // branch right
    workcellId: 'micron',
    status: 'operational' as const,
    bays: 8,
    productivity: 71,
  },
  {
    id: 'plant-chupping',
    name: 'Chuping',
    coordinates: [100.28478092859105, 6.604283113109734] as [number, number],
    labelOffset: [110, -45] as [number, number],  // branch right
    workcellId: 'chupping',
    status: 'operational' as const,
    bays: 5,
    productivity: 79,
  },
  // {
  //   id: 'sg-petani',
  //   name: 'Sungai Petani',
  //   coordinates: [100.52981885077669, 5.649917684030438] as [number, number],
  //   labelOffset: [110, -45] as [number, number],  // branch right
  //   workcellId: 'sg-petani',
  //   status: 'operational' as const,
  //   bays: 3,
  //   productivity: 74,
  // },
  // {
  //   id: 'bukit-minyak',
  //   name: 'Bukit Minyak',
  //   coordinates: [100.45258733512905, 5.3149891456231115] as [number, number],
  //   labelOffset: [-110, -45] as [number, number], // branch left
  //   workcellId: 'bukit-minyak',
  //   status: 'operational' as const,
  //   bays: 4,
  //   productivity: 81,
  // },
];

const STATUS_COLOR = {
  operational: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
} as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function Plants() {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(1);
  const [hoveredPlant, setHoveredPlant] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    plant: (typeof PLANTS)[0];
    x: number;
    y: number;
  } | null>(null);

  const handlePlantClick = () => navigate('/workcells');
  const zoomIn = () => setZoom((z) => Math.min(z * 1.5, 12));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.5, 1));
  const reset = () => setZoom(1);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <Factory className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Plants</h1>
            <p className="text-xs text-muted-foreground">
              Map view of plants — Click a plant marker to view workcell
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-xs text-muted-foreground">
          {(['operational', 'warning', 'critical'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 capitalize">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: STATUS_COLOR[s] }}
              />
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Map ── */}
        <div className="relative flex-1 overflow-hidden bg-[hsl(var(--muted)/0.2)]">

          {/* Zoom controls */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5">
            {[
              { Icon: ZoomIn, fn: zoomIn, title: 'Zoom in' },
              { Icon: ZoomOut, fn: zoomOut, title: 'Zoom out' },
              { Icon: RotateCcw, fn: reset, title: 'Reset' },
            ].map(({ Icon, fn, title }) => (
              <button
                key={title}
                onClick={fn}
                title={title}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-accent transition-colors"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{ left: tooltip.x + 14, top: tooltip.y - 12 }}
            >
              <div className="bg-card border border-border rounded-xl shadow-xl px-4 py-3 min-w-[170px]">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: STATUS_COLOR[tooltip.plant.status] }}
                  />
                  <span className="font-semibold text-sm text-foreground">
                    {tooltip.plant.name}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <TRow label="Bays" value={String(tooltip.plant.bays)} />
                  <TRow label="Productivity" value={`${tooltip.plant.productivity}%`} />
                  <TRow
                    label="Status"
                    value={tooltip.plant.status}
                    color={STATUS_COLOR[tooltip.plant.status]}
                  />
                </div>
                <p className="mt-2 pt-2 border-t border-border text-[10px] text-muted-foreground">
                  Click to view workcell →
                </p>
              </div>
            </div>
          )}

          {/*
            ── KEY PROJECTION SETTINGS (from react-simple-maps docs) ──
            
            projection: "geoMercator"

            projectionConfig.rotate shifts the globe so the target region
            lands at the SVG centre. Formula: [-lon_center, -lat_center, 0]

            Visible lat range: 4.9 → 6.9 (Batu Kawan with padding → Perlis+)
            Centre: lon 100.50, lat 5.90
            scale: 8500 — tight enough to read labels, loose enough to see
            the full corridor from Perlis down to just below Batu Kawan.
          */}
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              rotate: [-100.50, -5.93, 0],
              scale: 20000,
            }}
            style={{ width: '100%', height: '100%', backgroundColor: '#b5eef5' }}
          >
            {/* <ZoomableGroup zoom={zoom} minZoom={1} maxZoom={12}> */}

            {/* Malaysia outline from world topojson */}
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies
                  // world-atlas uses numeric ISO 3166-1 codes (string)
                  // Malaysia = 458, Singapore = 702, Thailand = 764, Indonesia = 360
                  // Show Malaysia + immediate neighbours for geographic context
                  .filter((geo) =>
                    ['458', '764', '702', '360'].includes(geo.id)
                  )
                  .map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      style={{
                        default: {
                          fill: geo.id === '458'
                            ? 'hsl(var(--accent))'
                            : 'hsl(var(--muted)/0.4)',
                          stroke: 'hsl(var(--border))',
                          strokeWidth: geo.id === '458' ? 0.6 : 0.3,
                          outline: 'none',
                        },
                        hover: {
                          fill: geo.id === '458'
                            ? 'hsl(var(--accent))'
                            : 'hsl(var(--muted)/0.4)',
                          stroke: 'hsl(var(--border))',
                          strokeWidth: 0.6,
                          outline: 'none',
                        },
                        pressed: { outline: 'none' },
                      }}
                    />
                  ))
              }
            </Geographies>

            {/* State/region labels — Perlis→Perak corridor */}
            {[
              { label: 'PERLIS', lon: 100.20, lat: 6.47 },
              { label: 'KEDAH', lon: 100.75, lat: 6.10 },
              { label: 'PENANG', lon: 100.48, lat: 5.38 },
              { label: 'PERAK', lon: 101.10, lat: 5.05 },
            ].map((l) => (
              <Marker key={l.label} coordinates={[l.lon, l.lat]}>
                <text
                  textAnchor="middle"
                  style={{
                    fontFamily: 'inherit',
                    fontSize: '9px',
                    fill: 'hsl(var(--muted-foreground))',
                    pointerEvents: 'none',
                    userSelect: 'none',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                  }}
                >
                  {l.label}
                </text>
              </Marker>
            ))}

            {/* ── Plant markers ── */}
            {PLANTS.map((plant) => {
              const isHovered = hoveredPlant === plant.id;
              const color = STATUS_COLOR[plant.status];

              return (
                <Marker
                  key={plant.id}
                  coordinates={plant.coordinates}
                  onClick={() => handlePlantClick()}
                  onMouseEnter={(e: React.MouseEvent) => {
                    setHoveredPlant(plant.id);
                    const svg = (e.currentTarget as Element).closest('svg');
                    const rect = svg?.getBoundingClientRect();
                    setTooltip({
                      plant,
                      x: e.clientX - (rect?.left ?? 0),
                      y: e.clientY - (rect?.top ?? 0),
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredPlant(null);
                    setTooltip(null);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Outer glow */}
                  <circle
                    r={isHovered ? 18 : 12}
                    fill={color}
                    fillOpacity={0.12}
                    style={{ transition: 'r 0.2s ease' }}
                  />
                  {/* Mid ring */}
                  <circle
                    r={isHovered ? 11 : 7.5}
                    fill={color}
                    fillOpacity={0.28}
                    style={{ transition: 'r 0.2s ease' }}
                  />
                  {/* Core dot */}
                  <circle
                    r={isHovered ? 6.5 : 4.5}
                    fill={color}
                    stroke="white"
                    strokeWidth={1.5}
                    style={{ transition: 'r 0.2s ease' }}
                  />

                  {/*
                      ── BRANCHING LABEL ────────────────────────────────────
                      plant.labelOffset = [dx, dy] moves the pill away from
                      the pin. A polyline connects pin-edge → elbow → pill.

                      To adjust a specific plant's branch direction/distance:
                        labelOffset: [dx, dy]
                          dx > 0  →  branch right
                          dx < 0  →  branch left
                          dy < 0  →  branch upward (almost always negative)

                      The elbow point sits at (dx * 0.5, dy) so the line
                      goes diagonally then turns horizontal into the pill.
                    */}
                  {(() => {
                    const [dx, dy] = plant.labelOffset;
                    const pinEdgeY = -(isHovered ? 6.5 : 4.5);
                    // elbow: go diagonally to (dx, dy*0.6) then straight up to pill
                    const ex = dx;
                    const ey = dy * 0.6;
                    // pill sized to fit 15px font comfortably
                    const pillW = 120;
                    const pillH = 28;
                    return (
                      <>
                        {/* Branch line: pin-edge → elbow → pill centre */}
                        <polyline
                          points={`0,${pinEdgeY} ${ex},${ey} ${dx},${dy}`}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeOpacity={0.65}
                          strokeLinejoin="round"
                          style={{ transition: 'all 0.2s ease' }}
                        />
                        {/* Pill */}
                        <g transform={`translate(${dx}, ${dy})`}>
                          <rect
                            x={-pillW / 2} y={-pillH / 2}
                            width={pillW} height={pillH}
                            rx={7}
                            fill={color}
                            fillOpacity={isHovered ? 1 : 0.9}
                          />
                          <text
                            textAnchor="middle"
                            y={6}
                            style={{
                              fontSize: '15px',
                              fontWeight: 700,
                              fill: 'white',
                              fontFamily: 'inherit',
                              pointerEvents: 'none',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {plant.name}
                          </text>
                        </g>
                      </>
                    );
                  })()}
                </Marker>
              );
            })}

            {/* </ZoomableGroup> */}
          </ComposableMap>
        </div>

        {/* ── Right panel ── */}
        <div className="w-56 border-l border-border bg-card flex flex-col gap-3 p-4 overflow-y-auto flex-shrink-0">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Plant Locations
          </p>
          {PLANTS.map((plant) => (
            <button
              key={plant.id}
              onClick={() => handlePlantClick()}
              onMouseEnter={() => setHoveredPlant(plant.id)}
              onMouseLeave={() => setHoveredPlant(null)}
              className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-background hover:bg-accent transition-colors text-left group w-full"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: STATUS_COLOR[plant.status] }}
                />
                <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                  {plant.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                <StatCell label="Bays" value={String(plant.bays)} />
                <StatCell label="Prod." value={`${plant.productivity}%`} />
              </div>
              <div
                className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-md w-fit"
                style={{
                  background: `${STATUS_COLOR[plant.status]}1a`,
                  color: STATUS_COLOR[plant.status],
                }}
              >
                {plant.status}
              </div>
              <div className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                View workcell →
              </div>
            </button>
          ))}

          <div className="mt-auto pt-4 border-t border-border">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Scroll to zoom · Drag to pan · Click a marker to open workcell.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function TRow({
  label, value, color,
}: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className="font-medium text-foreground capitalize"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}
