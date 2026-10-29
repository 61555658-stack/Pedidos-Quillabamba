import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Mail, ReceiptText, RefreshCw, ArrowUpRight, AlertTriangle } from 'lucide-react';
import {
  getGetMyVoucherQueryKey, getListMyVouchersQueryKey, useEmailMyVoucher, useGetMyVoucher, useListMyVouchers,
} from '@workspace/api-client-react';
import type { OrderVoucher } from '@workspace/api-client-react';
import { btnGhost, btnPrimary } from '@/components/ops/ui';

const soles = (n: unknown) => `S/ ${(typeof n === 'number' && Number.isFinite(n) ? n : 0).toFixed(2)}`;
const peDate = (iso: unknown) => {
  const d = new Date(typeof iso === 'string' ? iso : '');
  if (Number.isNaN(d.getTime())) return '--';
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(d);
};
const payLabel: Record<string, string> = { cash: 'Efectivo', yape: 'Yape', card: 'Tarjeta' };
const emailInfo: Record<string, { label: string; tone: string }> = {
  not_requested: { label: 'Correo no enviado', tone: 'bg-muted text-muted-foreground' },
  pending: { label: 'Envío pendiente', tone: 'bg-secondary/30 text-primary' },
  sending: { label: 'Envío pendiente', tone: 'bg-secondary/30 text-primary' },
  sent: { label: 'Envío aceptado', tone: 'bg-primary/10 text-primary' },
  failed: { label: 'No se pudo enviar', tone: 'bg-red-50 text-red-700' },
};
const isBusy = (s?: string) => s === 'pending' || s === 'sending';

