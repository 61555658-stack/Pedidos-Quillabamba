import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, CheckCircle2, Crosshair, Navigation, RefreshCw, Route, SignalLow } from 'lucide-react';
import { useGetCourierLocation, getGetCourierLocationQueryKey } from '@workspace/api-client-react';
import type { Order, CourierLocation } from '@workspace/api-client-react';

const CENTER: [number, number] = [-12.8629, -72.6934];
export const FRESH_MS = 120_000;
const ROUTE_THROTTLE_MS = 30_000;
const ROUTE_TIMEOUT_MS = 8_000;

/** Edad en ms de una ubicación; null si la fecha no es válida. */
export function locationAgeMs(updatedAt: string | undefined, now: number): number | null {
  if (!updatedAt) return null;
  const t = Date.parse(updatedAt);
  return Number.isFinite(t) ? Math.max(0, now - t) : null;
}
export function isLocationFresh(loc: CourierLocation | undefined | null, now: number): boolean {
  if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) return false;
  const age = locationAgeMs(loc.updatedAt, now);
  return age !== null && age <= FRESH_MS;
}

type RouteState = { kind: 'idle' | 'loading' | 'error' } | { kind: 'ok'; coords: [number, number][]; meters: number; seconds: number };

const bikeSvg = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M15 6h2l3 11"/><path d="M5.5 17 9 9h6l-3.5 8"/><path d="M8 6h3"/></svg>`;
const courierIcon = L.divIcon({
  className: 'qy-courier',
  html: `<div role="img" aria-label="Repartidor en vivo" style="position:relative;width:46px;height:46px"><span style="position:absolute;inset:-6px;border-radius:999px;background:hsl(34 81% 57% / .28);animation:pulse-soft 1.8s ease-in-out infinite"></span><div style="position:relative;width:46px;height:46px;border-radius:999px;background:hsl(266 76% 40%);color:hsl(34 81% 62%);display:grid;place-items:center;border:3px solid hsl(38 45% 99%);box-shadow:0 6px 16px hsl(263 36% 20% / .4)">${bikeSvg}</div></div>`,
  iconSize: [46, 46], iconAnchor: [23, 23],
});
const destIcon = L.divIcon({
  className: 'qy-dest',
  html: '<div role="img" aria-label="Punto de entrega" style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:hsl(15 69% 52%);border:3px solid hsl(38 45% 99%);box-shadow:0 5px 12px hsl(263 36% 20% / .35);display:grid;place-items:center"><span style="width:10px;height:10px;border-radius:99px;background:hsl(38 45% 99%)"></span></div>',
  iconSize: [34, 34], iconAnchor: [17, 34],
});

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const kmLabel = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const minLabel = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

