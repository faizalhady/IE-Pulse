import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerLabel,
  MarkerPopup
} from '@/components/ui/map';
import { ExternalLink, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Three Penang plants — same map view as the OLE map (Plant 1, Plant 2, Batu Kawan).
// bays: total + breakdown used for the popup occupancy summary.
const PLANTS = [
  {
    id: 'p1',
    label: 'Plant 1',
    plantCode: 'P1',
    category: 'Manufacturing · Plant 1',
    image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&h=160&fit=crop',
    lat: 5.3033351,
    lng: 100.2908957,
    color: '#2563eb',
    bays: { total: 24, occupied: 14, reserved: 4, available: 6 },
  },
  {
    id: 'p2',
    label: 'Plant 2',
    plantCode: 'P2',
    category: 'Manufacturing · Plant 2',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=160&fit=crop',
    lat: 5.3220088,
    lng: 100.2964318,
    color: '#7c3aed',
    bays: { total: 30, occupied: 22, reserved: 3, available: 5 },
  },
  {
    id: 'bk',
    label: 'Batu Kawan',
    plantCode: 'BK',
    category: 'Manufacturing · Batu Kawan',
    image: 'https://images.unsplash.com/photo-1610891015188-5369212db097?w=300&h=160&fit=crop',
    lat: 5.216708956942397,
    lng: 100.43506795544029,
    color: '#21b735ff',
    bays: { total: 40, occupied: 18, reserved: 6, available: 16 },
  },
] as const;

const PENANG_CENTER: [number, number] = [100.353138, 5.279591];
const DEFAULT_ZOOM = 11.13;

// Occupancy summary colors
const STAT_META = [
  { key: 'available', label: 'Available', color: '#22c55e' },
  { key: 'occupied', label: 'Occupied', color: '#ef4444' },
  { key: 'reserved', label: 'Reserved', color: '#2563eb' },
] as const;

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export default function FsmsPlants() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">

      {/* Force popups above overlays + neutralise MapLibre's grab cursor (map is locked) */}
      <style>{`
        .mapboxgl-popup, .maplibregl-popup { z-index: 9999 !important; }
        .maplibregl-canvas-container.maplibregl-interactive,
        .maplibregl-canvas-container.maplibregl-interactive .maplibregl-canvas {
          cursor: default !important;
        }
      `}</style>

      {/* Title card — top left */}
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-5 py-3.5 shadow-lg min-w-[220px] overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
            style={{ background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 50%, #21b735 100%)' }} />
          <p className="text-[13px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">Plants</p>
          <p className="text-[15px] font-semibold leading-tight mt-1 text-foreground">
            FSMS Floor Layouts
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Click a plant marker to view layouts or plant details
          </p>
        </div>
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

        {PLANTS.map((plant) => (
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

            {/* OLE-style popup — image header, occupancy summary, OLE-style buttons */}
            <MarkerPopup className="w-64 p-0 overflow-hidden rounded-xl shadow-2xl border-0">
              <div className="relative h-32 overflow-hidden rounded-t-md bg-muted">
                <img src={plant.image} alt={plant.label} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2.5 p-3">
                <div>
                  <p className="text-muted-foreground pb-0.5 text-[10px] font-semibold tracking-widest uppercase">
                    {plant.category}
                  </p>
                  <h3 className="text-foreground font-bold text-sm leading-tight">
                    Jabil Circuit — {plant.label}
                  </h3>
                </div>

                {/* Bay occupancy summary */}
                <div className="grid grid-cols-3 gap-1.5">
                  {STAT_META.map((s) => {
                    const value = pct(plant.bays[s.key], plant.bays.total);
                    return (
                      <div
                        key={s.key}
                        className="rounded-lg px-2 py-1.5 text-center"
                        style={{ background: `${s.color}14` }}
                      >
                        <p className="text-sm font-mono font-bold leading-none" style={{ color: s.color }}>
                          {value}%
                        </p>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                          {s.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  {plant.bays.total} bays total
                </p>

                {/* OLE-style buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => navigate('/fsms/floor-map?from=plants')}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: plant.color }}
                  >
                    View Layouts
                  </button>
                  <button
                    onClick={() => navigate(`/fsms/dashboard?tab=workcell&plant=${plant.plantCode}`)}
                    className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    Plant Details
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
