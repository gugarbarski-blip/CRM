import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 30;

// Google Places "Nearby Search" (New) API
// Set GOOGLE_PLACES_API_KEY in Vercel Environment Variables to enable.
// Free tier: $200/month credit ≈ 5,000 nearby searches.

interface GooglePlace {
  id: string;
  displayName: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  regularOpeningHours?: { weekdayDescriptions: string[] };
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  location: { latitude: number; longitude: number };
}

function buildTypeFilter(type: string): string {
  if (type === '') return '';
  const map: Record<string, string> = {
    restaurant: 'restaurant',
    cafe: 'cafe',
    bar: 'bar',
    pharmacy: 'pharmacy',
    clinic: 'medical_clinic',
    school: 'school',
    hotel: 'hotel',
    gym: 'gym',
    supermarket: 'supermarket',
    hairdresser: 'hair_salon',
    florist: 'florist',
    stationery: 'stationery_store',
    language_school: 'language_school',
  };
  return map[type] ?? type;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });
  }

  const { lat, lon, radius, type } = req.query;
  if (!lat || !lon || !radius) {
    return res.status(400).json({ error: 'Missing lat, lon or radius' });
  }

  const includedType = buildTypeFilter(type as string ?? '');

  const body: Record<string, unknown> = {
    locationRestriction: {
      circle: {
        center: { latitude: parseFloat(lat as string), longitude: parseFloat(lon as string) },
        radius: parseInt(radius as string),
      },
    },
    maxResultCount: 20,
    languageCode: 'pt-BR',
  };
  if (includedType) body.includedTypes = [includedType];

  try {
    const gRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.nationalPhoneNumber',
          'places.websiteUri',
          'places.regularOpeningHours.weekdayDescriptions',
          'places.primaryTypeDisplayName',
          'places.rating',
          'places.userRatingCount',
          'places.location',
        ].join(','),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!gRes.ok) {
      const err = await gRes.text();
      return res.status(gRes.status).json({ error: err });
    }

    const data = await gRes.json();
    const places: GooglePlace[] = data.places ?? [];

    // Normalise to the same shape the frontend already expects
    const elements = places.map(p => ({
      id: p.id,
      lat: p.location.latitude,
      lon: p.location.longitude,
      source: 'google',
      tags: {
        name: p.displayName.text,
        'addr:full': p.formattedAddress ?? '',
        phone: p.nationalPhoneNumber ?? '',
        website: p.websiteUri ?? '',
        opening_hours: p.regularOpeningHours?.weekdayDescriptions?.join('; ') ?? '',
        category_label: p.primaryTypeDisplayName?.text ?? '',
        rating: p.rating != null ? `${p.rating} ⭐ (${p.userRatingCount ?? 0} avaliações)` : '',
      },
    }));

    return res.status(200).json({ elements, source: 'google' });
  } catch (err) {
    return res.status(503).json({ error: (err as Error).message });
  }
}
