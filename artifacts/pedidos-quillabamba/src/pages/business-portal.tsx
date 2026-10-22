import { useState } from 'react';
import { BarChart3, LogOut, PackageCheck, Settings, Store, Tag } from 'lucide-react';
import { useLocation } from 'wouter';
import { clearSession, readSession } from '@/pages/role-access';
import { api, useMutationRunner, useOperationsState } from '@/lib/operations-api';
import { Banner, Empty, LoadError, Panel, SelectInput, Skeleton } from '@/components/ops/ui';
import { OrderBoard } from '@/components/ops/order-board';
import { SalesReport } from '@/components/ops/sales-report';
import { BusinessForm, CategoriesManager, ProductsManager, bizDraftFrom } from '@/components/ops/catalog';

type BusinessTab = 'orders' | 'products' | 'categories' | 'sales' | 'profile';
const menu: Array<{ id: BusinessTab; label: string; icon: typeof Store }> = [
  { id: 'orders', label: 'Pedidos', icon: PackageCheck },
  { id: 'products', label: 'Productos', icon: Store },
  { id: 'categories', label: 'Categorías', icon: Tag },
  { id: 'sales', label: 'Ventas', icon: BarChart3 },
  { id: 'profile', label: 'Perfil del negocio', icon: Settings },
];

export default function BusinessPortalPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<BusinessTab>('orders');
  const [bizId, setBizId] = useState<number | null>(null);
  const { state, error, loading, reload } = useOperationsState();
  const { busy, message, setMessage, run } = useMutationRunner(reload);
  const onError = (text: string) => setMessage({ kind: 'error', text });
  const logout = () => { clearSession(); setLocation('/login'); };
  const session = readSession();
  const businesses = state?.businesses ?? [];
  const biz = businesses.find((b) => b.id === bizId) ?? businesses[0];
  const activeCount = state && biz ? state.orders.filter((o) => o.restaurantId === biz.id && !['delivered', 'cancelled'].includes(o.status)).length : 0;

  return (
    <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
      <header className="border-b border-border/70 bg-[#f7f5ee]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 md:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><Store className="h-4 w-4" /></span>
          <div>
            <p className="font-display font-bold">{state?.settings.platformName || 'QUILLAYAA'}</p>
            <p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Portal de negocio</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs font-semibold text-muted-foreground sm:block">{session?.email}</span>
            <button onClick={logout} className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-3.5 text-xs font-bold text-white" data-testid="button-business-logout"><LogOut className="h-3.5 w-3.5" /> Salir</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid min-w-0 max-w-[1400px] gap-5 px-4 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:px-8 md:py-7">
        <aside className="h-fit min-w-0 rounded-2xl bg-primary p-2 text-white md:p-3">
          <p className="px-3 pb-3 pt-2 font-mono-app text-[10px] uppercase tracking-[.16em] text-white/45">Establecimiento</p>
          <nav aria-label="Secciones del negocio" className="flex gap-1 overflow-x-auto pb-1 md:block md:space-y-1 md:pb-0">
            {menu.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setTab(id); setMessage(null); }} data-testid={`button-business-tab-${id}`}
                className={`flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-left text-xs font-bold transition md:w-full ${tab === id ? 'bg-secondary text-primary' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>
                <Icon className="h-4 w-4 shrink-0" />{label}
                {id === 'orders' && activeCount > 0 && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 font-mono-app text-[10px] text-white">{activeCount}</span>}
              </button>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 space-y-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Datos en vivo · cada 10 s</p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">{menu.find((m) => m.id === tab)?.label}</h1>
              {biz && <p className="mt-1 text-sm text-muted-foreground">{biz.name} · {biz.isOpen ? 'abierto' : 'cerrado'}{biz.active ? '' : ' · suspendido por la plataforma'}</p>}
            </div>
            {businesses.length > 1 && biz && (
              <div className="w-full sm:w-64"><SelectInput label="Negocio" value={biz.id} onChange={(e) => setBizId(Number(e.target.value))} data-testid="select-business-scope">{businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</SelectInput></div>
            )}
          </div>
          <Banner message={message} />
          {error && <LoadError error={error} onRetry={() => void reload()} />}
          {loading && !state ? <Skeleton /> : state && !biz ? (
            <Empty title="Aún no tienes un negocio asignado" text="Pide al administrador del sistema que te asigne un negocio. Cuando lo haga, esta pantalla se actualizará sola." />
          ) : state && biz ? (
            <>
              {tab === 'orders' && <Panel kicker={biz.name} title="Pedidos del negocio"><OrderBoard key={biz.id} orders={state.orders.filter((o) => o.restaurantId === biz.id)} isAdmin={false} run={run} busy={busy} /></Panel>}
              {tab === 'products' && <ProductsManager key={biz.id} business={biz} products={state.products} categories={state.categories} run={run} busy={busy} onError={onError} />}
              {tab === 'categories' && <CategoriesManager key={biz.id} business={biz} categories={state.categories} products={state.products} run={run} busy={busy} onError={onError} />}
              {tab === 'sales' && <SalesReport key={biz.id} businesses={businesses} lockedBusinessId={biz.id} />}
              {tab === 'profile' && (
                <Panel kicker="Perfil" title={biz.name}>
                  <BusinessForm key={biz.id} initial={bizDraftFrom(biz)} isSystemAdmin={false} saving={busy === 'biz-save'} onError={onError} submitLabel="Guardar perfil"
                    onSubmit={(body) => run('biz-save', () => api(`/api/operations/businesses/${biz.id}`, 'PATCH', body), 'Perfil del negocio guardado.')} />
                </Panel>
              )}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
