import { useState } from 'react';
import { Bike, Camera, MapPin } from 'lucide-react';
import { api, fmtDate, money, paymentLabels, statusLabels, type OpsOrder, type OpsUser, type OrderStatus } from '@/lib/operations-api';
import { Empty, Field, inputCls, btnDanger, btnPrimary, btnGhost } from './ui';

type Run = (key: string, fn: () => Promise<unknown>, ok: string) => Promise<boolean>;

const filters: Array<{ id: string; label: string; match: (s: OrderStatus) => boolean }> = [
  { id: 'active', label: 'Activos', match: (s) => s !== 'delivered' && s !== 'cancelled' },
  { id: 'ready', label: 'Listos', match: (s) => s === 'ready' },
  { id: 'done', label: 'Entregados', match: (s) => s === 'delivered' },
  { id: 'cancelled', label: 'Cancelados', match: (s) => s === 'cancelled' },
  { id: 'all', label: 'Todos', match: () => true },
];

export function OrderBoard({ orders, couriers, isAdmin, run, busy, onlyReady }: { orders: OpsOrder[]; couriers?: OpsUser[]; isAdmin: boolean; run: Run; busy: string | null; onlyReady?: boolean }) {
  const [filter, setFilter] = useState(onlyReady ? 'ready' : 'active');
  const f = filters.find((x) => x.id === filter)!;
  const list = [...orders].filter((o) => f.match(o.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar pedidos">
        {filters.map((x) => {
          const n = orders.filter((o) => x.match(o.status)).length;
          return <button key={x.id} role="tab" aria-selected={filter === x.id} onClick={() => setFilter(x.id)} data-testid={`button-order-filter-${x.id}`}
            className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-bold ${filter === x.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>{x.label} <span className="ml-1 font-mono-app">{n}</span></button>;
        })}
      </div>
      {list.length === 0 ? <Empty title="Nada por aquí" text="No hay pedidos en este filtro. La lista se actualiza cada 10 segundos." /> :
        list.map((o) => <OrderCard key={o.id} o={o} couriers={couriers} isAdmin={isAdmin} run={run} busy={busy} />)}
    </div>
  );
}

function OrderCard({ o, couriers, isAdmin, run, busy }: { o: OpsOrder; couriers?: OpsUser[]; isAdmin: boolean; run: Run; busy: string | null }) {
  const [courierDraft, setCourierDraft] = useState<string | null>(null);
  const courierValue = courierDraft ?? (o.deliveryPartnerUserId ?? '');
  const setStatus = (status: OrderStatus) => run(`status-${o.id}`, () => api(`/api/orders/${o.id}/status`, 'PATCH', { status }), `Pedido #${o.id}: ${statusLabels[status]}.`);
  const isBusy = busy === `status-${o.id}` || busy === `assign-${o.id}`;
  const subtotal = o.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const next: Array<{ s: OrderStatus; label: string }> = [];
  if (o.status === 'received') next.push({ s: 'preparing', label: 'Empezar preparación' });
  if (o.status === 'preparing') next.push({ s: 'ready', label: 'Marcar listo' });
  const canCancel = ['received', 'preparing', 'ready'].includes(o.status);
  const activeCouriers = (couriers ?? []).filter((c) => c.role === 'repartidor' && c.active);

  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5" data-testid={`card-order-${o.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-app text-[10px] uppercase tracking-wide text-accent">Pedido #{o.id} · {fmtDate(o.createdAt)}</p>
          <h3 className="mt-1 font-display text-lg font-bold">{o.customerName}</h3>
          <p className="text-xs text-muted-foreground">{o.restaurantName}</p>
        </div>
        <span className="rounded-full bg-secondary/50 px-3 py-1 text-xs font-bold" data-testid={`status-order-${o.id}`}>{statusLabels[o.status]}</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-xl bg-muted/40 p-3">
          <ul className="space-y-1 text-sm">
            {o.items.map((i) => <li key={i.id} className="flex justify-between gap-3"><span>{i.quantity} × {i.name} <span className="font-mono-app text-[11px] text-muted-foreground">({money(i.price)})</span></span><span className="font-mono-app">{money(i.price * i.quantity)}</span></li>)}
          </ul>
          <div className="mt-2 space-y-0.5 border-t border-border pt-2 font-mono-app text-xs">
            <p className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></p>
            <p className="flex justify-between"><span>Delivery</span><span>{money(o.deliveryFee)}</span></p>
            <p className="flex justify-between text-sm font-bold"><span>Total</span><span>{money(o.total)}</span></p>
          </div>
        </div>
        <dl className="space-y-2 text-xs">
          <div className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-accent" /><div><dt className="sr-only">Dirección</dt><dd>{o.deliveryAddress || 'Sin dirección'}</dd></div></div>
          <div><dt className="inline font-bold">Método de pago declarado: </dt><dd className="inline">{paymentLabels[o.paymentMethod]} · cobro no verificado</dd></div>
          <div className="flex gap-2"><Bike className="h-4 w-4 shrink-0 text-accent" /><dd>{o.deliveryPartnerName ? `${o.deliveryPartnerName}${o.deliveryPartnerEmail ? ` · ${o.deliveryPartnerEmail}` : ''}` : 'Sin repartidor asignado'}</dd></div>
          {o.deliveredAt && <div><dt className="inline font-bold">Entregado: </dt><dd className="inline">{fmtDate(o.deliveredAt)}</dd></div>}
          {o.customerPhone&&<a className="flex min-h-11 items-center font-bold underline" href={`tel:${o.customerPhone.replace(/[^\d+]/g,'')}`}>Llamar al cliente</a>}
          {o.deliveryPartnerPhone&&<a className="flex min-h-11 items-center font-bold underline" href={`tel:${o.deliveryPartnerPhone.replace(/[^\d+]/g,'')}`}>Llamar al repartidor</a>}
        </dl>
      </div>
      {o.status === 'delivered' && o.proofUrl && (
        <a href={o.proofUrl} target="_blank" rel="noopener noreferrer" className={`${btnGhost} mt-4`} data-testid={`button-order-proof-${o.id}`} aria-label={`Ver foto de entrega del pedido #${o.id} (abre en otra pestaña)`}>
          <Camera className="h-4 w-4" /> Ver foto de entrega
        </a>
      )}
      {isAdmin && o.status === 'ready' && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1"><Field label="Asignar repartidor">
            <select className={inputCls} value={courierValue} onChange={(e) => setCourierDraft(e.target.value)} data-testid={`select-order-courier-${o.id}`}>
              <option value="">Sin asignar</option>
              {activeCouriers.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </Field></div>
          <button className={btnGhost} disabled={isBusy || courierDraft === null} data-testid={`button-order-assign-${o.id}`}
            onClick={async () => { if (await run(`assign-${o.id}`, () => api(`/api/orders/${o.id}/assignment`, 'PUT', { courierId: courierValue ? Number(courierValue) : null }), `Asignación del pedido #${o.id} guardada.`)) setCourierDraft(null); }}>
            Guardar asignación
          </button>
        </div>
      )}
      {(next.length > 0 || canCancel) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {next.map((n) => <button key={n.s} className={btnPrimary} disabled={isBusy || (n.s === 'on_the_way' && !o.deliveryPartnerUserId)} onClick={() => void setStatus(n.s)} data-testid={`button-order-${n.s}-${o.id}`}>{n.label}</button>)}
          {canCancel && <button className={btnDanger} disabled={isBusy} onClick={() => { if (window.confirm(`¿Cancelar el pedido #${o.id}?`)) void setStatus('cancelled'); }} data-testid={`button-order-cancel-${o.id}`}>Cancelar pedido</button>}
          {isAdmin && o.status === 'ready' && <p className="self-center text-[11px] text-muted-foreground">{o.deliveryPartnerUserId ? 'El repartidor inicia el viaje desde su panel al compartir su ubicación.' : 'Asigna un repartidor para que recoja el pedido e inicie el viaje.'}</p>}
        </div>
      )}
    </article>
  );
}
