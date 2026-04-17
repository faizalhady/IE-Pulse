import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tracks the actual rendered pixel rect of an image inside a container
 * when using `object-contain` (which adds letterbox bars).
 *
 * The image's true rendered area is smaller than the container when aspect
 * ratios differ. This hook computes the offset (x, y) and rendered size
 * (w, h) so overlays can be positioned mathematically in sync with the image
 * regardless of container size or window resizes.
 *
 * Usage:
 *   const containerRef = useRef<HTMLDivElement>(null)
 *   const imgRef       = useRef<HTMLImageElement>(null)
 *   const imageRect    = useImageRect(containerRef, imgRef)
 *
 *   // Convert % position from data to px inside container:
 *   const px = {
 *     left:   imageRect.x + (data.left   / 100) * imageRect.w,
 *     top:    imageRect.y + (data.top    / 100) * imageRect.h,
 *     width:              (data.width  / 100) * imageRect.w,
 *     height:             (data.height / 100) * imageRect.h,
 *   }
 */

export interface ImageRect {
  x: number   // px offset from container left edge (letterbox gap)
  y: number   // px offset from container top edge  (letterbox gap)
  w: number   // rendered image width  in px
  h: number   // rendered image height in px
}

export function useImageRect(
  containerRef: React.RefObject<HTMLDivElement>,
  imgRef: React.RefObject<HTMLImageElement>
): [ImageRect | null, () => void] {
  const [rect, setRect] = useState<ImageRect | null>(null)

  const compute = useCallback(() => {
    const container = containerRef.current
    const img       = imgRef.current
    if (!container || !img || !img.naturalWidth) return

    const cw    = container.clientWidth
    const ch    = container.clientHeight
    const nw    = img.naturalWidth
    const nh    = img.naturalHeight
    const scale = Math.min(cw / nw, ch / nh)
    const rw    = nw * scale
    const rh    = nh * scale

    setRect({
      x: (cw - rw) / 2,
      y: (ch - rh) / 2,
      w: rw,
      h: rh,
    })
  }, [containerRef, imgRef])

  // Keep a stable ref to compute so img.onLoad can always call the latest version
  const computeRef = useRef(compute)
  useEffect(() => { computeRef.current = compute }, [compute])

  // Recompute on container resize AND window resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver(compute)
    ro.observe(container)

    const onResize = () => computeRef.current()
    window.addEventListener('resize', onResize)

    compute() // initial run

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [containerRef, compute])

  return [rect, compute]
}

/** Helper: convert % position from PPTX data to absolute px using ImageRect */
export function toPixels(
  position: { left: number; top: number; width: number; height: number },
  ir: ImageRect
) {
  return {
    left:   ir.x + (position.left   / 100) * ir.w,
    top:    ir.y + (position.top    / 100) * ir.h,
    width:         (position.width  / 100) * ir.w,
    height:        (position.height / 100) * ir.h,
  }
}
