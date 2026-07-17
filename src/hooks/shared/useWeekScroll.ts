import { useEffect, useRef, useState } from 'react';

/**
 * Horizontal-scroll a weekly bar chart so only `visible` weeks (default 13)
 * show in the viewport; older weeks sit off-screen to the left and the user
 * scrolls back to reach them. On mount / data growth it snaps to the newest
 * (right) edge. Returns the wrapper ref + the inner chart width to render.
 *
 * ponytail: snaps right on any resize too; if a user scrolls back then resizes
 * they lose their spot. Track a "user scrolled" flag if that ever matters.
 */
export function useWeekScroll(weekCount: number, visible = 13) {
  const ref = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVw(el.clientWidth));
    ro.observe(el);
    setVw(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const overflow = weekCount > visible && vw > 0;
  const innerWidth = overflow ? Math.round((weekCount * vw) / visible) : vw;

  useEffect(() => {
    const el = ref.current;
    if (el && overflow) el.scrollLeft = innerWidth; // clamps to max → newest in view
  }, [innerWidth, overflow]);

  return { ref, chartWidth: overflow ? innerWidth : ('100%' as const) };
}
