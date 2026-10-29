import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Check, Crosshair, ExternalLink, Loader2, MapPin, Map as MapIcon } from 'lucide-react';
import type { DeliveryLocation } from '@workspace/api-client-react';

const CENTER: [number, number] = [-12.8629, -72.6934];

type Mode = 'none' | 'gps' | 'map';
type Props = { value: DeliveryLocation | null; onChange: (location: DeliveryLocation | null) => void; disabled?: boolean };

const pinIcon = L.divIcon({
  className: 'qy-pin',
  html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:hsl(266 76% 40%);border:3px solid hsl(38 45% 99%);box-shadow:0 4px 10px hsl(263 36% 20% / .35)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

function gpsErrorText(err: GeolocationPositionError | null): string {
  if (!err) return 'Este navegador no permite obtener tu ubicación. Selecciónala en el mapa.';
  if (err.code === err.PERMISSION_DENIED) return 'Permiso de ubicación denegado. Actívalo en tu navegador o selecciona tu ubicación en el mapa.';
  if (err.code === err.POSITION_UNAVAILABLE) return 'Tu dispositivo no pudo determinar la ubicación. Intenta de nuevo o selecciónala en el mapa.';
  if (err.code === err.TIMEOUT) return 'La ubicación tardó demasiado en llegar. Intenta de nuevo o selecciónala en el mapa.';
  return 'No se pudo obtener tu ubicación. Selecciónala en el mapa.';
}

const fmt = (n: number) => n.toFixed(6);

export function DeliveryLocationPicker({ value, onChange, disabled = false }: Props) {
  const [mode, setMode] = useState<Mode>(value ? (value.source === 'gps' ? 'gps' : 'map') : 'none');
  const [gpsPending, setGpsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number] | null>(value?.source === 'map' ? [value.latitude, value.longitude] : null);
  const [mapError, setMapError] = useState<string | null>(null);

  const tokenRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Unmount: invalidate GPS.
  useEffect(() => () => { tokenRef.current++; }, []);

  // Disabled: invalidate pending GPS.
  useEffect(() => {
    if (disabled) { tokenRef.current++; setGpsPending(false); }
  }, [disabled]);

  const setDraftFromUser = useCallback((lat: number, lng: number) => {
    if (disabledRef.current) return;
    const point = L.latLng(lat, lng).wrap();
    setDraft([point.lat, point.lng]);
    onChangeRef.current(null);
  }, []);

  // Map lifecycle
  useEffect(() => {
    if (mode !== 'map' || !mapEl.current) return;
    let map: L.Map;
    try {
      map = L.map(mapEl.current, { center: draft ?? CENTER, zoom: draft ? 17 : 15, zoomControl: true, tap: true } as L.MapOptions);
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(map);
      let tileErrors = 0, tileLoads = 0;
      tiles.on('loading', () => { tileErrors = 0; tileLoads = 0; });
      tiles.on('tileload', () => { tileLoads++; });
      tiles.on('tileerror', () => { tileErrors++; if (tileErrors > 4) setMapError('El mapa no cargó correctamente. Revisa tu conexión o usa tu ubicación exacta.'); });
      tiles.on('load', () => {
        setMapError(tileErrors > 0 && tileLoads === 0
          ? 'El mapa no cargó correctamente. Revisa tu conexión o usa tu ubicación exacta.' : null);
      });
    } catch {
      setMapError('No se pudo abrir el mapa. Revisa tu conexión o usa tu ubicación exacta.');
      return;
    }
    mapRef.current = map;
    map.on('click', (e: L.LeafletMouseEvent) => setDraftFromUser(e.latlng.lat, e.latlng.lng));
    const t = window.setTimeout(() => map.invalidateSize(), 60);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, setDraftFromUser]);

  // Marker sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!draft) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (!markerRef.current) {
      const m = L.marker(draft, { icon: pinIcon, draggable: !disabled, keyboard: false }).addTo(map);
      m.on('dragend', () => { const p = m.getLatLng(); setDraftFromUser(p.lat, p.lng); });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng(draft);
    }
  }, [draft, mode, disabled, setDraftFromUser]);

  // Disabled locks map interactions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom, map.boxZoom, map.keyboard];
    handlers.forEach((h) => (disabled ? h?.disable() : h?.enable()));
    const m = markerRef.current;
    if (m?.dragging) (disabled ? m.dragging.disable() : m.dragging.enable());
  }, [disabled, mode, draft]);

  const requestGps = () => {
    if (disabled) return;
    const token = ++tokenRef.current;
    setMode('gps');
    setError(null);
    onChange(null);
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      setError(gpsErrorText(null));
      return;
    }
    setGpsPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (token !== tokenRef.current || disabledRef.current) return;
        setGpsPending(false);
        const acc = Number.isFinite(pos.coords.accuracy) && pos.coords.accuracy >= 0 ? pos.coords.accuracy : undefined;
        onChangeRef.current({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, source: 'gps', ...(acc !== undefined ? { accuracy: acc } : {}) });
      },
      (err) => {
        if (token !== tokenRef.current) return;
        setGpsPending(false);
        setError(gpsErrorText(err));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  };

  const chooseMap = (seed?: [number, number]) => {
    if (disabled) return;
    tokenRef.current++;
    setGpsPending(false);
    setError(null);
    setMode('map');
    setDraft(seed ?? null);
    onChange(null);
  };

  const confirmDraft = () => {
    if (disabled || !draft || mapError) return;
    onChange({ latitude: draft[0], longitude: draft[1], source: 'map' });
  };

  const confirmed = value;
  const draftMatches = !!(draft && value && value.source === 'map' && value.latitude === draft[0] && value.longitude === draft[1]);

  const optCls = (on: boolean) =>
    `group flex min-h-[68px] w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${on ? 'border-primary bg-primary/[.06]' : 'border-border bg-card hover:border-primary/40'}`;

  return (
    <div className="grid min-w-0 gap-3" data-testid="delivery-location-picker">
      <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Punto de entrega</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={requestGps} disabled={disabled || gpsPending} className={optCls(mode === 'gps')} data-testid="button-location-gps" aria-pressed={mode === 'gps'}>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${mode === 'gps' ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary'}`}>
            {gpsPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crosshair className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold">Usar mi ubicación exacta</span>
            <span className="block text-[11px] text-muted-foreground">{gpsPending ? 'Buscando señal GPS...' : 'Tu teléfono pedirá permiso'}</span>
          </span>
        </button>
        <button type="button" onClick={() => chooseMap()} disabled={disabled} className={optCls(mode === 'map')} data-testid="button-location-map" aria-pressed={mode === 'map'}>
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${mode === 'map' ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary'}`}>
            <MapIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold">Seleccionar ubicación</span>
            <span className="block text-[11px] text-muted-foreground">Marca tu puerta en el mapa</span>
          </span>
        </button>
      </div>

      {error && (
        <div role="alert" data-testid="status-location-error" className="flex flex-col gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-800 ring-1 ring-red-200 animate-rise">
          <span className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={requestGps} disabled={disabled} className="min-h-9 rounded-lg border border-red-200 bg-card px-3 font-bold text-red-700 disabled:opacity-50" data-testid="button-location-gps-retry">Reintentar</button>
            <button type="button" onClick={() => chooseMap()} disabled={disabled} className="min-h-9 rounded-lg bg-primary px-3 font-bold text-primary-foreground disabled:opacity-50" data-testid="button-location-error-map">Elegir en el mapa</button>
          </div>
        </div>
      )}

      {mode === 'map' && (
        <div className="grid gap-2 animate-rise">
          <div className="relative isolate z-0 overflow-hidden rounded-2xl ring-1 ring-border">
            <div ref={mapEl} data-testid="map-delivery-location" aria-label="Mapa para elegir el punto de entrega" className="h-[300px] w-full bg-muted sm:h-[340px]" style={{ touchAction: 'none' }} />
            {!draft && !mapError && (
              <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl bg-card/95 px-3 py-2 text-center text-xs font-bold text-primary shadow">
                Toca el mapa donde quieres recibir tu pedido
              </div>
            )}
            {disabled && <div className="absolute inset-0 z-[600] bg-background/40" aria-hidden />}
          </div>
          {mapError && (
            <p role="alert" data-testid="status-map-error" className="flex gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-xs font-semibold text-red-800 ring-1 ring-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />{mapError}
            </p>
          )}
          {draft && !draftMatches && (
            <div className="flex flex-col gap-2 rounded-xl bg-secondary/20 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-foreground">
                <span className="font-bold">Punto marcado sin confirmar.</span> Arrastra el pin para ajustarlo.
                <span className="block font-mono-app text-[11px] text-muted-foreground" data-testid="text-location-draft">{fmt(draft[0])}, {fmt(draft[1])}</span>
              </span>
              <button type="button" onClick={confirmDraft} disabled={disabled || !!mapError} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-location-confirm">
                <Check className="h-4 w-4" /> Usar esta ubicación
              </button>
            </div>
          )}
        </div>
      )}

      {confirmed && (
        <div data-testid="status-location-selected" className="flex items-start gap-3 rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground animate-rise">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-foreground/15"><MapPin className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold">{confirmed.source === 'gps' ? 'Ubicación del GPS confirmada' : 'Ubicación del mapa confirmada'}</p>
            <p className="font-mono-app text-[11px] opacity-85" data-testid="text-location-coords">{fmt(confirmed.latitude)}, {fmt(confirmed.longitude)}</p>
            {confirmed.source === 'gps' && (
              <p className="mt-0.5 text-[11px] opacity-85" data-testid="text-location-accuracy">
                {confirmed.accuracy !== undefined ? `Precisión reportada por tu teléfono: aprox. ${Math.round(confirmed.accuracy)} m` : 'Tu teléfono no reportó la precisión'}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`https://www.google.com/maps?q=${confirmed.latitude},${confirmed.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-3 text-[11px] font-bold" data-testid="link-location-preview">
                Ver en Google Maps <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {confirmed.source === 'gps' && (
                <button type="button" disabled={disabled} onClick={() => chooseMap([confirmed.latitude, confirmed.longitude])} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary-foreground/15 px-3 text-[11px] font-bold disabled:opacity-50" data-testid="button-location-adjust">
                  Ajustar en el mapa
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
