import type { VercelRequest, VercelResponse } from '@vercel/node';

export const maxDuration = 15;

// Reverse geocode coordinates -> a human-readable address, used to fill in
// businesses that OpenStreetMap has without addr:* tags.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Missing lat/lon' });

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat as string)}&lon=${encodeURIComponent(lon as string)}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'pt-BR',
          'User-Agent': 'CRM-Gustavo/1.0 (gugarbarski@gmail.com)',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await r.json();
    const a = data.address ?? {};
    const parts = [
      [a.road, a.house_number].filter(Boolean).join(', '),
      a.suburb || a.neighbourhood,
      a.city || a.town || a.village,
      a.state,
    ].filter(Boolean);
    return res.status(200).json({ address: parts.join(' — ') || data.display_name || '' });
  } catch (err) {
    return res.status(503).json({ error: (err as Error).message });
  }
}