export function OrderTrackingMap({ order }: { order: Order }) {
  const terminal = order.status === 'delivered' || order.status === 'cancelled';
  const assigned = !!order.deliveryPartnerUserId;
  const activeAssigned = assigned && (order.status === 'ready' || order.status === 'on_the_way');
  const dest = order.deliveryLocation;
  const destLat = dest?.latitude, destLng = dest?.longitude;

  const loc = useGetCourierLocation(order.id, { query: { queryKey: [...getGetCourierLocationQueryKey(order.id), order.deliveryPartnerUserId], enabled: activeAssigned, refetchInterval: 4000, retry: false, refetchOnWindowFocus: true, staleTime: 0, refetchOnMount: 'always' } });
  const [now, setNow] = useState(() => Date.now());
  const [route, setRoute] = useState<RouteState>({ kind: 'idle' });
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeRetry, setRouteRetry] = useState(0);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const courierMk = useRef<L.Marker | null>(null);
  const destMk = useRef<L.Marker | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const fitKey = useRef<string>('');
  const routeCtl = useRef<AbortController | null>(null);
  const lastRouteAt = useRef(0);

  useEffect(() => { if (!activeAssigned) return; const t = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(t); }, [activeAssigned]);
  useEffect(() => { setNow(Date.now()); }, [loc.dataUpdatedAt]);

  const data = activeAssigned && !loc.isError ? loc.data : undefined;
  const fresh = isLocationFresh(data, now);
  const cLat = fresh ? data!.latitude : undefined, cLng = fresh ? data!.longitude : undefined;
  const errStatus = (loc.error as { status?: number } | null)?.status;
  const phase = !assigned ? 'waiting' : fresh ? 'live' : loc.isLoading ? 'loading' : data || errStatus === 404 ? 'stale' : loc.isError ? 'error' : 'stale';

  // Map lifecycle: container always mounted while not terminal.
  useEffect(() => {
    if (terminal || !mapEl.current) return;
    const el = mapEl.current;
    let map: L.Map;
    try {
      map = L.map(el, { center: destLat !== undefined ? [destLat, destLng!] : CENTER, zoom: 15, zoomControl: true });
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
      let errs = 0;
      tiles.on('tileerror', () => { if (++errs > 6) setMapError('El mapa base no cargó. Revisa tu conexión.'); });
      tiles.on('tileload', () => { errs = 0; setMapError(null); });
    } catch { setMapError('No se pudo abrir el mapa.'); return; }
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; courierMk.current = null; destMk.current = null; lineRef.current = null; fitKey.current = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminal, order.id]);

  // Destination marker
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (destLat === undefined || destLng === undefined) { destMk.current?.remove(); destMk.current = null; return; }
    if (!destMk.current) destMk.current = L.marker([destLat, destLng], { icon: destIcon, title: 'Punto de entrega', alt: 'Punto de entrega', keyboard: false, zIndexOffset: 100 }).addTo(map);
    else destMk.current.setLatLng([destLat, destLng]);
  }, [destLat, destLng, terminal, order.id]);

  // Courier marker (only fresh)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (cLat === undefined || cLng === undefined) { courierMk.current?.remove(); courierMk.current = null; return; }
    if (!courierMk.current) courierMk.current = L.marker([cLat, cLng], { icon: courierIcon, title: 'Repartidor', alt: 'Repartidor', keyboard: false, zIndexOffset: 500 }).addTo(map);
    else courierMk.current.setLatLng([cLat, cLng]);
  }, [cLat, cLng, terminal, order.id]);

  const fitAll = () => {
    const map = mapRef.current; if (!map) return;
    const pts: [number, number][] = [];
    if (cLat !== undefined && cLng !== undefined) pts.push([cLat, cLng]);
    if (destLat !== undefined && destLng !== undefined) pts.push([destLat, destLng]);
    if (route.kind === 'ok') pts.push(...route.coords);
    if (pts.length === 1) map.setView(pts[0], 16);
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 17 });
  };
  const fitRef = useRef(fitAll); fitRef.current = fitAll;

  // Fit once per phase (not every poll)
  useEffect(() => {
    if (!mapRef.current) return;
    const key = `${order.id}:${order.status}:${phase}`;
    if (fitKey.current === key) return;
    fitKey.current = key;
    fitRef.current();
  }, [order.id, order.status, phase, terminal]);

  // Abort route on order/status change
  useEffect(() => () => { routeCtl.current?.abort(); routeCtl.current = null; lastRouteAt.current = 0; setRoute({ kind: 'idle' }); }, [order.id, order.status, activeAssigned, order.deliveryPartnerUserId]);
  useEffect(() => { if (!fresh) { routeCtl.current?.abort(); routeCtl.current = null; lastRouteAt.current = 0; setRoute({ kind: 'idle' }); } }, [fresh]);

  // Fetch road route (throttled)
  useEffect(() => {
    if (cLat === undefined || cLng === undefined || destLat === undefined || destLng === undefined) return;
    if (routeCtl.current || Date.now() - lastRouteAt.current < ROUTE_THROTTLE_MS) return;
    lastRouteAt.current = Date.now();
    const ctl = new AbortController(); routeCtl.current = ctl;
    const timer = window.setTimeout(() => ctl.abort(), ROUTE_TIMEOUT_MS);
    setRoute((r) => (r.kind === 'ok' ? r : { kind: 'loading' }));
    fetch(`https://router.project-osrm.org/route/v1/driving/${cLng},${cLat};${destLng},${destLat}?overview=full&geometries=geojson`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('route'))))
      .then((j: { code?: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] }) => {
        const best = j.code === 'Ok' ? j.routes?.[0] : undefined;
        if (!best || !best.geometry?.coordinates?.length) throw new Error('route');
        if (routeCtl.current === ctl) setRoute({ kind: 'ok', coords: best.geometry.coordinates.map(([lng, lat]) => [lat, lng]), meters: best.distance, seconds: best.duration });
      })
      .catch(() => { if (routeCtl.current === ctl || ctl.signal.aborted) { if (routeCtl.current === ctl) setRoute({ kind: 'error' }); } })
      .finally(() => { window.clearTimeout(timer); if (routeCtl.current === ctl) routeCtl.current = null; });
  }, [cLat, cLng, destLat, destLng, routeRetry, Math.floor(now / ROUTE_THROTTLE_MS), order.id, order.status]);

  // Route polyline
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    lineRef.current?.remove(); lineRef.current = null;
    if (route.kind === 'ok' && fresh) {
      lineRef.current = L.polyline(route.coords, { color: 'hsl(266 76% 40%)', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      lineRef.current.bringToBack();
    }
  }, [route, fresh, terminal, order.id]);

  const retryRoute = () => { lastRouteAt.current = 0; routeCtl.current?.abort(); routeCtl.current = null; setRoute({ kind: 'idle' }); setRouteRetry(value => value + 1); void loc.refetch(); };
  const ageS = useMemo(() => { const a = locationAgeMs(data?.updatedAt, now); return a === null ? null : Math.round(a / 1000); }, [data?.updatedAt, now]);

  if (terminal) {
    if (order.status === 'cancelled') return null;
    return (
      <section data-testid="tracking-panel" className="mt-5 flex items-center gap-3 rounded-2xl bg-card p-5 ring-1 ring-border">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
        <p data-testid="tracking-status" className="text-sm font-bold text-primary">Entrega completada. El seguimiento en vivo terminó.</p>
      </section>
    );
  }

  const name = order.deliveryPartnerName || 'Tu repartidor';
  const status = !assigned
    ? { title: 'Esperando repartidor', body: 'Cuando un repartidor acepte tu pedido verás su ubicación real aquí.', tone: 'wait' }
    : phase === 'live'
      ? { title: order.status === 'on_the_way' ? `${name} en camino` : `Repartidor asignado: ${name}`, body: `Ubicación actualizada ${timeLabel(data!.updatedAt)}${ageS !== null ? ` (hace ${ageS} s)` : ''} · precisión aprox. ${Math.round(data!.accuracy)} m`, tone: 'live' }
      : phase === 'loading'
        ? { title: 'Esperando ubicación', body: `Conectando con el GPS de ${name}.`, tone: 'wait' }
        : phase === 'error'
          ? { title: 'Sin señal reciente', body: 'No pudimos consultar la ubicación del repartidor.', tone: 'warn' }
          : { title: data ? 'Sin señal reciente' : 'Esperando ubicación', body: data ? `Última señal ${timeLabel(data.updatedAt)}. No se muestra como ubicación en vivo.` : `${name} aún no comparte su GPS.`, tone: 'warn' };
  const showRetry = assigned && phase !== 'live' && phase !== 'loading';

  return (
    <section data-testid="tracking-panel" className="mt-5 min-w-0 overflow-hidden rounded-2xl bg-card ring-1 ring-border animate-rise">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.16em] text-accent">Mapa de seguimiento</p>
          <div data-testid="tracking-status" role="status" aria-live="polite" className="mt-1.5">
            <p className="flex items-center gap-2 font-display text-lg font-bold text-primary">
              {status.tone === 'live' ? <span className="relative flex h-2.5 w-2.5"><span className="absolute inset-0 animate-ping rounded-full bg-secondary" /><span className="relative h-2.5 w-2.5 rounded-full bg-secondary" /></span> : status.tone === 'warn' ? <SignalLow className="h-4 w-4 text-accent" /> : <Navigation className="h-4 w-4 text-muted-foreground" />}
              {status.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{status.body}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {showRetry && <button type="button" onClick={() => loc.refetch()} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-muted px-3 text-xs font-bold text-primary" data-testid="tracking-retry"><RefreshCw className={`h-3.5 w-3.5 ${loc.isFetching ? 'animate-spin' : ''}`} /> Reintentar</button>}
          <button type="button" onClick={fitAll} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground" data-testid="tracking-recenter" aria-label="Centrar mapa en repartidor y entrega"><Crosshair className="h-3.5 w-3.5" /> Centrar</button>
        </div>
      </header>

      <div className="relative isolate z-0">
        <div ref={mapEl} data-testid="tracking-map" aria-label="Mapa con la ubicación del repartidor y el punto de entrega" className="h-[340px] w-full bg-muted sm:h-[420px]" />
        {!assigned && (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl bg-card/95 px-3 py-2 text-center text-xs font-bold text-primary shadow">Esperando que un repartidor acepte el pedido</div>
        )}
        {assigned && phase !== 'live' && (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] rounded-xl bg-card/95 px-3 py-2 text-center text-xs font-bold text-primary shadow">{status.title}: el repartidor no se muestra hasta recibir GPS actual</div>
        )}
        {mapError && <p role="alert" className="absolute inset-x-3 bottom-3 z-[500] flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 ring-1 ring-red-200"><AlertTriangle className="h-4 w-4 shrink-0" />{mapError}</p>}
      </div>

      <footer className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div data-testid="tracking-route-state" className="min-w-0 text-xs">
          {!dest ? (
            <p className="flex gap-2 font-semibold text-accent"><AlertTriangle className="h-4 w-4 shrink-0" />Este pedido no tiene ubicación de entrega en el mapa. Se usará la dirección escrita{order.deliveryAddress ? `: ${order.deliveryAddress}` : ''}.</p>
          ) : phase !== 'live' ? (
            <p className="text-muted-foreground">La ruta se calculará cuando haya una ubicación actual del repartidor.</p>
          ) : route.kind === 'ok' ? (
             order.status === 'ready' ? <p className="text-muted-foreground">Ruta de referencia hacia tu entrega. El repartidor está recogiendo el pedido; el tiempo aproximado se mostrará cuando inicie el reparto.</p> :
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="flex items-center gap-1.5 font-bold text-primary"><Route className="h-4 w-4" />Ruta por calles</span>
              <span><span className="font-mono-app text-sm font-bold text-primary">{kmLabel(route.meters)}</span> <span className="text-muted-foreground">restantes</span></span>
              <span><span className="font-mono-app text-sm font-bold text-primary">{minLabel(route.seconds)}</span> <span className="text-muted-foreground">tiempo aproximado</span></span>
            </div>
          ) : route.kind === 'error' ? (
            <p className="flex flex-wrap items-center gap-2 font-semibold text-accent"><AlertTriangle className="h-4 w-4 shrink-0" />Ruta no disponible. Las ubicaciones en el mapa siguen siendo reales.
              <button type="button" onClick={retryRoute} className="min-h-9 rounded-lg bg-muted px-3 font-bold text-primary" data-testid="tracking-route-retry">Reintentar ruta</button></p>
          ) : (
            <p className="text-muted-foreground animate-pulse-soft">Calculando ruta por calles...</p>
          )}
          {phase === 'live' && dest && <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Para calcular la ruta por calles, tu GPS y el punto de entrega se comparten con el servicio público de rutas OSRM.</p>}
        </div>
        <ul className="flex gap-4 text-[11px] font-semibold text-muted-foreground">
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-primary ring-2 ring-secondary" />Repartidor</li>
          <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-accent" />Entrega</li>
        </ul>
      </footer>
    </section>
  );
}
