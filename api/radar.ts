import type { VercelRequest, VercelResponse } from '@vercel/node';

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

function buildQuery(lat: number, lon: number, radius: number, type: string): string {
  const A = `around:${radius},${lat},${lon}`;
  let filter = '';

  if (type === '') {
    filter = `
      node["shop"]["name"](${A});
      node["amenity"~"^(restaurant|cafe|bar|fast_food|pub|pharmacy|clinic|dentist|veterinary|bank|fuel|marketplace|hairdresser|beauty)$"]["name"](${A});
      node["tourism"~"^(hotel|guest_house|hostel)$"]["name"](${A});
      node["leisure"="fitness_centre"]["name"](${A});
    `;
  } else if (['restaurant', 'cafe', 'bar', 'pharmacy', 'clinic', 'school', 'hotel'].includes(type)) {
    filter = `node["amenity"="${type}"]["name"](${A});`;
  } else if (type === 'gym') {
    filter = `node["leisure"="fitness_centre"]["name"](${A});`;
  } else {
    filter = `node["shop"="${type}"]["name"](${A});`;
  }

  return `[out:json][timeout:25];(${filter});out body;`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { lat, lon, radius, type } = req.query;

  if (!lat || !lon || !radius) {
    return res.status(400).json({ error: 'Missing lat, lon or radius' });
  }

  // Geocode step: user may pass address instead of lat/lon
  let finalLat = parseFloat(lat as string);
  let finalLon = parseFloat(lon as string);

  if (isNaN(finalLat) || isNaN(finalLon)) {
    return res.status(400).json({ error: 'Invalid lat/lon' });
  }

  const query = buildQuery(finalLat, finalLon, parseInt(radius as string), (type as string) ?? '');

  let lastErr = '';
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ovRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(20000),
      });
      if (!ovRes.ok) {
        lastErr = `HTTP ${ovRes.status} from ${endpoint}`;
        continue;
      }
      const data = await ovRes.json();
      return res.status(200).json(data);
    } catch (err) {
      lastErr = `${endpoint}: ${(err as Error).message}`;
    }
  }

  return res.status(503).json({ error: `Overpass unavailable: ${lastErr}` });
}
