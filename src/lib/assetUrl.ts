/**
 * assetUrl — prefix a public-folder path with the current build's base URL.
 *
 * Vite serves files from /public at the configured base (e.g. '/ietools/' in
 * dev, '/ietools/<module>/' in prod single-module builds). A hardcoded leading
 * '/' (e.g. '/workcell logo/Arista.png') ignores the base and 404s.
 *
 * Pass any path with or without a leading slash; this returns the resolved URL.
 *
 *   assetUrl('workcell logo/Arista.png')   → '/ietools/workcell logo/Arista.png'
 *   assetUrl('/floor-maps/P1A.png')        → '/ietools/floor-maps/P1A.png'
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}${path.replace(/^\//, '')}`;
}
