export type Coord = { lat: number; lng: number };

const CITIES: Record<string, Coord> = {
  "costa mesa, ca": { lat: 33.6411, lng: -117.9187 },
  "west hollywood, ca": { lat: 34.09, lng: -118.3617 },
  "long beach, ca": { lat: 33.7701, lng: -118.1937 },
  "irvine, ca": { lat: 33.6846, lng: -117.8265 },
  "los angeles, ca": { lat: 34.0522, lng: -118.2437 },
  "silver lake, ca": { lat: 34.0869, lng: -118.2702 },
  "santa monica, ca": { lat: 34.0195, lng: -118.4912 },
  "pasadena, ca": { lat: 34.1478, lng: -118.1445 },
  "koreatown, ca": { lat: 34.061, lng: -118.3067 },
  "anaheim, ca": { lat: 33.8366, lng: -117.9143 },
  "echo park, ca": { lat: 34.0782, lng: -118.2606 },
  "venice, ca": { lat: 33.985, lng: -118.4695 },
  "palm springs, ca": { lat: 33.8303, lng: -116.5453 },
  "san diego, ca": { lat: 32.7157, lng: -117.1611 },
  "las vegas, nv": { lat: 36.1699, lng: -115.1398 },
  "oakland, ca": { lat: 37.8044, lng: -122.2712 },
  "hollywood, ca": { lat: 34.0928, lng: -118.3287 },
  "newport beach, ca": { lat: 33.6189, lng: -117.9298 },
  "huntington beach, ca": { lat: 33.6595, lng: -117.9988 },
  "fullerton, ca": { lat: 33.8704, lng: -117.9243 },
  "orange, ca": { lat: 33.7879, lng: -117.8531 },
  "inglewood, ca": { lat: 33.9617, lng: -118.3531 },
};

export const DEFAULT_COORD: Coord = CITIES["costa mesa, ca"]!;

export function coordForLocation(location: string | null | undefined): Coord | null {
  if (!location) return null;
  const key = location.trim().toLowerCase();
  if (CITIES[key]) return CITIES[key]!;
  const city = key.split(",")[0]?.trim();
  if (city) {
    for (const [name, coord] of Object.entries(CITIES)) {
      if (name.startsWith(`${city},`)) return coord;
    }
  }
  return null;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function milesBetween(a: Coord, b: Coord): number {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function formatMiles(miles: number | null | undefined): string | null {
  if (miles == null || Number.isNaN(miles)) return null;
  if (miles < 1) return "Nearby";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
