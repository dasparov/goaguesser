import type { Location } from '../src/lib/locations';

export const GOA_BBOX = { minLat: 14.85, maxLat: 15.85, minLng: 73.65, maxLng: 74.35 };

export interface MapillaryImage {
  id: string;
  is_pano: boolean;
  computed_geometry: { coordinates: [number, number] }; // GeoJSON: [lng, lat]
}

export function parseSpots(text: string): Array<{ imageId: string; name: string | null }> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [idPart, ...nameParts] = line.split('#');
      return { imageId: idPart.trim(), name: nameParts.join('#').trim() || null };
    });
}

export function validateImage(img: MapillaryImage, existingIds: Set<string>): string | null {
  if (existingIds.has(img.id)) return `image ${img.id} is already in the pool`;
  if (!img.is_pano) return `image ${img.id} is not a 360° panorama`;
  const [lng, lat] = img.computed_geometry.coordinates;
  const b = GOA_BBOX;
  if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) {
    return `image ${img.id} is outside Goa (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }
  return null;
}

export function toLocation(
  imageId: string,
  name: string | null,
  img: MapillaryImage,
  version: number
): Location {
  const [lng, lat] = img.computed_geometry.coordinates;
  return { imageId, name: name ?? 'Somewhere in Goa', lat, lng, version };
}

export async function fetchImage(imageId: string, token: string): Promise<MapillaryImage> {
  const url = `https://graph.mapillary.com/${imageId}?access_token=${token}&fields=id,is_pano,computed_geometry`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapillary API ${res.status} for image ${imageId}`);
  return (await res.json()) as MapillaryImage;
}
