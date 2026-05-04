import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MarkerPopup
} from '@/components/ui/map';
import { useOleWeekly, useOleWorkcells } from '@/hooks/useOleData';
import { ExternalLink, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const PLANTS = [
  {
    id: 'p1',
    label: 'Plant 1',
    category: 'Manufacturing · Plant 1',
    address: 'Phase 4, 56, Hilir Sungai Kluang 1, Bayan Lepas Industrial Park, 11900 Bayan Lepas',
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&h=160&fit=crop',
    mapsUrl: 'https://www.google.com/maps/place/Jabil+Penang+(Plant+1)/data=!4m2!3m1!1s0x0:0x2206c37d3dac233e?sa=X&ved=1t:2428&ictx=111',
    lat: 5.3033351,
    lng: 100.2908957,
    color: '#2563eb',
  },
  {
    id: 'p2',
    label: 'Plant 2',
    category: 'Manufacturing · Plant 2',
    address: 'Plot 1242, Lebuh Kampung Jawa, Bayan Lepas Free Industrial Zone Phase 3, 11900 Bayan Lepas',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=160&fit=crop',
    mapsUrl: 'https://www.google.com/maps/place/Jabil+Penang+(Plant+2)/data=!4m2!3m1!1s0x0:0x52f61908b9e58a68?sa=X&ved=1t:2428&ictx=111',
    lat: 5.3195088,
    lng: 100.2964318,
    color: '#7c3aed',
  },
  {
    id: 'bk',
    label: 'Batu Kawan',
    category: 'Manufacturing · Batu Kawan',
    address: 'PMT 772, Persiaran Cassia Selatan 7, Taman Perindustrian Batu Kawan, 14110 Simpang Ampat, Pulau Pinang',
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&h=160&fit=crop',
    mapsUrl: 'https://www.google.com/maps/place/Jabil+Circuit+Batu+Kawan/data=!4m2!3m1!1s0x0:0xb492d7092c79b0c8?sa=X&ved=1t:2428&ictx=111',
    lat: 5.216708956942397,
    lng: 100.43506795544029,
    color: '#21b735ff',
  },
] as const;

// Center of Bayan Lepas — both plants visible at zoom 14
const PENANG_CENTER: [number, number] = [100.380433, 5.272718];
const DEFAULT_ZOOM = 11.72;

export default function MapPage() {
  const navigate = useNavigate();
  const weeklyHook = useOleWeekly();
  const workcellsHook = useOleWorkcells();
  const rawWeekly = weeklyHook.data ?? [];
  const workcellConfigs = workcellsHook.data ?? [];

  // Current ISO week number
  const currentIsoWeek = useMemo(() => {
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const start = new Date(jan4);
    start.setDate(jan4.getDate() - jan4.getDay() + 1);
    return Math.floor((now.getTime() - start.getTime()) / (7 * 86400000)) + 1;
  }, []);

  // Per-plant OLE for current week — same formula as Home4
  const plantKPIs = useMemo(() => {
    return PLANTS.map(plant => {
      const rows = rawWeekly.filter(r => {
        const wcPlant = workcellConfigs.find(w => w.workcell === r.workcell)?.plant;
        return wcPlant === plant.label && r.iso_week === currentIsoWeek;
      });
      const smh = rows.reduce((s, r) => s + r.total_output_smh, 0);
      const hrs = rows.reduce((s, r) => s + r.total_input_hours, 0);
      const ole_pct = hrs > 0 ? parseFloat(((smh / hrs) * 100).toFixed(1)) : null;
      const ww = rows.length ? `WW${String(rows[0].iso_week).padStart(2, '0')}` : `WW${String(currentIsoWeek).padStart(2, '0')}`;
      return { ...plant, ole_pct, ww };
    });
  }, [rawWeekly, workcellConfigs, currentIsoWeek]);

  const loading = weeklyHook.loading && rawWeekly.length === 0;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">

      {/* KPI Cards — top left */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {plantKPIs.map(plant => (
          <div
            key={plant.id}
            onClick={() => navigate(`/ole/home4?plant=${encodeURIComponent(plant.label)}&week=${currentIsoWeek}`)}
            className="bg-card/90 backdrop-blur-sm border border-border rounded-xl px-5 py-4 shadow-lg min-w-[190px] cursor-pointer hover:bg-card transition-colors"
            style={{ borderLeft: `4px solid ${plant.color}` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: plant.color }}>{plant.label}</p>
            <p className="text-3xl font-mono font-bold mt-1" style={{ color: plant.ole_pct !== null ? plant.color : undefined }}>
              {loading ? '…' : plant.ole_pct !== null ? `${plant.ole_pct}%` : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              OLE this week · <span className="font-semibold text-foreground">{plant.ww}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Full-screen map */}
      <Map
        center={PENANG_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        onViewportChange={(vp) => console.log(`lng: ${vp.center[0].toFixed(6)}, lat: ${vp.center[1].toFixed(6)}, zoom: ${vp.zoom.toFixed(2)}`)}

        dragRotate={false}
        dragPan={false}
        touchPitch={false}
        touchZoomRotate={false}
      // touchZoom={false}
      // touchRotate={false}
      // touchDragPan={false}
      // dragZoom={false}
      >
        <MapControls
          position="top-right"
          showCompass
          showFullscreen
        // showZoom
        // showLocate
        />

        {plantKPIs.map(plant => (
          <MapMarker
            key={plant.id}
            longitude={plant.lng}
            latitude={plant.lat}
          >
            {/* Simple circle marker — scaled up */}
            <MarkerContent>
              <div
                className="size-8 cursor-pointer rounded-full border-[3px] border-white shadow-xl transition-transform hover:scale-110"
                style={{ background: plant.color }}
              />
              <MarkerLabel position="bottom">
                <span className="text-xl font-bold tracking-wide" style={{ color: plant.color }}>
                  {plant.label}
                </span>
              </MarkerLabel>
            </MarkerContent>

            {/* Rich popup — no white wrapper */}
            <MarkerPopup className="w-64 p-0 overflow-hidden rounded-xl shadow-2xl border-0">
              {/* Header image */}
              <div className="relative h-32 overflow-hidden rounded-t-md bg-muted">
                <img
                  src={plant.image}
                  alt={plant.label}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Body */}
              <div className="space-y-2 p-3">
                <div>
                  <p className="text-muted-foreground pb-0.5 text-[10px] font-semibold tracking-widest uppercase">
                    {plant.category}
                  </p>
                  <h3 className="text-foreground font-bold text-sm leading-tight">
                    Jabil Circuit — {plant.label}
                  </h3>
                </div>

                {/* OLE badge */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{ background: `${plant.color}22`, color: plant.color }}
                  >
                    OLE {plant.ole_pct !== null ? `${plant.ole_pct}%` : '—'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{plant.ww}</span>
                </div>

                {/* Address */}
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3 mt-0.5 shrink-0" />
                  <span className="leading-snug">{plant.address}</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => navigate(`/ole/home4?plant=${encodeURIComponent(plant.label)}&week=${currentIsoWeek}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: plant.color }}
                  >
                    View OLE Dashboard
                  </button>
                  <button
                    onClick={() => window.open(plant.mapsUrl, '_blank')}
                    className="flex items-center justify-center w-8 h-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>

    </div>
  );
}
