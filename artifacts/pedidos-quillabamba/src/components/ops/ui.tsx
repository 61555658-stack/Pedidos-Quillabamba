import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const inputCls = 'h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent disabled:opacity-60';
export const btnPrimary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50';
export const btnGhost = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-primary transition hover:bg-muted disabled:opacity-50';
export const btnDanger = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="font-mono-app text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function TextInput({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <Field label={label} hint={hint}><input {...props} className={inputCls} /></Field>;
}

export function SelectInput({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return <Field label={label}><select {...props} className={inputCls}>{children}</select></Field>;
}

export function Panel({ title, kicker, actions, children }: { title: string; kicker?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl bg-card p-4 ring-1 ring-border sm:p-6 animate-rise">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          {kicker && <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">{kicker}</p>}
          <h2 className="mt-1 font-display text-xl font-bold tracking-[-.02em]">{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Banner({ message }: { message: { kind: 'ok' | 'error'; text: string } | null }) {
  if (!message) return null;
  return (
    <p role={message.kind === 'error' ? 'alert' : 'status'} data-testid="status-ops-feedback"
      className={`rounded-xl px-4 py-3 text-xs font-bold animate-rise ${message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-secondary/40 text-primary'}`}>
      {message.text}
    </p>
  );
}

export function LoadError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl bg-red-50 p-5 text-red-800 ring-1 ring-red-200 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <p className="flex-1 text-sm font-semibold">{error}</p>
      <button onClick={onRetry} className={btnGhost} data-testid="button-retry-state"><RefreshCw className="h-4 w-4" /> Reintentar</button>
    </div>
  );
}

export function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-card ring-1 ring-border" style={{ opacity: 1 - i * 0.18 }} />)}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export function Pill({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${on ? 'bg-secondary/50 text-primary' : 'bg-muted text-muted-foreground'}`}><span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-accent' : 'bg-muted-foreground/50'}`} />{children}</span>;
}

export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return <div role="region" aria-label={label} tabIndex={0} className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl ring-1 ring-border">{children}</div>;
}
export const thCls = 'px-4 py-3 text-left font-mono-app text-[10px] uppercase tracking-wide text-muted-foreground';
export const tdCls = 'px-4 py-3 align-top';
