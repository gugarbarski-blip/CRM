import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 30;

// Foursquare Places API v3 — free tier: 1,000 calls/day, no credit card needed.
// Set FSQ_API_KEY in Vercel Environment Variables.

const FSQ_CATEGORY_MAP: Record<string, string> = {
  restaurant: '13065',
  cafe: '13032',
  bar: '13003',
  pharmacy: '15014',
  clinic: '15014',
  school: '12058',
  language_school: '12058',
  hotel: '19014',
  gym: '18021',
  supermarket: '17069',
  hairdresser: '11134',
  florist: '11100',
  stationery: '17145',
  gift_shop: '17130',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.FSQ_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'FSQ_API_KEY not configured' });

  const { lat, lon, radius, type } = req.query;
  if (!lat || !lon || !radius) return res.status(400).json({ error: 'Missing lat, lon or radius' });

  const params = new URLSearchParams({
    ll: `${lat},${lon}`,
    radius: radius as string,
    limit: '50',
    fields: 'fsq_id,name,location,tel,website,hours,categories,rating,stats,social_media',
  });

  const categoryId = FSQ_CATEGORY_MAP[type as string ?? ''];
  if (categoryId) params.set('categories', categoryId);

  try {
    const fsqRes = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
      headers: {
        Authorization: apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!fsqRes.ok) {
      const err = await fsqRes.text();
      return res.status(fsqRes.status).json({ error: err });
    }

    const data = await fsqRes.json();
    const places = data.results ?? [];

    // Normalise to the same shape the frontend expects
    const elements = places.map((p: {
      fsq_id: string;
      name: string;
      geocodes?: { main?: { latitude: number; longitude: number } };
      location?: { formatted_address?: string };
      tel?: string;
      website?: string;
      hours?: { display?: string };
      categories?: Array<{ name: string }>;
      rating?: number;
      stats?: { total_ratings?: number };
      social_media?: { instagram?: string; facebook_id?: string };
    }) => ({
      id: p.fsq_id,
      lat: p.geocodes?.main?.latitude,
      lon: p.geocodes?.main?.longitude,
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
      },
    }));

    return res.status(200).json({ elements, source: 'foursquare' });
  } catch (err) {
    return res.status(503).json({ error: (err as Error).message });
  }
}
