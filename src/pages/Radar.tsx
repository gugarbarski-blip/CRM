import { useState } from 'react';
import { MapPin, Search, UserPlus, Building2, Phone, Globe, Check, Loader2, Clock, Mail, AtSign, Share2, Accessibility } from 'lucide-react';
import { clientStore } from '../lib/store';

interface Place {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  hours?: string;
  brand?: string;
  cuisine?: string;
  wheelchair?: string;
  rating?: string;
  category?: string;
  source?: 'google' | 'osm';
  lat: number;
  lon: number;
  imported?: boolean;
}

const BUSINESS_TYPES = [
  { label: 'Todos os comércios', value: '' },
  { label: 'Lojas de presentes', value: 'gift_shop' },
  { label: 'Papelarias', value: 'stationery' },
  { label: 'Floriculturas', value: 'florist' },
  { label: 'Supermercados', value: 'supermarket' },
  { label: 'Farmácias', value: 'pharmacy' },
  { label: 'Restaurantes', value: 'restaurant' },
  { label: 'Cafeterias', value: 'cafe' },
  { label: 'Bares', value: 'bar' },
  { label: 'Academias', value: 'gym' },
  { label: 'Salões de beleza', value: 'hairdresser' },
  { label: 'Clínicas', value: 'clinic' },
  { label: 'Hotéis', value: 'hotel' },
  { label: 'Escolas', value: 'school' },
  { label: 'Escolas de idiomas', value: 'language_school' },
];

const RADIUS_OPTIONS = [
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];


function parseTag(tags: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (tags[key]) return tags[key];
  }
}

// Normalize a social handle/url into a clickable profile URL
function socialUrl(raw: string | undefined, base: string): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith('http')) return raw;
  const handle = raw.replace(/^@/, '').replace(/\/$/, '');
  return `${base}/${handle}`;
}

function buildAddress(tags: Record<string, string>): string {
  const parts = [
    tags['addr:street'] && `${tags['addr:street']}${tags['addr:housenumber'] ? `, ${tags['addr:housenumber']}` : ''}`,
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    tags['addr:city'],
    tags['addr:state'],
  ].filter(Boolean);
  return parts.join(' — ') || 'Endereço não disponível';
}

function categoryLabel(tags: Record<string, string>): string {
  const shop = tags['shop'];
  const amenity = tags['amenity'];
  const leisure = tags['leisure'];
  const found = BUSINESS_TYPES.find(b =>
    b.value === shop || b.value === amenity || (b.value === 'gym' && leisure === 'fitness_centre')
  );
  if (found?.label) return found.label;
  if (shop) return shop.charAt(0).toUpperCase() + shop.slice(1);
  if (amenity) return amenity.charAt(0).toUpperCase() + amenity.slice(1);
  return 'Comércio';
}

