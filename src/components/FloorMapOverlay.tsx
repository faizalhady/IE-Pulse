/**
 * FloorMapOverlay
 *
 * Reusable component that renders absolute-positioned overlays on top of a
 * floor plan image, mathematically locked to the image regardless of how the
 * container is resized. Uses useImageRect internally.
 *
 * Props:
 *   containerRef  — ref to the wrapper div that holds the image
 *   imgRef        — ref to the <img> element (must use object-contain)
 *   items         — array of overlay items with % position from PPTX
 *   visibleIds    — Set of ids to show (null = show all)
 *   renderOverlay — render prop: called per visible item, receives px rect + state
 *   onMouseEnter  — fired when an item is hovered
 *   onMouseLeave  — fired when mouse leaves an item
 *   onClick       — fired when an item is clicked
 *
 * Example:
 *   <FloorMapOverlay
 *     containerRef={containerRef}
 *     imgRef={imgRef}
 *     items={bays}
 *     visibleIds={visibleIds}
 *     renderOverlay={(item, px, { isHovered, isSelected }) => (
 *       <div style={{ ...px, background: isHovered ? 'red' : 'blue' }} />
 *     )}
 *     onMouseEnter={setHovered}
 *     onMouseLeave={() => setHovered(null)}
 *     onClick={setSelected}
 *   />
 */

import { toPixels, useImageRect } from '@/hooks/useImageRect'

export interface OverlayItem {
  id: string
  position: { left: number; top: number; width: number; height: number }
  [key: string]: unknown
}

export interface OverlayRenderState {
  isHovered:  boolean
  isSelected: boolean
  px: { left: number; top: number; width: number; height: number; position: 'absolute' }
}

interface Props<T extends OverlayItem> {
  containerRef:  React.RefObject<HTMLDivElement>
  imgRef:        React.RefObject<HTMLImageElement>
  items:         T[]
  visibleIds?:   Set<string> | null
  hoveredId?:    string | null
  selectedId?:   string | null
  renderOverlay: (item: T, state: OverlayRenderState) => React.ReactNode
  onMouseEnter?: (item: T, e: React.MouseEvent) => void
  onMouseLeave?: (item: T, e: React.MouseEvent) => void
  onClick?:      (item: T, e: React.MouseEvent) => void
}

export function FloorMapOverlay<T extends OverlayItem>({
  containerRef,
  imgRef,
  items,
  visibleIds = null,
  hoveredId  = null,
  selectedId = null,
  renderOverlay,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: Props<T>) {
  const imageRect = useImageRect(containerRef, imgRef)
  if (!imageRect) return null

  return (
    <>
      {items.map(item => {
        if (visibleIds !== null && !visibleIds.has(item.id)) return null

        const rawPx = toPixels(item.position, imageRect)
        const px    = { ...rawPx, position: 'absolute' as const }

        return (
          <div
            key={item.id}
            style={px}
            onMouseEnter={onMouseEnter ? e => onMouseEnter(item, e) : undefined}
            onMouseLeave={onMouseLeave ? e => onMouseLeave(item, e) : undefined}
            onClick={onClick ? e => onClick(item, e) : undefined}
          >
            {renderOverlay(item, {
              isHovered:  item.id === hoveredId,
              isSelected: item.id === selectedId,
              px,
            })}
          </div>
        )
      })}
    </>
  )
}
