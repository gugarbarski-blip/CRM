import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 30;

// Foursquare Places API. Two platforms exist:
//  - NEW (2025+): places-api.foursquare.com, "Bearer" service key, version header
//  - LEGACY v3:   api.foursquare.com/v3, raw key in Authorization
// We try NEW first, fall back to LEGACY, so any key type works.

const FSQ_CATEGORY_MAP: Record<string, string> = {
  restaurant: '13065',
  cafe: '13032',
  bar: '13003',
  pharmacy: '17035',
  clinic: '15014',
  school: '12058',
  language_school: '12058',
  hotel: '19014',
  gym: '18021',
  supermarket: '17069',
  hairdresser: '11134',
  florist: '17048',
  stationery: '17097',
  gift_shop: '17050',
};

const FIELDS = 'fsq_place_id,name,latitude,longitude,location,tel,website,hours,categories,rating,stats,social_media';
const LEGACY_FIELDS = 'fsq_id,name,geocodes,location,tel,website,hours,categories,rating,stats,social_media';

interface RawPlace {
  fsq_place_id?: string;
  fsq_id?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  geocodes?: { main?: { latitude: number; longitude: number } };
  location?: { formatted_address?: string };
  tel?: string;
  website?: string;
  hours?: { display?: string };
  categories?: Array<{ name: string }>;
  rating?: number;
  stats?: { total_ratings?: number };
  social_media?: { instagram?: string; facebook_id?: string };
}

function normalise(places: RawPlace[]) {
  return places
    .map(p => {
      const lat = p.latitude ?? p.geocodes?.main?.latitude;
      const lon = p.longitude ?? p.geocodes?.main?.longitude;
      if (lat == null || lon == null) return null;
      return {
        id: p.fsq_place_id ?? p.fsq_id ?? `${lat},${lon}`,
        lat,
        lon,
        source: 'foursquare',
        tags: {
          name: p.name,
          'addr:full': p.location?.formatted_address ?? '',
          phone: p.tel ?? '',
          website: p.website ?? '',
          opening_hours: p.hours?.display ?? '',
          category_label: p.categories?.[0]?.name ?? '',
          rating: p.rating != null
            ? `${p.rating.toFixed(1)}/10 ⭐ (${p.stats?.total_ratings ?? 0} avaliações)`
            : '',
          'contact:instagram': p.social_media?.instagram ?? '',
          'contact:facebook': p.social_media?.facebook_id ?? '',
        },
      };
    })
    .filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.FSQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'FSQ_API_KEY not configured' });

  const { lat, lon, radius, type, debug } = req.query;
  if (!lat || !lon || !radius) return res.status(400).json({ error: 'Missing lat, lon or radius' });

  const categoryId = FSQ_CATEGORY_MAP[(type as string) ?? ''];

  // Debug mode: probe both platforms and return the raw upstream responses,
  // so we can see exactly what Foursquare rejects. Open /api/places-fsq?...&debug=1
  if (debug) {
    const out: Record<string, unknown> = { keyLen: apiKey.length };
    try {
      const r = await fetch(
        `https://places-api.foursquare.com/places/search?ll=${lat},${lon}&radius=${radius}&limit=3`,
        { headers: { Authorization: `Bearer ${apiKey}`, 'X-Places-Api-Version': '2025-06-17', Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
      );
      out.newApi = { status: r.status, body: (await r.text()).slice(0, 800) };
    } catch (e) { out.newApi = { threw: (e as Error).message }; }
    try {
      const r = await fetch(
        `https://api.foursquare.com/v3/places/search?ll=${lat},${lon}&radius=${radius}&limit=3`,
        { headers: { Authorization: apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
      );
      out.legacyApi = { status: r.status, body: (await r.text()).slice(0, 800) };
    } catch (e) { out.legacyApi = { threw: (e as Error).message }; }
    return res.status(200).json(out);
  }

  // --- Attempt 1: NEW platform ---
  try {
    const params = new URLSearchParams({
      ll: `${lat},${lon}`,
      radius: radius as string,
      limit: '50',
      fields: FIELDS,
    });
    if (categoryId) params.set('fsq_category_ids', categoryId);

    const r = await fetch(`https://places-api.foursquare.com/places/search?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-Places-Api-Version': '2025-06-17',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (r.ok) {
      const data = await r.json();
      return res.status(200).json({ elements: normalise(data.results ?? []), source: 'foursquare' });
    }
    console.error(`[FSQ] new API failed: HTTP ${r.status} ${await r.text()}`);
    // 401/403 => probably a legacy key; fall through. Other errors: keep going too.
  } catch (e) { console.error(`[FSQ] new API threw: ${(e as Error).message}`); }

  // --- Attempt 2: LEGACY v3 platform ---
  try {
    const params = new URLSearchParams({
      ll: `${lat},${lon}`,
      radius: radius as string,
      limit: '50',
      fields: LEGACY_FIELDS,
    });
    if (categoryId) params.set('categories', categoryId);

    const r = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
      headers: { Authorization: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: `Foursquare: ${err}` });
    }
    const data = await r.json();
    return res.status(200).json({ elements: normalise(data.results ?? []), source: 'foursquare' });
  } catch (err) {
    return res.status(503).json({ error: (err as Error).message });
  }
}
