import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MarkerPopup
} from '@/components/ui/map';
import { useOleWeekly, useOleWorkcells } from '@/hooks/ole/useOleData';
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
    lat: 5.3220088,
    lng: 100.2964318,
    color: '#7c3aed',
  },
  {
    id: 'bk',
    label: 'Batu Kawan',
    category: 'Manufacturing · Batu Kawan',
    address: 'PMT 772, Persiaran Cassia Selatan 7, Taman Perindustrian Batu Kawan, 14110 Simpang Ampat, Pulau Pinang',
    image: 'https://images.unsplash.com/photo-1610891015188-5369212db097?w=300&h=160&fit=crop',
    mapsUrl: 'https://www.google.com/maps/place/Jabil+Circuit+Batu+Kawan/data=!4m2!3m1!1s0x0:0xb492d7092c79b0c8?sa=X&ved=1t:2428&ictx=111',
    lat: 5.216708956942397,
    lng: 100.43506795544029,
    color: '#21b735ff',
  },
] as const;

const PENANG_CENTER: [number, number] = [100.353138, 5.279591];
const DEFAULT_ZOOM = 11.13;

export default function MapPage() {
  const navigate = useNavigate();
  const weeklyHook = useOleWeekly();
  const workcellsHook = useOleWorkcells();
  const rawWeekly = weeklyHook.data ?? [];
  const workcellConfigs = workcellsHook.data ?? [];
  const loading = weeklyHook.loading && rawWeekly.length === 0;

  // Derive latest week directly from data -- same source as report page
  const latestIsoWeek = useMemo(() => {
    if (!rawWeekly.length) return null;
    return Math.max(...rawWeekly.map(r => r.iso_week));
  }, [rawWeekly]);

  const wwLabel = latestIsoWeek ? `WW${String(latestIsoWeek).padStart(2, '0')}` : '...';

  // Site OLE for latest week
  const siteOle = useMemo(() => {
    if (!latestIsoWeek) return null;
    const rows = rawWeekly.filter(r => r.iso_week === latestIsoWeek);
    const smh = rows.reduce((s, r) => s + r.total_output_smh, 0);
    const hrs = rows.reduce((s, r) => s + r.total_input_hours, 0);
    return hrs > 0 ? parseFloat(((smh / hrs) * 100).toFixed(1)) : null;
  }, [rawWeekly, latestIsoWeek]);

  // Per-plant OLE for latest week
  const plantKPIs = useMemo(() => {
    return PLANTS.map(plant => {
      const rows = rawWeekly.filter(r => {
        if (!latestIsoWeek) return false;
        const wcPlant = workcellConfigs.find(w => w.workcell === r.workcell)?.plant;
        return wcPlant === plant.label && r.iso_week === latestIsoWeek;
      });
      const smh = rows.reduce((s, r) => s + r.total_output_smh, 0);
      const hrs = rows.reduce((s, r) => s + r.total_input_hours, 0);
      const ole_pct = hrs > 0 ? parseFloat(((smh / hrs) * 100).toFixed(1)) : null;
      return { ...plant, ole_pct, ww: wwLabel };
    });
  }, [rawWeekly, workcellConfigs, latestIsoWeek, wwLabel]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">

      {/* Force map popups above all overlay cards */}
      <style>{`.mapboxgl-popup, .maplibregl-popup { z-index: 9999 !important; }`}</style>

      {/* All Plants card -- top left */}
      <div className="absolute top-4 left-4 z-10">
        <div
          onClick={() => navigate(latestIsoWeek ? `/report?week=${latestIsoWeek}` : '/report')}
          className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-5 py-3.5 shadow-lg min-w-[220px] cursor-pointer hover:bg-card transition-colors overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
            style={{ background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 50%, #21b735 100%)' }} />
          <p className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">All Plants</p>
          <p className="text-[34px] font-mono font-bold leading-none mt-1 text-foreground">
            {loading ? '...' : siteOle !== null ? `${siteOle}%` : 'N/A'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            OLE · {wwLabel}
          </p>
          {/* <div className="flex gap-3 mt-2.5 pt-2 border-t border-border">
            {plantKPIs.map(p => (
              <div key={p.id} className="flex flex-col items-start">
                <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: p.color }}>
                  {p.label.replace('Plant ', 'P')}
                </span>
                <span className="text-[11px] font-mono font-bold" style={{ color: p.ole_pct !== null ? p.color : undefined }}>
                  {loading ? '...' : p.ole_pct !== null ? `${p.ole_pct}%` : 'N/A'}
                </span>
              </div>
            ))}
          </div> */}
        </div>
      </div>

      {/* Per-plant cards -- bottom bar, left to right */}
      <div className="absolute bottom-6 left-4 z-10 flex gap-3">
        {plantKPIs.map(plant => (
          <div
            key={plant.id}
            onClick={() => {
              if (plant.id !== 'bk') {
                navigate(`/report?plant=${encodeURIComponent(plant.label)}${latestIsoWeek ? `&week=${latestIsoWeek}` : ''}`);
              }
            }}
            className="bg-card/90 backdrop-blur-sm border border-border rounded-xl px-5 py-3.5 shadow-lg min-w-[160px] cursor-pointer hover:bg-card transition-colors"
            style={{ borderLeft: `4px solid ${plant.color}` }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: plant.color }}>
              {plant.label}
            </p>
            <p className="text-2xl font-mono font-bold mt-0.5" style={{ color: plant.ole_pct !== null ? plant.color : undefined }}>
              {loading ? '...' : plant.ole_pct !== null ? `${plant.ole_pct}%` : 'N/A'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">OLE · {plant.ww}</p>
          </div>
        ))}
      </div>

      {/* Full-screen map — fully locked: no pan, no zoom, no rotate, no pitch */}
      <Map
        center={PENANG_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        dragPan={false}
        dragRotate={false}
        scrollZoom={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        touchPitch={false}
        keyboard={false}
        boxZoom={false}
      >

        {plantKPIs.map(plant => (
          <MapMarker
            key={plant.id}
            longitude={plant.lng}
            latitude={plant.lat}
          >
            <MarkerContent>
              <div className="flex flex-col items-center">
                <div
                  className="size-8 cursor-pointer rounded-full border-[3px] border-white shadow-xl transition-transform hover:scale-110"
                  style={{ background: plant.color }}
                />
                <MarkerLabel>
                  <div className="-mt-5">
                    <span
                      className="text-xl font-bold tracking-tight leading-none block"
                      style={{ color: plant.color }}
                    >
                      {plant.label.toUpperCase()}
                    </span>
                  </div>
                </MarkerLabel>
              </div>
            </MarkerContent>

            <MarkerPopup className="w-64 p-0 overflow-hidden rounded-xl shadow-2xl border-0">
              <div className="relative h-32 overflow-hidden rounded-t-md bg-muted">
                <img src={plant.image} alt={plant.label} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2 p-3">
                <div>
                  <p className="text-muted-foreground pb-0.5 text-[10px] font-semibold tracking-widest uppercase">
                    {plant.category}
                  </p>
                  <h3 className="text-foreground font-bold text-sm leading-tight">
                    Jabil Circuit -- {plant.label}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{ background: `${plant.color}22`, color: plant.color }}
                  >
                    OLE {plant.ole_pct !== null ? `${plant.ole_pct}%` : '--'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{plant.ww}</span>
                </div>
                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3 mt-0.5 shrink-0" />
                  <span className="leading-snug">{plant.address}</span>
                </div>
                {plant.id !== 'bk' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => navigate(`/report?plant=${encodeURIComponent(plant.label)}${latestIsoWeek ? `&week=${latestIsoWeek}` : ''}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ background: plant.color }}
                    >
                      View OLE Report
                    </button>
                    <button
                      onClick={() => window.open(plant.mapsUrl, '_blank')}
                      className="flex items-center justify-center w-8 h-8 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>

    </div>
  );
}
