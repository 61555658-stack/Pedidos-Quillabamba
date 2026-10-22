import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetBusinessCashShiftQueryKey, getListBusinessCashShiftsQueryKey, useCloseBusinessCashShift, useGetBusinessCashShift, useListBusinessCashShifts,
} from '@workspace/api-client-react';
import { Banner, Empty, LoadError, Panel, Pill, Skeleton, TableWrap, btnDanger, tdCls, thCls } from '@/components/ops/ui';
import { money, paymentLabels, statusLabels } from '@/lib/operations-api';
import { errText, limaTime, shiftLabel } from '@/lib/cash-format';

function ShiftDetail({ shiftId }: { shiftId: number }) {
  const qc = useQueryClient();
  const report = useGetBusinessCashShift(shiftId, { query: { queryKey: getGetBusinessCashShiftQueryKey(shiftId), refetchInterval: 8000 } });
  const close = useCloseBusinessCashShift();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  if (report.isLoading) return <Skeleton />;
  if (report.error || !report.data) return <LoadError error={errText(report.error, 'No se pudo cargar el reporte.')} onRetry={() => void report.refetch()} />;
  const { shift, orders, events, totals } = report.data;
  const doClose = () => {
    if (!window.confirm(`¿Estás seguro de cerrar la caja ${shift.username} abierta el ${limaTime(shift.openedAt)}?`)) return;
    close.mutate({ shiftId }, {
      onSuccess: () => { setMessage({ kind: 'ok', text: 'Caja cerrada.' }); void qc.invalidateQueries({ queryKey: ['/api/business/cash-shifts'] }); void report.refetch(); },
      onError: (e) => setMessage({ kind: 'error', text: errText(e, 'No se pudo cerrar la caja.') }),
    });
  };
  const stat = (label: string, value: string) => <div className="rounded-xl bg-muted/40 p-3"><p className="font-mono-app text-[10px] uppercase tracking-[.12em] text-muted-foreground">{label}</p><p className="mt-1 font-display text-lg font-bold">{value}</p></div>;
  return (
    <Panel kicker={`Caja ${shift.username} · turno ${shiftLabel(shift.shift)}`} title={`Reporte #${shift.id}`}
      actions={!shift.closedAt && <button onClick={doClose} disabled={close.isPending} className={btnDanger}>{close.isPending ? 'Cerrando…' : 'Cerrar caja abandonada'}</button>}>
      <div className="space-y-4">
        <Banner message={message} />
        <p className="text-sm">Apertura: <b>{limaTime(shift.openedAt)}</b> · Cierre: <b>{shift.closedAt ? limaTime(shift.closedAt) : 'abierta'}</b> · Abrió: {shift.openedByName} <span className="text-muted-foreground">(hora de Lima)</span></p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stat('Pedidos atendidos', String(totals.handledOrders))}
          {stat('Entregados', String(totals.deliveredOrders))}
          {stat('Unidades entregadas', String(totals.units))}
          {stat('Productos entregados', money(totals.productSales))}
          {stat('Delivery (aparte)', money(totals.deliveryFees))}
          {stat('Total', money(totals.total))}
        </div>
        <p className="text-[11px] text-muted-foreground">Los totales solo suman pedidos entregados. Métodos de pago declarados por el cliente, sin verificación bancaria.</p>
        {orders.length === 0 ? <Empty title="Sin pedidos en este turno" text="Aún no se gestionó ningún pedido durante esta caja." /> : (
          <TableWrap label="Pedidos del turno">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40"><tr><th className={thCls}>Pedido</th><th className={thCls}>Productos</th><th className={thCls}>Pago</th><th className={thCls}>Repartidor</th><th className={thCls}>Horas</th><th className={thCls}>Montos</th></tr></thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className={tdCls}><b>#{o.id}</b><br /><span className="text-xs text-muted-foreground">{o.customerName} · {statusLabels[o.status]}</span></td>
                    <td className={tdCls}>{o.items.map((it) => <div key={it.id} className="text-xs"><b className="font-mono-app">{it.quantity}x</b> {it.name}</div>)}</td>
                    <td className={tdCls}>{paymentLabels[o.paymentMethod]}</td>
                    <td className={tdCls}>{o.deliveryPartnerName || <span className="text-muted-foreground">Sin asignar</span>}</td>
                    <td className={`${tdCls} text-xs`}>Pedido: {limaTime(o.createdAt)}<br />Entrega: {limaTime(o.deliveredAt)}</td>
                    <td className={`${tdCls} font-mono-app text-xs`}>Prod. {money(o.total - (o.deliveryFee ?? 0))}<br />Envío {money(o.deliveryFee ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <p className="text-xs leading-5 text-muted-foreground">La venta se cuenta al entregar el pedido y se atribuye al turno que lo liberó por primera vez. Si otro turno interviene después, también puede consultar el pedido y su movimiento, sin duplicar la venta.</p>
        {events.length > 0 && (
          <div>
            <p className="mb-2 font-mono-app text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Movimientos de caja</p>
            <ul className="space-y-1 text-xs">{events.map((ev) => <li key={ev.id}>{limaTime(ev.createdAt)} · Pedido #{ev.orderId} · {ev.action === 'assigned' ? `asignado a ${ev.courierName ?? 'repartidor'}` : 'liberado a repartidores'}</li>)}</ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function CashShiftsPanel({ businessId }: { businessId: number }) {
  const list = useListBusinessCashShifts({ businessId }, { query: { queryKey: getListBusinessCashShiftsQueryKey({ businessId }), refetchInterval: 8000 } });
  const [selected, setSelected] = useState<number | null>(null);
  const shifts = list.data?.shifts ?? [];
  const current = selected ?? shifts[0]?.id ?? null;
  return (
    <div className="space-y-5">
      <Panel kicker="Se actualiza cada 8 s" title="Turnos de caja">
        {list.isLoading ? <Skeleton /> : list.error ? <LoadError error={errText(list.error, 'No se pudieron cargar los turnos.')} onRetry={() => void list.refetch()} /> :
          shifts.length === 0 ? <Empty title="Aún no hay turnos de caja" text="Cuando un cajero abra caja con caja1m o caja1t, el turno aparecerá aquí." /> : (
            <div className="grid gap-2">
              {shifts.map((s) => (
                <button key={s.id} onClick={() => setSelected(s.id)} className={`flex flex-wrap items-center gap-3 rounded-xl p-3 text-left text-sm ring-1 transition ${current === s.id ? 'bg-secondary/40 ring-accent' : 'bg-card ring-border hover:bg-muted'}`}>
                  <Pill on={!s.closedAt}>{s.closedAt ? 'Cerrada' : 'Abierta'}</Pill>
                  <b className="font-mono-app">{s.username}</b><span>{shiftLabel(s.shift)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{limaTime(s.openedAt)} → {s.closedAt ? limaTime(s.closedAt) : 'en curso'}</span>
                </button>
              ))}
            </div>
          )}
      </Panel>
      {current !== null && <ShiftDetail key={current} shiftId={current} />}
    </div>
  );
}
