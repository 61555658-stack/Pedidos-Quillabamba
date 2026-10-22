import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { api, downloadFile, limaToday, money, type OpsBusiness } from '@/lib/operations-api';
import { Banner, Empty, Panel, SelectInput, Skeleton, TableWrap, TextInput, btnGhost, btnPrimary, tdCls, thCls } from './ui';

type Period = 'day' | 'week' | 'month';
type Report = {
  period: Period; date: string; start: string; end: string;
  businesses: { businessId: number; businessName: string; orders: number; units: number; productSales: number; deliveryFees: number; total: number; items: { productId: number; name: string; quantity: number; subtotal: number }[] }[];
  totals: { orders: number; units: number; productSales: number; deliveryFees: number; total: number };
};

export function SalesReport({ businesses, lockedBusinessId }: { businesses: OpsBusiness[]; lockedBusinessId?: number | null }) {
  const [period, setPeriod] = useState<Period>('day');
  const [date, setDate] = useState(limaToday());
  const [businessId, setBusinessId] = useState<string>('');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const requestId=useRef(0);
  const effectiveBiz = lockedBusinessId != null ? String(lockedBusinessId) : businessId;
  const qs = `period=${period}&date=${date}${effectiveBiz ? `&businessId=${effectiveBiz}` : ''}`;

  const load = useCallback(async () => {
    const current=++requestId.current;
    setLoading(true); setMsg(null);
    try { const data=await api<Report>(`/api/reports/sales?${qs}`); if(current===requestId.current)setReport(data); }
    catch (e) { if(current===requestId.current){setReport(null); setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'No se pudo cargar el reporte.' });} }
    finally { if(current===requestId.current)setLoading(false); }
  }, [qs]);
  useEffect(() => { setReport(null);void load();const timer=window.setInterval(()=>void load(),10_000);return()=>{++requestId.current;window.clearInterval(timer);}; }, [load]);

  const pdf = async () => {
    setDownloading(true); setMsg(null);
    try { await downloadFile(`/api/reports/sales.pdf?${qs}`, `ventas-${period}-${date}.pdf`); setMsg({ kind: 'ok', text: 'PDF descargado.' }); }
    catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'No se pudo descargar el PDF.' }); }
    finally { setDownloading(false); }
  };

  return (
    <Panel kicker="Solo pedidos entregados" title="Reporte de ventas" actions={
      <div className="flex gap-2">
        <button onClick={() => void load()} className={btnGhost} disabled={loading} data-testid="button-report-refresh"><RefreshCw className="h-4 w-4" /> Actualizar</button>
        <button onClick={() => void pdf()} className={btnPrimary} disabled={downloading} data-testid="button-report-pdf"><Download className="h-4 w-4" /> {downloading ? 'Generando…' : 'Descargar PDF'}</button>
      </div>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectInput label="Periodo" value={period} onChange={(e) => setPeriod(e.target.value as Period)} data-testid="select-report-period">
          <option value="day">Día</option><option value="week">Semana (desde lunes)</option><option value="month">Mes</option>
        </SelectInput>
        <TextInput label="Fecha de referencia (Lima)" type="date" value={date} onChange={(e) => setDate(e.target.value || limaToday())} data-testid="input-report-date" />
        {lockedBusinessId == null && (
          <SelectInput label="Negocio" value={businessId} onChange={(e) => setBusinessId(e.target.value)} data-testid="select-report-business">
            <option value="">Todos los negocios</option>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectInput>
        )}
      </div>
      <div className="mt-4"><Banner message={msg} /></div>
      {loading && !report && <div className="mt-5"><Skeleton /></div>}
      {report && (
        <div className="mt-5 space-y-5">
          <p className="font-mono-app text-[11px] text-muted-foreground">Rango: {report.start} → {report.end}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[['Pedidos', String(report.totals.orders)], ['Unidades', String(report.totals.units)], ['Venta productos', money(report.totals.productSales)], ['Delivery', money(report.totals.deliveryFees)], ['Total', money(report.totals.total)]].map(([k, v], i) => (
              <div key={k} className={`rounded-xl p-4 ${i === 4 ? 'bg-primary text-white' : 'bg-muted/50'}`}>
                <p className={`text-[11px] font-semibold ${i === 4 ? 'text-white/60' : 'text-muted-foreground'}`}>{k}</p>
                <p className="mt-1 font-mono-app text-lg font-bold" data-testid={`text-report-total-${i}`}>{v}</p>
              </div>
            ))}
          </div>
          {report.businesses.length === 0 ? <Empty title="Sin negocios" text="No hay negocios incluidos en este reporte." /> : (
            <div className="space-y-4">
              {report.businesses.map((b) => (
                <div key={b.businessId} className="rounded-xl ring-1 ring-border" data-testid={`card-report-business-${b.businessId}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
                    <h3 className="font-display text-base font-bold">{b.businessName}</h3>
                    <p className="font-mono-app text-xs text-muted-foreground">{b.orders} pedidos · {b.units} u. · productos {money(b.productSales)} · delivery {money(b.deliveryFees)} · <strong className="text-primary">{money(b.total)}</strong></p>
                  </div>
                  {b.items.length === 0 ? <p className="px-4 py-4 text-sm text-muted-foreground">Sin ventas entregadas en este periodo.</p> : (
                    <TableWrap label={`Productos vendidos por ${b.businessName}`}>
                      <table className="w-full min-w-[420px] text-sm">
                        <thead><tr><th className={thCls}>Producto</th><th className={thCls}>Cantidad</th><th className={thCls}>Ingreso</th></tr></thead>
                        <tbody>{b.items.map((it) => <tr key={JSON.stringify([it.productId,it.name])} className="border-t border-border/60"><td className={tdCls}>{it.name}</td><td className={`${tdCls} font-mono-app`}>{it.quantity}</td><td className={`${tdCls} font-mono-app`}>{money(it.subtotal)}</td></tr>)}</tbody>
                      </table>
                    </TableWrap>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