function errStatus(e: unknown): number | undefined {
  if (e && typeof e === 'object' && 'status' in e) {
    const s = (e as { status?: unknown }).status;
    return typeof s === 'number' ? s : undefined;
  }
  return undefined;
}
function errText(e: unknown, fallback: string) {
  const st = errStatus(e);
  if (st === 429) return 'Espera un minuto antes de reenviar el correo.';
  if (st === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (st === 404) return 'No encontramos este voucher en tu cuenta.';
  return fallback;
}

export function OrderVoucherLink({ orderId }: { orderId: number }) {
  return (
    <Link href={`/vouchers?order=${orderId}`} data-testid={`link-voucher-${orderId}`}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-card px-3 text-xs font-bold text-primary transition hover:bg-muted">
      <ReceiptText className="h-4 w-4" /> Ver voucher del pedido <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function Dashes() {
  return <div aria-hidden className="my-3 overflow-hidden whitespace-nowrap text-[#2a2622]/50">{'- '.repeat(80)}</div>;
}

function Receipt({ v }: { v: OrderVoucher }) {
  const items = Array.isArray(v.items) ? v.items : [];
  return (
    <div className="relative mx-auto w-full max-w-[340px] animate-rise">
      <div aria-hidden className="h-3 w-full" style={{ background: 'radial-gradient(circle at 6px 0, transparent 6px, #f6f2e8 6.5px) 0 0/12px 12px repeat-x' }} />
      <article data-testid="voucher-receipt" className="bg-[#f6f2e8] px-5 pb-6 pt-3 font-mono-app text-[12px] leading-relaxed text-[#2a2622] warm-shadow [overflow-wrap:anywhere]">
        <header className="text-center">
          <p className="text-[15px] font-bold tracking-[.3em]">QUILLAYAA</p>
          <p className="text-[10px] uppercase tracking-widest">Delivery local · Quillabamba</p>
          <p className="mt-2 text-[10px] uppercase">Voucher de pedido</p>
        </header>
        <Dashes />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3">
          <dt>CODIGO</dt><dd className="text-right font-bold" data-testid="text-voucher-number">{v.number || '--'}</dd>
          <dt>PEDIDO</dt><dd className="text-right">#{v.orderId}</dd>
          <dt>FECHA</dt><dd className="text-right">{peDate(v.issuedAt)}</dd>
          <dt>NEGOCIO</dt><dd className="text-right">{v.restaurantName || '--'}</dd>
          <dt>CLIENTE</dt><dd className="text-right">{v.customerName || '--'}</dd>
          <dt>CORREO</dt><dd className="text-right">{v.customerEmail || '--'}</dd>
        </dl>
        <Dashes />
        <div className="grid grid-cols-[1fr_auto] text-[10px] font-bold"><span>CANT x P.UNIT</span><span>IMPORTE</span></div>
        <ul className="mt-1 space-y-2">
          {items.length === 0 && <li className="text-center">Sin productos registrados</li>}
          {items.map((it, i) => (
            <li key={`${it.id}-${i}`} data-testid={`row-voucher-item-${i}`}>
              <p className="font-bold uppercase">{it.name}</p>
              <div className="grid grid-cols-[1fr_auto] gap-2"><span>{it.quantity} x {soles(it.price)}</span><span>{soles((it.quantity || 0) * (it.price || 0))}</span></div>
            </li>
          ))}
        </ul>
        <Dashes />
        <div className="grid grid-cols-[1fr_auto] gap-y-0.5">
          <span>SUBTOTAL</span><span>{soles(v.subtotal)}</span>
          <span>DELIVERY</span><span>{soles(v.deliveryFee)}</span>
          <span className="mt-1 text-[15px] font-bold">TOTAL</span><span className="mt-1 text-[15px] font-bold" data-testid="text-voucher-total">{soles(v.total)}</span>
          <span>PAGO</span><span>{payLabel[v.paymentMethod] ?? v.paymentMethod}</span>
        </div>
        <Dashes />
        <div className="space-y-1 text-center font-bold">
          <p className="border border-[#2a2622] py-1">PEDIDO CONFIRMADO</p>
          <p className="border border-dashed border-[#2a2622] py-1">PAGO NO VERIFICADO</p>
        </div>
        <p className="mt-3 text-center text-[10px]">Este voucher registra tu pedido. No acredita el pago ni es comprobante fiscal (boleta o factura).</p>
        <p className="mt-3 text-center text-[10px] tracking-widest">*** GRACIAS ***</p>
      </article>
      <div aria-hidden className="h-3 w-full" style={{ background: 'radial-gradient(circle at 6px 12px, transparent 6px, #f6f2e8 6.5px) 0 0/12px 12px repeat-x' }} />
    </div>
  );
}

function VoucherActions({ v }: { v: OrderVoucher }) {
  const qc = useQueryClient();
  const email = useEmailMyVoucher();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (cooldownUntil <= now) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil, now]);
  const left = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const status = v.emailStatus;
  const info = emailInfo[status] ?? emailInfo.not_requested;

  const send = () => {
    setMsg(null);
    email.mutate({ orderId: v.orderId }, {
      onSuccess: (nv) => {
        qc.setQueryData(getGetMyVoucherQueryKey(v.orderId), nv);
        qc.setQueryData<OrderVoucher[]>(getListMyVouchersQueryKey(), (old) => Array.isArray(old) ? old.map((o) => o.orderId === nv.orderId ? nv : o) : old);
        qc.invalidateQueries({ queryKey: getListMyVouchersQueryKey() });
        setCooldownUntil(Date.now() + 60000); setNow(Date.now());
        setMsg({ kind: 'ok', text: 'Envío programado al correo de tu cuenta.' });
      },
      onError: (e) => {
        if (errStatus(e) === 429) { setCooldownUntil(Date.now() + 60000); setNow(Date.now()); }
        setMsg({ kind: 'error', text: errText(e, 'No pudimos programar el envío. Intenta otra vez.') });
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span data-testid="voucher-email-status" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${info.tone}`}>
          <span className={`h-1.5 w-1.5 rounded-full bg-current ${isBusy(status) ? 'animate-pulse-soft' : ''}`} />{info.label}
        </span>
        <span className="min-w-0 break-all text-[11px] text-muted-foreground">{v.customerEmail}</span>
      </div>
      {status === 'sent' && <p className="text-xs text-muted-foreground">El servicio de correo aceptó el envío; no confirma la entrega. Revisa también spam.</p>}
      {status === 'failed' && <p className="text-xs text-red-700">No se pudo enviar el correo. Puedes reintentar o descargar el PDF.</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <a href={v.pdfUrl} download={`voucher-${v.number || v.orderId}.pdf`} data-testid="voucher-download" className={btnPrimary}><Download className="h-4 w-4" /> Descargar PDF</a>
        <button type="button" onClick={send} disabled={email.isPending || left > 0 || isBusy(status)} data-testid="voucher-email-send" className={btnGhost}>
          <Mail className="h-4 w-4" />
          {email.isPending ? 'Programando...' : left > 0 ? `Espera ${left}s` : isBusy(status) ? 'Enviando...' : status === 'not_requested' ? 'Enviar correo' : 'Reenviar correo'}
        </button>
        <Link href={`/orders/${v.orderId}`} data-testid="link-voucher-order" className={btnGhost}>Ver pedido <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
      {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} data-testid={msg.kind === 'error' ? 'voucher-error' : 'status-voucher-email'}
        className={`rounded-xl px-3 py-2 text-xs font-bold ${msg.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-secondary/30 text-primary'}`}>{msg.text}</p>}
    </div>
  );
}

function VoucherDetail({ orderId }: { orderId: number }) {
  const q = useGetMyVoucher(orderId, {
    query: {
      queryKey: getGetMyVoucherQueryKey(orderId), enabled: orderId > 0, retry: (n, e) => errStatus(e) !== 404 && errStatus(e) !== 403 && n < 2,
      refetchInterval: (query) => isBusy(query.state.data?.emailStatus) ? 4000 : 15000,
    },
  });
  if (q.isLoading) return <div className="mx-auto h-[520px] w-full max-w-[340px] animate-pulse rounded bg-muted" aria-busy="true" />;
  if (q.isError || !q.data) {
    const nf = errStatus(q.error) === 404 || errStatus(q.error) === 403;
    return (
      <div role="alert" data-testid="voucher-error" className="rounded-2xl bg-red-50 p-5 text-red-800 ring-1 ring-red-200">
        <p className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4" />{nf ? 'Voucher no encontrado en tu cuenta' : errText(q.error, 'No pudimos cargar el voucher.')}</p>
        {!nf && <button onClick={() => q.refetch()} className={`${btnGhost} mt-3`} data-testid="button-retry-voucher"><RefreshCw className="h-4 w-4" /> Reintentar</button>}
      </div>
    );
  }
  return <div className="space-y-5"><Receipt v={q.data} /><VoucherActions v={q.data} /></div>;
}

export function CustomerVouchersPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const requested = useMemo(() => {
    const n = Number(new URLSearchParams(search).get('order'));
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [search]);
  const list = useListMyVouchers({ query: { queryKey: getListMyVouchersQueryKey(), refetchInterval: 15000, staleTime: 0, refetchOnMount: 'always' } });
  const vouchers = useMemo(() => (Array.isArray(list.data) ? list.data : []), [list.data]);
  const selected = requested ?? vouchers[0]?.orderId ?? null;
  const requestedMissing = requested !== null && list.isSuccess && !list.isFetching && !vouchers.some((v) => v.orderId === requested);

  return (
    <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6">
      <header className="mb-6">
        <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Tus compras</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-[-.03em]">Mis vouchers</h1>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">Cada pedido confirmado genera un voucher que te enviamos por correo. Aquí puedes verlo, descargarlo o reenviarlo.</p>
      </header>

      {list.isLoading ? (
        <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-card ring-1 ring-border" />)}</div>
      ) : list.isError ? (
        <div role="alert" data-testid="voucher-error" className="flex flex-col items-start gap-3 rounded-2xl bg-red-50 p-5 text-red-800 ring-1 ring-red-200">
          <p className="text-sm font-semibold">{errText(list.error, 'No pudimos cargar tus vouchers.')}</p>
          <button onClick={() => list.refetch()} className={btnGhost} data-testid="button-retry-vouchers"><RefreshCw className="h-4 w-4" /> Reintentar</button>
        </div>
      ) : vouchers.length === 0 ? (
        <div data-testid="voucher-list" className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <ReceiptText className="mx-auto h-8 w-8 text-accent" />
          <p className="mt-3 font-display text-lg font-bold">Aún no tienes vouchers</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Cuando confirmes tu primer pedido, su voucher aparecerá aquí.</p>
          <Link href="/" className={`${btnPrimary} mt-5`} data-testid="link-vouchers-shop">Ver negocios</Link>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <ul data-testid="voucher-list" className="min-w-0 space-y-2">
            {vouchers.map((v) => {
              const on = v.orderId === selected;
              const info = emailInfo[v.emailStatus] ?? emailInfo.not_requested;
              return (
                <li key={v.orderId}>
                  <button type="button" onClick={() => setLocation(`/vouchers?order=${v.orderId}`)} data-testid={`voucher-card-${v.orderId}`} aria-current={on}
                    className={`w-full min-w-0 rounded-2xl p-4 text-left ring-1 transition ${on ? 'bg-primary text-primary-foreground ring-primary' : 'bg-card ring-border hover:bg-muted'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words font-bold">{v.restaurantName}</span>
                      <span className="shrink-0 font-mono-app text-sm font-bold">{soles(v.total)}</span>
                    </div>
                    <div className={`mt-1 flex flex-wrap gap-x-3 font-mono-app text-[11px] ${on ? 'opacity-80' : 'text-muted-foreground'}`}>
                      <span>{v.number}</span><span>{peDate(v.issuedAt)}</span><span>{info.label}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <section className="min-w-0 rounded-2xl bg-muted/50 p-4 ring-1 ring-border sm:p-6">
            {requestedMissing ? (
              <div role="alert" data-testid="voucher-error" className="rounded-2xl bg-red-50 p-5 text-sm font-bold text-red-800 ring-1 ring-red-200">
                No encontramos el voucher del pedido #{requested} en tu cuenta.
              </div>
            ) : selected !== null ? <VoucherDetail key={selected} orderId={selected} /> : null}
          </section>
        </div>
      )}
    </main>
  );
}

export default CustomerVouchersPage;
