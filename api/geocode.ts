import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q' });

  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q as string)}&limit=1&countrycodes=br`,
      {
        headers: {
          'Accept-Language': 'pt-BR',
          'User-Agent': 'CRM-Gustavo/1.0 (gugarbarski@gmail.com)',
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    const data = await geoRes.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(503).json({ error: (err as Error).message });
  }
}
