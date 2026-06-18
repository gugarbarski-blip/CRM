import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 30;

// Foursquare Places API.
// Three variants tried in order:
//  A) NEW platform (2025+): places-api.foursquare.com  + Bearer + version header
//  B) LEGACY v3 bearer:     api.foursquare.com/v3      + Bearer (some docs show this)
//  C) LEGACY v3 raw:        api.foursquare.com/v3      + raw key (classic format)

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

// Probe one URL+headers combo, return { status, ok, body_snippet }
async function probe(url: string, headers: Record<string, string>): Promise<{ status: number; ok: boolean; body: string }> {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    const body = (await r.text()).slice(0, 600);
    return { status: r.status, ok: r.ok, body };
  } catch (e) {
    return { status: 0, ok: false, body: (e as Error).message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.FSQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'FSQ_API_KEY not configured' });

  const { lat, lon, radius, type, debug } = req.query;
  if (!lat || !lon || !radius) return res.status(400).json({ error: 'Missing lat, lon or radius' });

  const categoryId = FSQ_CATEGORY_MAP[(type as string) ?? ''];
  const ll = `${lat},${lon}`;

  // ── DEBUG MODE ────────────────────────────────────────────────────────────
  // Open /api/places-fsq?lat=...&lon=...&radius=...&debug=1 in browser
  // to see raw Foursquare responses for each auth variant.
  if (debug) {
    const base3 = `https://api.foursquare.com/v3/places/search?ll=${ll}&radius=${radius}&limit=3`;
    const baseNew = `https://places-api.foursquare.com/places/search?ll=${ll}&radius=${radius}&limit=3`;
    const [a, b, c, d] = await Promise.all([
      probe(baseNew,  { Authorization: `Bearer ${apiKey}`, 'X-Places-Api-Version': '2025-06-17', Accept: 'application/json' }),
      probe(baseNew,  { Authorization: apiKey, 'X-Places-Api-Version': '2025-06-17', Accept: 'application/json' }),
      probe(base3,    { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' }),
      probe(base3,    { Authorization: apiKey, Accept: 'application/json' }),
    ]);
    return res.status(200).json({
      keyLen: apiKey.length,
      keyPrefix: apiKey.slice(0, 6),
      'A_newPlatform_Bearer': a,
      'B_newPlatform_rawKey': b,
      'C_legacyV3_Bearer': c,
      'D_legacyV3_rawKey': d,
    });
  }

  // ── ATTEMPT A: NEW platform, Bearer ──────────────────────────────────────
  try {
    const params = new URLSearchParams({ ll, radius: radius as string, limit: '50', fields: FIELDS });
    if (categoryId) params.set('fsq_category_ids', categoryId);

    const r = await fetch(`https://places-api.foursquare.com/places/search?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'X-Places-Api-Version': '2025-06-17', Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const data = await r.json();
      const elements = normalise(data.results ?? []);
      if (elements.length > 0) return res.status(200).json({ elements, source: 'foursquare' });
    } else {
      console.error(`[FSQ-A] HTTP ${r.status}: ${await r.text()}`);
    }
  } catch (e) { console.error(`[FSQ-A] threw: ${(e as Error).message}`); }

  // ── ATTEMPT B: LEGACY v3, Bearer ─────────────────────────────────────────
  try {
    const params = new URLSearchParams({ ll, radius: radius as string, limit: '50', fields: LEGACY_FIELDS });
    if (categoryId) params.set('categories', categoryId);

    const r = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const data = await r.json();
      const elements = normalise(data.results ?? []);
      if (elements.length > 0) return res.status(200).json({ elements, source: 'foursquare' });
    } else {
      console.error(`[FSQ-B] HTTP ${r.status}: ${await r.text()}`);
    }
  } catch (e) { console.error(`[FSQ-B] threw: ${(e as Error).message}`); }

  // ── ATTEMPT C: LEGACY v3, raw key ────────────────────────────────────────
  try {
    const params = new URLSearchParams({ ll, radius: radius as string, limit: '50', fields: LEGACY_FIELDS });
    if (categoryId) params.set('categories', categoryId);

    const r = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
      headers: { Authorization: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const data = await r.json();
      const elements = normalise(data.results ?? []);
      if (elements.length > 0) return res.status(200).json({ elements, source: 'foursquare' });
    } else {
      const err = await r.text();
      console.error(`[FSQ-C] HTTP ${r.status}: ${err}`);
      return res.status(r.status).json({ error: `Foursquare: ${err}` });
    }
  } catch (err) {
    return res.status(503).json({ error: (err as Error).message });
  }

  return res.status(503).json({ error: 'All Foursquare attempts failed' });
}
