import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Bike, KeyRound, LogOut, Send } from 'lucide-react';
import {
  getGetCashierStateQueryKey, useCloseOwnCashShift, useGetCashierState, useReleaseCashierOrder, type Order,
} from '@workspace/api-client-react';
import { clearSession } from '@/pages/role-access';
import { Banner, Empty, LoadError, Skeleton, btnGhost, btnPrimary, inputCls } from '@/components/ops/ui';
import { money, paymentLabels, statusLabels } from '@/lib/operations-api';
import { errStatus, errText, limaTime, shiftLabel } from '@/lib/cash-format';

const releasable = ['received', 'preparing', 'ready'];

function OrderCard({ order, couriers, busy, onRelease }: { order: Order; couriers: { id: number; name: string }[]; busy: boolean; onRelease: (courierId: number | null) => void }) {
  const [courier, setCourier] = useState('');
  const canAct = releasable.includes(order.status) && !order.deliveryPartnerName;
  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-border animate-rise">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono-app text-[10px] uppercase tracking-[.14em] text-muted-foreground">Pedido #{order.id} · {limaTime(order.createdAt)}</p>
          <p className="mt-1 font-display text-lg font-bold">{order.customerName}</p>
          {order.deliveryAddress && <p className="text-xs text-muted-foreground">{order.deliveryAddress}</p>}
        </div>
        <span className="rounded-full bg-secondary/50 px-2.5 py-1 text-[11px] font-bold">{statusLabels[order.status]}</span>
      </div>
      <ul className="mt-3 divide-y divide-border/70 text-sm">
        {order.items.map((it) => <li key={it.id} className="flex justify-between gap-2 py-1.5"><span><b className="font-mono-app">{it.quantity}x</b> {it.name}</span><span className="font-mono-app">{money(it.price * it.quantity)}</span></li>)}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs">
        <span>Pago declarado: <b>{paymentLabels[order.paymentMethod]}</b> <span className="text-muted-foreground">(no verificado por banco)</span></span>
        <span className="font-mono-app font-bold">{money(order.total)}</span>
      </div>
      {order.deliveryPartnerName && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold"><Bike className="h-3.5 w-3.5" /> {order.deliveryPartnerName}</p>}
      {canAct && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
          <button disabled={busy} onClick={() => onRelease(null)} className={btnPrimary} data-testid={`cashier-release-${order.id}`}><Send className="h-4 w-4" /> Liberar a repartidores</button>
          <select value={courier} onChange={(e) => setCourier(e.target.value)} className={inputCls} aria-label="Repartidor" data-testid={`cashier-courier-${order.id}`} disabled={busy || couriers.length === 0}>
            <option value="">{couriers.length ? 'Elegir repartidor activo' : 'Sin repartidores activos'}</option>
            {couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button disabled={busy || !courier} onClick={() => onRelease(Number(courier))} className={btnGhost} data-testid={`cashier-assign-${order.id}`}>Asignar</button>
        </div>
      )}
    </article>
  );
}

export default function CashierPortalPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const state = useGetCashierState({ query: { queryKey: getGetCashierStateQueryKey(), refetchInterval: 6000, retry: false } });
  const release = useReleaseCashierOrder();
  const close = useCloseOwnCashShift();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const data = state.data;

  const doRelease = (orderId: number, courierId: number | null) => {
    setBusyId(orderId); setMessage(null);
    release.mutate({ orderId, data: { courierId } }, {
      onSuccess: () => { setMessage({ kind: 'ok', text: courierId ? `Pedido #${orderId} asignado.` : `Pedido #${orderId} liberado para repartidores.` }); void state.refetch(); },
      onError: (e) => setMessage({ kind: 'error', text: errText(e) }),
      onSettled: () => setBusyId(null),
    });
  };
  const doClose = () => {
    if (!window.confirm('¿Estás seguro de cerrar caja?')) return;
    close.mutate(undefined, {
      onSuccess: () => { qc.clear(); clearSession(); setLocation('/login'); },
      onError: (e) => setMessage({ kind: 'error', text: errText(e, 'No se pudo cerrar caja.') }),
    });
  };

  const sessionGone = state.error && [401, 403, 404].includes(errStatus(state.error));
  const active = (data?.orders ?? []).filter((o) => !['delivered', 'cancelled'].includes(o.status));
  const done = (data?.orders ?? []).filter((o) => ['delivered', 'cancelled'].includes(o.status));

  return (
    <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-[#f7f5ee]">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><KeyRound className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="truncate font-display font-bold">{data?.shift.businessName ?? 'Caja'}</p>
            <p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">{data ? `${data.shift.username} · turno ${shiftLabel(data.shift.shift)}` : 'Caja'}</p>
          </div>
          <button onClick={doClose} disabled={close.isPending || !data} className="ml-auto flex min-h-11 items-center gap-2 rounded-full bg-primary px-3.5 text-xs font-bold text-white disabled:opacity-50" data-testid="cashier-close">
            <LogOut className="h-3.5 w-3.5" /> {close.isPending ? 'Cerrando…' : 'Cerrar caja'}
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {data && <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Caja abierta {limaTime(data.shift.openedAt)} · se actualiza cada 6 s</p>}
        <Banner message={message} />
        {state.isLoading ? <Skeleton /> : sessionGone ? (
          <div className="space-y-3">
            <Empty title="No hay caja abierta" text="Tu turno de caja ya no está activo. Vuelve al acceso del negocio para abrir caja." />
            <button onClick={() => setLocation('/business/access')} className={`${btnPrimary} w-full`}>Ir al acceso</button>
          </div>
        ) : state.error ? <LoadError error={errText(state.error, 'No se pudieron cargar los pedidos.')} onRetry={() => void state.refetch()} /> : data ? (
          <>
            <h1 className="font-display text-2xl font-bold tracking-[-.03em]">Pedidos en curso <span className="font-mono-app text-base text-muted-foreground">{active.length}</span></h1>
            {active.length === 0 ? <Empty title="Sin pedidos por ahora" text="Cuando un cliente compre, el pedido aparecerá aquí automáticamente." /> :
              active.map((o) => <OrderCard key={o.id} order={o} couriers={data.couriers} busy={busyId === o.id} onRelease={(c) => doRelease(o.id, c)} />)}
            {done.length > 0 && <>
              <h2 className="pt-2 font-display text-lg font-bold">Finalizados</h2>
              {done.map((o) => <OrderCard key={o.id} order={o} couriers={data.couriers} busy onRelease={() => undefined} />)}
            </>}
          </>
        ) : null}
      </div>
    </main>
  );
}
