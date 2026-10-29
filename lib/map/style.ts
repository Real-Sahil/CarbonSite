// OpenFreeMap's public "liberty" style: OpenStreetMap data, free, no key. NEXT_PUBLIC_MAP_STYLE_URL swaps in another
// host (a self-hosted or paid style) without a code change. Attribution is drawn by the map itself.
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function mapStyleUrl(): string {
  return process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE_URL;
}