export default function Radar() {
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(2000);
  const [type, setType] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    setError('');
    setPlaces([]);
    setSearched(false);

    try {
      // 1. Geocode
      const geoRes = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
      const geoData = await geoRes.json();
      if (!geoRes.ok || !Array.isArray(geoData) || geoData.length === 0) {
        setError('Endereço não encontrado. Inclua cidade e estado, ex: "Av. Dr. Nilo Peçanha, 2469, Porto Alegre, RS".');
        return;
      }
      const { lat, lon } = geoData[0];
      const qs = `lat=${lat}&lon=${lon}&radius=${radius}&type=${encodeURIComponent(type)}`;

      // 2. Try Google Places first; fall back to OSM Overpass
      let elements: Array<{ id: number | string; lat?: number; lon?: number; center?: { lat: number; lon: number }; source?: string; tags?: Record<string, string> }> = [];
      let dataSource: 'google' | 'osm' = 'osm';

      const googleRes = await fetch(`/api/places?${qs}`);
      if (googleRes.ok) {
        const gd = await googleRes.json();
        if (Array.isArray(gd.elements) && gd.elements.length > 0) {
          elements = gd.elements;
          dataSource = 'google';
        }
      }

      if (dataSource === 'osm') {
        const radarRes = await fetch(`/api/radar?${qs}`);
        const ovData = await radarRes.json();
        if (!radarRes.ok) {
          setError(`Erro ao buscar comércios: ${ovData.error ?? radarRes.status}. Tente novamente.`);
          return;
        }
        elements = ovData.elements ?? [];
      }

      // 3. Normalise to Place objects
      const seen = new Set<string>();
      const results: Place[] = [];

      for (const el of elements) {
        const tags = el.tags ?? {};
        const name = tags.name;
        if (!name) continue;
        const elat = el.lat ?? el.center?.lat;
        const elon = el.lon ?? el.center?.lon;
        if (elat == null || elon == null) continue;

        // Google already provides a full formatted address in addr:full
        const addr = tags['addr:full'] || buildAddress(tags);
        const key = `${name.toLowerCase()}|${addr}`;
        if (seen.has(key)) continue;
        seen.add(key);

        results.push({
          id: String(el.id),
          name,
          address: addr,
          phone: parseTag(tags, 'phone', 'contact:phone', 'contact:mobile'),
          website: parseTag(tags, 'website', 'contact:website', 'url'),
          email: parseTag(tags, 'email', 'contact:email'),
          instagram: socialUrl(parseTag(tags, 'contact:instagram', 'instagram'), 'https://instagram.com'),
          facebook: socialUrl(parseTag(tags, 'contact:facebook', 'facebook'), 'https://facebook.com'),
          hours: parseTag(tags, 'opening_hours'),
          brand: parseTag(tags, 'brand', 'operator'),
          cuisine: parseTag(tags, 'cuisine'),
          wheelchair: parseTag(tags, 'wheelchair'),
          rating: parseTag(tags, 'rating') || undefined,
          category: tags['category_label'] || categoryLabel(tags),
          source: (el.source as 'google') ?? dataSource,
          lat: elat,
          lon: elon,
        });
      }

      results.sort((a, b) => a.name.localeCompare(b.name));
      setPlaces(results);
      setSearched(true);

      // 4. For OSM results, fill missing addresses via reverse geocoding
      if (dataSource === 'osm') {
        const missing = results.filter(p => p.address === 'Endereço não disponível').slice(0, 12);
        for (const p of missing) {
          try {
            const r = await fetch(`/api/reverse?lat=${p.lat}&lon=${p.lon}`);
            if (r.ok) {
              const { address: addr } = await r.json();
              if (addr) setPlaces(prev => prev.map(x => x.id === p.id ? { ...x, address: addr } : x));
            }
          } catch { /* ignore */ }
          await new Promise(res => setTimeout(res, 1100));
        }
      }
    } catch (err) {
      setError('Erro inesperado: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const importAsClient = async (place: Place) => {
    setImporting(prev => new Set(prev).add(place.id));
    try {
      const notesLines = [
        'Importado do Radar',
        `Categoria: ${place.category}`,
        `Endereço: ${place.address}`,
        place.brand && `Marca/Rede: ${place.brand}`,
        place.cuisine && `Cozinha: ${place.cuisine}`,
        place.rating && `Avaliação: ${place.rating}`,
        place.hours && `Horário: ${place.hours}`,
        place.website && `Site: ${place.website}`,
        place.instagram && `Instagram: ${place.instagram}`,
        place.facebook && `Facebook: ${place.facebook}`,
        `Mapa: https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}`,
      ].filter(Boolean);
      await clientStore.create({
        name: place.name,
        email: place.email ?? '',
        phone: place.phone ?? '',
        company: place.brand ?? place.name,
        status: 'lead',
        notes: notesLines.join('\n'),
      });
      setPlaces(prev => prev.map(p => p.id === place.id ? { ...p, imported: true } : p));
    } catch (err) {
      alert('Erro ao importar: ' + (err as Error).message);
      setImporting(prev => { const s = new Set(prev); s.delete(place.id); return s; });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Radar de Comércios</h2>
        <p className="text-sm text-gray-500 mt-1">Encontre estabelecimentos próximos à sua loja e importe como leads.</p>
      </div>

      <form onSubmit={search} className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço da sua loja</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Ex: Rua das Flores, 123, São Paulo, SP"
                required
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raio de busca</label>
            <select
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RADIUS_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de negócio</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? 'Buscando...' : 'Buscar comércios'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{error}</div>
      )}

      {searched && !loading && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {places.length === 0
              ? 'Nenhum estabelecimento encontrado nessa área.'
              : `${places.length} estabelecimento${places.length > 1 ? 's' : ''} encontrado${places.length > 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {places.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {places.map(place => (
            <div key={place.id} className={`bg-white rounded-xl border p-4 flex flex-col gap-2 ${place.imported ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-snug">{place.name}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {place.category && (
                      <span className="inline-block text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{place.category}</span>
                    )}
                    {place.cuisine && (
                      <span className="inline-block text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">{place.cuisine}</span>
                    )}
                    {place.brand && (
                      <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{place.brand}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => !place.imported && importAsClient(place)}
                  disabled={place.imported || importing.has(place.id)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition
                    ${place.imported
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : importing.has(place.id)
                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {place.imported
                    ? <><Check size={12} /> Importado</>
                    : importing.has(place.id)
                      ? <><Loader2 size={12} className="animate-spin" /> ...</>
                      : <><UserPlus size={12} /> Importar</>
                  }
                </button>
              </div>

              <div className="space-y-1 mt-1">
                {place.rating && (
                  <p className="text-xs text-yellow-600 font-medium">{place.rating}</p>
                )}
                <p className="flex items-start gap-1.5 text-xs text-gray-500">
                  <MapPin size={12} className="mt-0.5 flex-shrink-0" />{place.address}
                </p>
                {place.phone && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone size={12} className="flex-shrink-0" />{place.phone}
                  </p>
                )}
                {place.email && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail size={12} className="flex-shrink-0" />
                    <a href={`mailto:${place.email}`} className="hover:underline truncate">{place.email}</a>
                  </p>
                )}
                {place.hours && (
                  <p className="flex items-start gap-1.5 text-xs text-gray-500">
                    <Clock size={12} className="mt-0.5 flex-shrink-0" /><span className="truncate">{place.hours}</span>
                  </p>
                )}
                {place.website && (
                  <p className="flex items-center gap-1.5 text-xs text-blue-500">
                    <Globe size={12} className="flex-shrink-0" />
                    <a href={place.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{place.website.replace(/^https?:\/\//, '')}</a>
                  </p>
                )}
                {(place.instagram || place.facebook || place.wheelchair === 'yes') && (
                  <div className="flex items-center gap-3 pt-0.5">
                    {place.instagram && (
                      <a href={place.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-pink-500 hover:text-pink-600" title="Instagram">
                        <AtSign size={14} /><span className="text-xs">Instagram</span>
                      </a>
                    )}
                    {place.facebook && (
                      <a href={place.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-blue-600 hover:text-blue-700" title="Facebook">
                        <Share2 size={14} /><span className="text-xs">Facebook</span>
                      </a>
                    )}
                    {place.wheelchair === 'yes' && (
                      <span className="text-green-600" title="Acessível para cadeirantes">
                        <Accessibility size={14} />
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-1">
                <a
                  href={`https://www.google.com/maps?q=${place.lat},${place.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  <Building2 size={11} /> Ver no mapa
                </a>
                <span className={`text-xs px-1.5 py-0.5 rounded ${place.source === 'google' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                  {place.source === 'google' ? 'Google' : 'OSM'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
