import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bike, Check, ClipboardList, CreditCard, LogOut, MapPin, PackageCheck, RefreshCw, Wallet } from 'lucide-react';
import { getListOrdersQueryKey, useClaimOrder, useListOrders, useUpdateOrderStatus } from '@workspace/api-client-react';
import type { Order, OrderStatusInputStatus } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { clearSession, readSession } from '@/pages/role-access';

function statusLabel(status: Order['status']) {
  return ({
    received: 'Recibido',
    preparing: 'En preparación',
    ready: 'Listo para recoger',
    on_the_way: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  })[status];
}

function isHttpConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
}

function OrderCard({
  order,
  action,
  actionLabel,
  disabled,
  actionTestId,
}: {
  order: Order;
  action: () => void;
  actionLabel: string;
  disabled: boolean;
  actionTestId: string;
}) {
  const paymentLabel = order.paymentMethod === 'yape' ? 'Yape' : order.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo';
  const PaymentIcon = order.paymentMethod === 'yape' ? Wallet : order.paymentMethod === 'card' ? CreditCard : null;

  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5" data-testid={`card-delivery-order-${order.id}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-app text-[10px] font-bold uppercase tracking-[.16em] text-accent">
              Pedido #{String(order.id).padStart(4, '0')}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{statusLabel(order.status)}</span>
          </div>
          <h3 className="mt-2 font-display text-lg font-bold">{order.customerName}</h3>
          <p className="mt-2 flex items-start gap-2 text-sm leading-5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">{order.deliveryAddress || 'Dirección no registrada'}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#f7f5ee] px-3 py-2 text-xs font-bold">
          {PaymentIcon ? <PaymentIcon className="h-4 w-4" /> : <span className="font-mono-app">S/</span>}
          {paymentLabel}
          <span className="ml-2 font-mono-app text-sm">S/ {order.total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#f7f5ee] p-3">
        <p className="font-mono-app text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Detalle</p>
        <ul className="mt-2 space-y-1.5 text-xs font-semibold">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.name} × {item.quantity}</span>
              <span className="shrink-0">S/ {(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={action}
        disabled={disabled}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-48"
        data-testid={actionTestId}
      >
        {actionLabel}
      </button>
    </article>
  );
}

export default function DeliveryPortalPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const session = readSession();
  const [notice, setNotice] = useState('');
  const ordersQuery = useListOrders({
    query: { queryKey: getListOrdersQueryKey(), refetchInterval: 4000, refetchOnWindowFocus: true },
  });
  const claimOrder = useClaimOrder();
  const updateStatus = useUpdateOrderStatus();

  const courierEmail = session?.email.trim().toLowerCase() ?? '';
  const orders = ordersQuery.data ?? [];
  const availableOrders = orders.filter((order) => (
    !order.deliveryPartnerEmail && order.status !== 'delivered' && order.status !== 'cancelled'
  ));
  const myActiveOrders = orders.filter((order) => (
    order.deliveryPartnerEmail?.toLowerCase() === courierEmail
    && order.status !== 'delivered'
    && order.status !== 'cancelled'
  ));
  const completedOrders = orders.filter((order) => (
    order.deliveryPartnerEmail?.toLowerCase() === courierEmail && order.status === 'delivered'
  ));

  const claim = (orderId: number) => {
    if (!session || session.role !== 'repartidor') {
      setNotice('Inicia sesión con una cuenta de repartidor para tomar pedidos.');
      return;
    }
    setNotice('');
    claimOrder.mutate(
      { orderId, data: { courierEmail: session.email, courierName: session.name } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          setNotice(`Tomaste el pedido #${orderId}. Ya está asignado a tu cuenta.`);
        },
        onError: (error) => {
          setNotice(isHttpConflict(error)
            ? 'Otro repartidor acaba de tomar ese pedido. La lista se actualizará automáticamente.'
            : 'No se pudo tomar el pedido. Inténtalo nuevamente.');
          void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        },
      },
    );
  };

  const advanceOrder = (order: Order) => {
    const status: OrderStatusInputStatus = order.status === 'on_the_way' ? 'delivered' : 'on_the_way';
    updateStatus.mutate(
      { orderId: order.id, data: { status } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          setNotice(status === 'delivered'
            ? `El pedido #${order.id} quedó marcado como entregado.`
            : `El pedido #${order.id} está en camino.`);
        },
        onError: () => setNotice('No se pudo actualizar el estado del pedido.'),
      },
    );
  };

  const logout = () => {
    clearSession();
    setLocation('/login');
  };

  const pendingCount = myActiveOrders.length;
  const completedCount = completedOrders.length;

  return (
    <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
      <header className="border-b border-border/70 bg-[#f7f5ee]">
        <div className="mx-auto flex min-h-16 max-w-[1200px] items-center gap-3 px-4 py-2 sm:px-5 md:px-8">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary"><Bike className="h-4 w-4" /></span>
          <div>
            <p className="font-display font-bold">QUILLAYAA</p>
            <p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Panel de repartidor</p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-44 truncate text-xs font-semibold text-muted-foreground sm:block">{session?.name || 'Repartidor'}</span>
            <button onClick={logout} className="flex min-h-10 items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white" data-testid="button-delivery-logout">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Última milla</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">Pedidos de reparto</h1>
            <p className="mt-2 text-sm text-muted-foreground">Los pedidos nuevos aparecen aquí. El primero que lo tome queda asignado.</p>
          </div>
          <button
            type="button"
            onClick={() => void ordersQuery.refetch()}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-card px-4 py-2 text-xs font-bold ring-1 ring-border"
            data-testid="button-delivery-refresh"
          >
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        </div>

        {notice && <p role="status" className="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800" data-testid="status-delivery-feedback">{notice}</p>}
        <div className="mt-6 grid gap-3 min-[520px]:grid-cols-3">
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5"><PackageCheck className="h-5 w-5 text-accent" /><p className="mt-3 font-mono-app text-2xl font-bold">{pendingCount}</p><p className="mt-1 text-xs font-bold">Pedidos asignados</p></div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5"><MapPin className="h-5 w-5 text-accent" /><p className="mt-3 font-mono-app text-2xl font-bold">{availableOrders.length}</p><p className="mt-1 text-xs font-bold">Disponibles para tomar</p></div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5"><ClipboardList className="h-5 w-5 text-accent" /><p className="mt-3 font-mono-app text-2xl font-bold">{completedCount}</p><p className="mt-1 text-xs font-bold">Entregados por ti</p></div>
        </div>

        {ordersQuery.isLoading ? (
          <div className="mt-8 rounded-2xl bg-card p-6 text-sm text-muted-foreground">Cargando pedidos…</div>
        ) : ordersQuery.isError ? (
          <div className="mt-8 rounded-2xl bg-card p-6 ring-1 ring-border">
            <p role="alert" className="text-sm font-bold text-red-700">No se pudieron cargar los pedidos.</p>
            <button onClick={() => void ordersQuery.refetch()} className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white">Reintentar</button>
          </div>
        ) : (
          <>
            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div><h2 className="font-display text-xl font-bold">Pedidos disponibles</h2><p className="mt-1 text-xs text-muted-foreground">Actualización automática cada pocos segundos.</p></div>
                <span className="font-mono-app text-[10px] uppercase tracking-wide text-muted-foreground">{availableOrders.length} disponibles</span>
              </div>
              <div className="mt-4 grid gap-4">
                {availableOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    action={() => claim(order.id)}
                    actionLabel={claimOrder.isPending ? 'Tomando pedido…' : 'Tomar pedido'}
                    disabled={claimOrder.isPending}
                    actionTestId={`button-claim-order-${order.id}`}
                  />
                ))}
                {!availableOrders.length && <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">No hay pedidos nuevos por tomar. Esta lista se actualizará automáticamente.</div>}
              </div>
            </section>

            <section className="mt-9">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div><h2 className="font-display text-xl font-bold">Mis pedidos</h2><p className="mt-1 text-xs text-muted-foreground">Solo aparecen pedidos que tomaste con esta cuenta.</p></div>
                <span className="font-mono-app text-[10px] uppercase tracking-wide text-muted-foreground">{myActiveOrders.length} activos</span>
              </div>
              <div className="mt-4 grid gap-4">
                {myActiveOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    action={() => advanceOrder(order)}
                    actionLabel={updateStatus.isPending
                      ? 'Guardando…'
                      : order.status === 'on_the_way' ? 'Marcar como entregado' : 'Marcar en camino'}
                    disabled={updateStatus.isPending}
                    actionTestId={`button-advance-order-${order.id}`}
                  />
                ))}
                {!myActiveOrders.length && <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Cuando tomes un pedido, aparecerá aquí para que puedas gestionarlo.</div>}
              </div>
            </section>

            <section className="mt-9">
              <h2 className="font-display text-xl font-bold">Entregas realizadas</h2>
              {completedOrders.length ? (
                <div className="mt-4 grid gap-3">
                  {completedOrders.map((order) => (
                    <div key={order.id} className="flex flex-col justify-between gap-2 rounded-2xl bg-[#ede4ff] p-4 sm:flex-row sm:items-center sm:p-5" data-testid={`card-delivery-completed-${order.id}`}>
                      <div><p className="font-mono-app text-[10px] uppercase tracking-wide text-accent">Pedido #{order.id}</p><p className="mt-1 font-bold">{order.customerName}</p><p className="mt-1 break-words text-xs text-muted-foreground">{order.deliveryAddress || 'Dirección no registrada'} · S/ {order.total.toFixed(2)}</p></div>
                      <span className="flex items-center gap-2 text-xs font-bold text-violet-800"><Check className="h-4 w-4" /> Entregado</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Tus entregas completadas aparecerán aquí.</div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
