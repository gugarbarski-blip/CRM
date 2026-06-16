import { useState } from 'react';
import { MapPin, Search, UserPlus, Building2, Phone, Globe, Check, Loader2 } from 'lucide-react';
import { clientStore } from '../lib/store';

interface Place {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  category?: string;
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
];

const RADIUS_OPTIONS = [
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

// Build Overpass query based on business type filter
function buildOverpassQuery(lat: number, lon: number, radius: number, type: string): string {
  let filter = '';
  if (type === '') {
    // Any named shop or amenity
    filter = `
      node["shop"]["name"](around:${radius},${lat},${lon});
      node["amenity"]["name"](around:${radius},${lat},${lon});
      node["tourism"]["name"](around:${radius},${lat},${lon});
    `;
  } else if (['restaurant','cafe','bar','pharmacy','clinic','school','hotel'].includes(type)) {
    filter = `node["amenity"="${type}"]["name"](around:${radius},${lat},${lon});`;
  } else if (type === 'gym') {
    filter = `node["leisure"="fitness_centre"]["name"](around:${radius},${lat},${lon});`;
  } else {
    filter = `node["shop"="${type}"]["name"](around:${radius},${lat},${lon});`;
  }
  return `[out:json][timeout:25];(${filter});out body;`;
}

function parseTag(tags: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (tags[key]) return tags[key];
  }
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
      // 1. Geocode the address using Nominatim
      let geoData: { lat: string; lon: string }[] = [];
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`,
          {
            headers: {
              'Accept-Language': 'pt-BR',
              'User-Agent': 'CRM-App/1.0',
            },
          }
        );
        geoData = await geoRes.json();
      } catch {
        setError('Não foi possível acessar o serviço de geocodificação. Verifique sua conexão com a internet.');
        return;
      }

      if (!geoData.length) {
        setError('Endereço não encontrado. Tente incluir cidade e estado, ex: "Av. Dr. Nilo Peçanha, 2469, Porto Alegre, RS".');
        return;
      }
      const { lat, lon } = geoData[0];

      // 2. Search nearby places via Overpass API (try multiple endpoints)
      const query = buildOverpassQuery(parseFloat(lat), parseFloat(lon), radius, type);
      const OVERPASS_ENDPOINTS = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
      ];

      let ovData: { elements?: unknown[] } | null = null;
      let lastErr = '';
      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          const ovRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`,
          });
          if (!ovRes.ok) { lastErr = `HTTP ${ovRes.status}`; continue; }
          ovData = await ovRes.json();
          break;
        } catch (err) {
          lastErr = (err as Error).message;
        }
      }

      if (!ovData) {
        setError(`Serviço de busca temporariamente indisponível (${lastErr}). Tente novamente em alguns instantes.`);
        return;
      }

      // 3. Map to Place objects, deduplicate by name+address
      const seen = new Set<string>();
      const results: Place[] = [];
      for (const el of (ovData.elements ?? []) as Array<{ id: number; lat: number; lon: number; tags?: Record<string, string> }>) {
        const name = el.tags?.name;
        if (!name) continue;
        const addr = buildAddress(el.tags ?? {});
        const key = `${name.toLowerCase()}|${addr}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({
          id: String(el.id),
          name,
          address: addr,
          phone: parseTag(el.tags ?? {}, 'phone', 'contact:phone'),
          website: parseTag(el.tags ?? {}, 'website', 'contact:website', 'url'),
          category: categoryLabel(el.tags ?? {}),
          lat: el.lat,
          lon: el.lon,
        });
      }
      results.sort((a, b) => a.name.localeCompare(b.name));
      setPlaces(results);
      setSearched(true);
    } catch (err) {
      setError('Erro inesperado: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const importAsClient = async (place: Place) => {
    setImporting(prev => new Set(prev).add(place.id));
    try {
      await clientStore.create({
        name: place.name,
        email: '',
        phone: place.phone ?? '',
        company: place.name,
        status: 'lead',
        notes: `Importado do Radar\nCategoria: ${place.category}\nEndereço: ${place.address}${place.website ? `\nSite: ${place.website}` : ''}`,
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
                  {place.category && (
                    <span className="inline-block mt-0.5 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{place.category}</span>
                  )}
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
                <p className="flex items-start gap-1.5 text-xs text-gray-500">
                  <MapPin size={12} className="mt-0.5 flex-shrink-0" />{place.address}
                </p>
                {place.phone && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Phone size={12} className="flex-shrink-0" />{place.phone}
                  </p>
                )}
                {place.website && (
                  <p className="flex items-center gap-1.5 text-xs text-blue-500">
                    <Globe size={12} className="flex-shrink-0" />
                    <a href={place.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">{place.website.replace(/^https?:\/\//, '')}</a>
                  </p>
                )}
              </div>

              <a
                href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=17/${place.lat}/${place.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-1"
              >
                <Building2 size={11} /> Ver no mapa
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
