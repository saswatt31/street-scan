import { getServiceClient } from '../db';

/**
 * Calculates distance between two points in meters using Haversine formula.
 */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Creates a simple string geohash-like representation for spatial indexing.
 * For this project, we use a fixed precision (approx 15-20m).
 */
export function simpleGeohash(lat: number, lng: number): string {
  // Rough grid-based geohash by rounding coordinates
  // 0.0001 degrees is ~11 meters
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Finds reports within a certain radius (meters) of a location.
 */
export async function findNearbyReports(lat: number, lng: number, damageType: string, radiusM: number = 15) {
  const sb = getServiceClient();
  
  // Use a bounding box for initial filter (more efficient than full distance scan)
  const delta = radiusM / 111320; // degree equivalent
  
  const { data, error } = await sb.from('reports')
    .select('*')
    .eq('damage_type', damageType)
    .gte('latitude', lat - delta)
    .lte('latitude', lat + delta)
    .gte('longitude', lng - delta)
    .lte('longitude', lng + delta);

  if (error) return [];

  // Refine with exact distance
  return data.filter(r => haversineM(lat, lng, r.latitude, r.longitude) <= radiusM);
}
