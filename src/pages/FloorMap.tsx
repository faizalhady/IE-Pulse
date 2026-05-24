import { ALL_BAYS, AREAS, BAY_IMAGES, type Area, type BayDef } from '@/data/bay'
import { toPixels, useImageRect } from '@/hooks/useImageRect'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronLeft, ExternalLink, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const BOX_COLOR = '#25473d'
const BOX_BORDER = '#1a5fa0'
const BOX_HOVER = '#dc2626'
const BOX_SEL = '#b91c1c'

const TIP_W = 256
const TIP_H = 200
const SEL_H = 260
const MARGIN = 12

interface TooltipPos { x: number; y: number }

export default function FloorMap() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromPlants = searchParams.get('from') === 'plants'

  const [area, setArea] = useState<Area>('P1A')
  const [selected, setSelected] = useState<BayDef | null>(null)
  const [hovered, setHovered] = useState<BayDef | null>(null)
  const [tipPos, setTipPos] = useState<TooltipPos | null>(null)
  const [selPos, setSelPos] = useState<TooltipPos | null>(null)
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState('All')
  const [dropOpen, setDropOpen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [imageRect, computeRect] = useImageRect(containerRef, imgRef)
  const [imgLoaded, setImgLoaded] = useState(false)

  useEffect(() => { setImgLoaded(false) }, [area])

  const bays = useMemo(() => ALL_BAYS.filter(b => b.area === area), [area])

  const customers = useMemo(() => {
    const all = bays
      .flatMap(b => b.customer.split(' / ').map(c => c.trim()))
      .filter(Boolean)
    return ['All', ...Array.from(new Set(all)).sort()]
  }, [bays])

  const visibleIds = useMemo(() => {
    const hasSearch = search.trim().length > 0
    const hasCust = customer !== 'All'
    if (!hasSearch && !hasCust) return null
    const q = search.toLowerCase()
    return new Set(
      bays.filter(b => {
        const ms = !hasSearch || (
          b.bayNumber.toLowerCase().includes(q) ||
          b.customer.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
        )
        const mc = !hasCust || b.customer.split(' / ').map(c => c.trim()).includes(customer)
        return ms && mc
      }).map(b => b.id)
    )
  }, [search, customer, bays])

  function goToWorkcell(_bay: BayDef) {
    navigate('/pulse/workcell/KEYSIGHT')
  }

  function goToBayDetail(_bay: BayDef) {
    navigate('/pulse/bay/KEYSIGHT__BAY 116B')
  }

  function clampPos(rawX: number, rawY: number, cardW: number, cardH: number): TooltipPos {
    const body = bodyRef.current
    if (!body) return { x: rawX, y: rawY }
    const bw = body.clientWidth
    const bh = body.clientHeight
    return {
      x: Math.min(Math.max(rawX, MARGIN), bw - cardW - MARGIN),
      y: Math.min(Math.max(rawY, MARGIN), bh - cardH - MARGIN),
    }
  }

  function handleMouseEnter(bay: BayDef, e: React.MouseEvent) {
    setHovered(bay)
    const bodyRect = bodyRef.current?.getBoundingClientRect()
    if (!bodyRect) return
    const rx = e.clientX - bodyRect.left + MARGIN
    const ry = e.clientY - bodyRect.top - TIP_H / 2
    setTipPos(clampPos(rx, ry, TIP_W, TIP_H))
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!hovered) return
    const bodyRect = bodyRef.current?.getBoundingClientRect()
    if (!bodyRect) return
    const rx = e.clientX - bodyRect.left + MARGIN
    const ry = e.clientY - bodyRect.top - TIP_H / 2
    setTipPos(clampPos(rx, ry, TIP_W, TIP_H))
  }

  function handleMouseLeave() { setHovered(null); setTipPos(null) }

  function handleClick(bay: BayDef, e: React.MouseEvent) {
    if (selected?.id === bay.id) { setSelected(null); setSelPos(null); return }
    setSelected(bay)
    const bodyRect = bodyRef.current?.getBoundingClientRect()
    if (!bodyRect) return
    const rx = e.clientX - bodyRect.left + MARGIN
    const ry = e.clientY - bodyRect.top - SEL_H / 2
    setSelPos(clampPos(rx, ry, TIP_W, SEL_H))
  }

  return (
    <>
      <style>{`
  :root {
    --glow-rgb: 34, 197, 94;
  }

  @keyframes inner-glow-pulse {
    0%, 100% {
      box-shadow:
        inset 0 0 6px 1px rgba(var(--glow-rgb), 0.5),
        inset 0 0 2px 0px rgba(255, 255, 255, 0.4);
    }
    50% {
      box-shadow:
        inset 0 0 10px 2px rgba(var(--glow-rgb), 0.8),
        inset 0 0 4px 1px rgba(255, 255, 255, 0.6);
    }
  }

  .bay-overlay {
    position: absolute;
    inset: 0;
    background: ${BOX_COLOR};
    border-radius: 4px;
    cursor: pointer;
    box-sizing: border-box;
    overflow: hidden;
    transition: transform 0.2s ease, background 0.2s ease;
    border: 1.5px solid rgba(var(--glow-rgb), 0.7);
    animation: inner-glow-pulse 2s ease-in-out infinite;
  }

  .bay-overlay:hover {
    transform: translateY(-2px) scale(1.025);
    z-index: 20;
    background: ${BOX_HOVER} !important;
    animation: none;
    box-shadow:
      inset 0 0 12px 3px rgba(var(--glow-rgb), 1),
      0 8px 24px rgba(0,0,0,0.5);
  }
`}</style>

      <div className="flex flex-col h-full min-h-0" onClick={() => setDropOpen(false)}>

        {/* ── header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            {fromPlants && (
              <button
                onClick={() => navigate('/fsms/plants')}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title="Back to Plants"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-semibold text-foreground">Floor Map</h1>
              <p className="text-xs text-muted-foreground">Hover to preview · click to inspect</p>
            </div>
          </div>

          {/* search + filter */}
          <div className="flex items-center gap-2 flex-1 justify-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search bay..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-44"
              />
            </div>

            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setDropOpen(o => !o)}
                className={cn(
                  'flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-xs rounded-lg border transition-colors min-w-[140px] justify-between',
                  customer !== 'All'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-background text-foreground'
                )}
              >
                <span className="truncate">{customer === 'All' ? 'Filter by customer' : customer}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 flex-shrink-0 transition-transform', dropOpen && 'rotate-180')} />
              </button>
              {dropOpen && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 py-1 min-w-[180px] max-h-64 overflow-y-auto">
                  {customers.map(c => (
                    <button
                      key={c}
                      onClick={() => { setCustomer(c); setDropOpen(false) }}
                      className={cn('w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-accent', c === customer ? 'text-primary font-semibold bg-primary/5' : 'text-foreground')}
                    >
                      {c === 'All' ? '— All customers —' : c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(search || customer !== 'All') && (
              <button
                onClick={() => { setSearch(''); setCustomer('All') }}
                className="text-[10px] text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1.5 transition-colors"
              >
                Clear
              </button>
            )}
            {customer !== 'All' && (
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/30 rounded-full px-2 py-0.5 font-medium">
                {visibleIds?.size ?? 0} bays
              </span>
            )}
          </div>

          {/* area tabs */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-shrink-0">
            {AREAS.map(a => (
              <button
                key={a}
                onClick={() => { setArea(a); setSelected(null); setSearch(''); setCustomer('All') }}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  area === a ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* ── body ── */}
        <div ref={bodyRef} className="flex-1 min-h-0 p-2 bg-muted/20 relative overflow-hidden">

          <div
            ref={containerRef}
            className="w-full h-full relative"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <img
              ref={imgRef}
              src={BAY_IMAGES[area]}
              alt={`${area} floor plan`}
              className="w-full h-full object-contain block rounded-lg border border-border"
              draggable={false}
              onLoad={() => { computeRect(); setImgLoaded(true) }}
            />

            {/* ── overlays ── */}
            {imageRect && imgLoaded && bays.map(bay => {
              const isHov = hovered?.id === bay.id
              const isSel = selected?.id === bay.id
              if (visibleIds !== null && !visibleIds.has(bay.id)) return null

              const px = toPixels(bay.position, imageRect)
              const isReserve = bay.status === 'reserve'

              return (
                <div key={bay.id} style={{ position: 'absolute', ...px, borderRadius: 3, boxSizing: 'border-box', zIndex: isSel ? 15 : 1 }}>
                  {/* solid base */}
                  <div style={{ position: 'absolute', inset: 0, background: BOX_COLOR, borderRadius: 3, pointerEvents: 'none', zIndex: 0 }} />

                  <div
                    className="bay-overlay"
                    onMouseEnter={e => handleMouseEnter(bay, e)}
                    onClick={e => handleClick(bay, e)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: isHov ? BOX_HOVER : isSel ? BOX_SEL : BOX_COLOR,
                      borderRadius: 4,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      zIndex: 1,
                      display: 'flex',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignContent: 'center',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px 4px',
                      gap: '2px 6px',
                    }}
                  >
                    {isReserve ? (
                      /* ── RESERVED ── */
                      <span style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: 'rgba(255,255,255,0.75)',
                        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        position: 'relative',
                        zIndex: 3,
                        lineHeight: 1,
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'center',
                      }}>
                        RESERVED
                      </span>
                    ) : (
                      /* ── OCCUPIED / SPECIAL ── show bayNumber + customer only ── */
                      <>
                        {/* Bay Number */}
                        <span style={{
                          fontSize: 12,
                          fontWeight: 900,
                          color: '#ffffff',
                          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                          textTransform: 'uppercase',
                          position: 'relative',
                          zIndex: 3,
                          lineHeight: 1,
                          userSelect: 'none',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                        }}>
                          {bay.bayNumber}
                        </span>

                        {/* Customer */}
                        {bay.customer && (
                          <span style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: '#fbbf24',
                            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                            textTransform: 'uppercase',
                            position: 'relative',
                            zIndex: 3,
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1,
                            userSelect: 'none',
                            textAlign: 'center',
                          }}>
                            {bay.customer}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── HOVER TOOLTIP ── */}
          {hovered && tipPos && !selected && (
            <div
              className="pointer-events-none absolute z-40"
              style={{ left: tipPos.x, top: tipPos.y, width: TIP_W }}
            >
              <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                {/* header */}
                <div className="px-3 py-2.5 flex items-center justify-between gap-2" style={{ background: BOX_COLOR }}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white leading-tight truncate">
                      {hovered.bayNumber}{hovered.customer ? ` · ${hovered.customer}` : ''}
                    </p>
                    <p className="text-[10px] text-white/65 mt-0.5 capitalize truncate">{hovered.status}</p>
                  </div>
                  <div className="h-6 w-16 bg-white/90 rounded flex items-center justify-center p-0.5 shrink-0">
                    <img
                      src={hovered.customer?.includes('Arista') ? '/workcell logo/Arista.png' : '/workcell logo/keyisght.png'}
                      alt="Company Logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>

                <div className="px-3 py-2.5 space-y-1.5">
                  {hovered.status === 'reserve' ? (
                    /* reserved — show description (e.g. "Reserve for Future Setup 3k SQFT") */
                    <TRow label="Note" value={hovered.description || '—'} />
                  ) : (
                    /* occupied / special — show description only if present */
                    hovered.description
                      ? <TRow label="Description" value={hovered.description} />
                      : <p className="text-[10px] text-muted-foreground italic">No additional info</p>
                  )}
                  <TRow label="Area" value={hovered.area} />
                  <TRow label="Status" value={hovered.status} />
                </div>
                <p className="px-3 pb-2 text-[9px] text-muted-foreground">Click to inspect</p>
              </div>
            </div>
          )}

          {/* ── CLICK PANEL ── */}
          {selected && selPos && (
            <div
              className="absolute z-50"
              style={{ left: selPos.x, top: selPos.y, width: TIP_W }}
            >
              <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                {/* header */}
                <div className="px-4 py-3 flex items-start justify-between gap-2" style={{ background: BOX_COLOR }}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white leading-tight truncate">
                      {selected.bayNumber}{selected.customer ? ` · ${selected.customer}` : ''}
                    </p>
                    <p className="text-[11px] text-white/65 mt-0.5 capitalize truncate">{selected.status}</p>
                  </div>
                  <div className="flex items-start gap-3 shrink-0">
                    <div className="h-7 w-20 bg-white/90 rounded flex items-center justify-center p-1">
                      <img
                        src={selected.customer?.includes('Arista') ? '/workcell logo/Arista.png' : '/workcell logo/keyisght.png'}
                        alt="Company Logo"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <button
                      onClick={() => { setSelected(null); setSelPos(null) }}
                      className="mt-0.5 p-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                </div>

                {/* details */}
                <div className="px-4 py-3 space-y-2">
                  <TRow label="Bay" value={selected.bayNumber} />
                  <TRow label="Customer" value={selected.customer || '—'} />
                  {selected.description && (
                    <TRow label="Description" value={selected.description} />
                  )}
                  <TRow label="Area" value={selected.area} />
                  <TRow label="Status" value={selected.status} />
                  <TRow label="Bay ID" value={selected.id} mono />
                  <TRow label="Position" value={`L ${selected.position.left}%  T ${selected.position.top}%`} />
                  <TRow label="Size" value={`${selected.position.width}% × ${selected.position.height}%`} />
                </div>

                {/* action buttons */}
                <div className="px-4 pb-4 pt-1 flex gap-2 border-t border-border">
                  <button
                    onClick={() => goToBayDetail(selected)}
                    disabled={!selected.customer || selected.status !== 'occupied'}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Bay Details
                  </button>
                  <button
                    onClick={() => goToWorkcell(selected)}
                    disabled={!selected.customer || selected.status !== 'occupied'}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-accent text-xs font-medium text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Go To Workcell
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function TRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <span className={cn('text-[11px] font-medium text-right text-foreground', mono && 'font-mono text-[10px]')}>
        {value}
      </span>
    </div>
  )
}