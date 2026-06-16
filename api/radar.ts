import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 30;

// Multiple public Overpass mirrors, ordered by typical reliability
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const HEADERS = {
  'User-Agent': 'CRM-Gustavo/1.0 (gugarbarski@gmail.com)',
  'Accept': 'application/json',
};

function buildQuery(lat: number, lon: number, radius: number, type: string): string {
  const A = `around:${radius},${lat},${lon}`;
  let filter = '';

  if (type === '') {
    filter = `
      node["shop"]["name"](${A});
      node["amenity"~"^(restaurant|cafe|bar|fast_food|pub|pharmacy|clinic|dentist|bank|fuel|hairdresser|beauty)$"]["name"](${A});
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

  return `[out:json][timeout:20];(${filter});out body;`;
}

async function tryEndpointGet(endpoint: string, query: string, timeoutMs: number): Promise<Response> {
  const url = `${endpoint}?data=${encodeURIComponent(query)}`;
  return fetch(url, {
    method: 'GET',
    headers: HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function tryEndpointPost(endpoint: string, query: string, timeoutMs: number): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { lat, lon, radius, type } = req.query;

  if (!lat || !lon || !radius) {
    return res.status(400).json({ error: 'Missing lat, lon or radius' });
  }

  const finalLat = parseFloat(lat as string);
  const finalLon = parseFloat(lon as string);

  if (isNaN(finalLat) || isNaN(finalLon)) {
    return res.status(400).json({ error: 'Invalid lat/lon' });
  }

  const query = buildQuery(finalLat, finalLon, parseInt(radius as string), (type as string) ?? '');

  // Race the first two endpoints in parallel (GET method), pick whichever responds first
  // Then fall through to POST method on remaining endpoints if both fail
  const errors: string[] = [];

  // Round 1: GET requests to top 2 endpoints in parallel
  try {
    const results = await Promise.allSettled([
      tryEndpointGet(OVERPASS_ENDPOINTS[0], query, 8000),
      tryEndpointGet(OVERPASS_ENDPOINTS[1], query, 8000),
    ]);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.ok) {
        const data = await result.value.json();
        return res.status(200).json(data);
      }
      if (result.status === 'rejected') {
        errors.push(result.reason?.message ?? 'unknown');
      } else if (!result.value.ok) {
        errors.push(`HTTP ${result.value.status}`);
      }
    }
  } catch (e) {
    errors.push((e as Error).message);
  }

  // Round 2: POST requests to remaining endpoints
  for (const endpoint of OVERPASS_ENDPOINTS.slice(2)) {
    try {
      const ovRes = await tryEndpointPost(endpoint, query, 7000);
      if (ovRes.ok) {
        const data = await ovRes.json();
        return res.status(200).json(data);
      }
      errors.push(`${endpoint}: HTTP ${ovRes.status}`);
    } catch (err) {
      errors.push(`${endpoint}: ${(err as Error).message}`);
    }
  }

  // Round 3: POST to main endpoint as last resort with text/plain body
  try {
    const ovRes = await fetch(OVERPASS_ENDPOINTS[0], {
      method: 'POST',
      headers: { ...HEADERS, 'Content-Type': 'text/plain;charset=UTF-8' },
      body: query,
      signal: AbortSignal.timeout(6000),
    });
    if (ovRes.ok) {
      const data = await ovRes.json();
      return res.status(200).json(data);
    }
    errors.push(`last-resort POST: HTTP ${ovRes.status}`);
  } catch (err) {
    errors.push(`last-resort: ${(err as Error).message}`);
  }

  return res.status(503).json({ error: `Overpass unavailable`, details: errors });
}
