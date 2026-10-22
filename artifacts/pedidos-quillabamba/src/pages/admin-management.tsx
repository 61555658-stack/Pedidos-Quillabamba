import { useCallback, useEffect, useState } from 'react';
import { Bike, CircleDollarSign, ClipboardList, FileText, LayoutDashboard, LogOut, PackageCheck, Pencil, Settings2, Store, Tag, UserCheck, Users, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { clearSession } from '@/pages/role-access';
import { api, fmtDate, money, paymentLabels, roleLabel, roleOptions, statusLabels, useMutationRunner, useOperationsState, type OpsState, type OpsUser } from '@/lib/operations-api';
import { Banner, Empty, LoadError, Panel, Pill, SelectInput, Skeleton, TableWrap, TextInput, btnDanger, btnGhost, btnPrimary, tdCls, thCls } from '@/components/ops/ui';
import { OrderBoard } from '@/components/ops/order-board';
import { SalesReport } from '@/components/ops/sales-report';
import { BusinessForm, CategoriesManager, ProductsManager, bizDraftFrom } from '@/components/ops/catalog';

type Tab = 'users' | 'approvals' | 'businesses' | 'products' | 'categories' | 'orders' | 'couriers' | 'payments' | 'reports' | 'settings';
const menu: Array<{ id: Tab; label: string; icon: typeof Users }> = [
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'approvals', label: 'Solicitudes', icon: UserCheck },
  { id: 'businesses', label: 'Negocios', icon: Store },
  { id: 'products', label: 'Productos', icon: PackageCheck },
  { id: 'categories', label: 'Categorías', icon: Tag },
  { id: 'orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'couriers', label: 'Repartidores', icon: Bike },
  { id: 'payments', label: 'Pagos', icon: CircleDollarSign },
  { id: 'reports', label: 'Reporte de ventas', icon: FileText },
  { id: 'settings', label: 'Configuración', icon: Settings2 },
];
type Run = ReturnType<typeof useMutationRunner>['run'];
type Req = { id: number; name: string; email: string; createdAt: string };

export default function AdminManagementPage({initialTab}: {initialTab?: Tab}) {
  const [, setLocation] = useLocation();
  const qTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
  const [tab, setTab] = useState<Tab>(menu.some((m) => m.id === qTab) ? (qTab as Tab) : initialTab || 'users');
  const { state, error, loading, reload } = useOperationsState();
  const { busy, message, setMessage, run } = useMutationRunner(reload);
  const onError = (text: string) => setMessage({ kind: 'error', text });
  const logout = () => { clearSession(); setLocation('/login'); };

  return (
    <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
      <header className="border-b border-border/70 bg-[#f7f5ee]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 md:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><Settings2 className="h-4 w-4" /></span>
          <div>
            <p className="font-display font-bold">{state?.settings.platformName || 'QUILLAYAA'}</p>
            <p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Gestión de plataforma</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/admin" className={btnGhost} data-testid="link-admin-dashboard"><LayoutDashboard className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span></Link>
            <button onClick={logout} className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-3.5 text-xs font-bold text-white" data-testid="button-admin-logout"><LogOut className="h-3.5 w-3.5" /> Salir</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid min-w-0 max-w-[1400px] gap-5 px-4 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:px-8 md:py-7">
        <aside className="h-fit min-w-0 rounded-2xl bg-primary p-2 text-white md:p-3">
          <p className="px-3 pb-3 pt-2 font-mono-app text-[10px] uppercase tracking-[.16em] text-white/45">Administración</p>
          <nav aria-label="Secciones de administración" className="flex gap-1 overflow-x-auto pb-1 md:block md:space-y-1 md:pb-0">
            {menu.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setTab(id); setMessage(null); }} data-testid={`button-admin-tab-${id}`}
                className={`flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 text-left text-xs font-bold transition md:w-full ${tab === id ? 'bg-secondary text-primary' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}>
                <Icon className="h-4 w-4 shrink-0" />{label}
              </button>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 space-y-5">
          <div>
            <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Datos en vivo · se actualiza cada 10 s</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">{menu.find((m) => m.id === tab)?.label}</h1>
          </div>
          <Banner message={message} />
          {error && <LoadError error={error} onRetry={() => void reload()} />}
          {tab === 'approvals' ? <Approvals onChanged={reload} /> : loading && !state ? <Skeleton /> : state ? (
            <>
              {tab === 'users' && <UsersTab state={state} run={run} busy={busy} onError={onError} />}
              {tab === 'businesses' && <BusinessesTab state={state} run={run} busy={busy} onError={onError} />}
              {(tab === 'products' || tab === 'categories') && <ScopedCatalog state={state} kind={tab} run={run} busy={busy} onError={onError} />}
              {tab === 'orders' && <Panel title="Todos los pedidos" kicker="Operación"><OrderBoard orders={state.orders} couriers={state.users} isAdmin run={run} busy={busy} /></Panel>}
              {tab === 'couriers' && <CouriersTab state={state} run={run} busy={busy} />}
              {tab === 'payments' && <PaymentsTab state={state} />}
              {tab === 'reports' && <SalesReport businesses={state.businesses} />}
              {tab === 'settings' && <SettingsTab state={state} run={run} busy={busy} onError={onError} />}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Approvals({ onChanged }: { onChanged: () => Promise<void> }) {
  const [list, setList] = useState<Req[] | null>(null);
  const [err, setErr] = useState('');
  const [deciding, setDeciding] = useState<number | null>(null);
  const load = useCallback(async () => {
    try { setList(await api<Req[]>('/api/auth/business-admin-requests')); setErr(''); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes.'); }
  }, []);
  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 10_000); return () => window.clearInterval(t); }, [load]);
  const decide = async (id: number, decision: 'approve' | 'reject') => {
    setDeciding(id); setErr('');
    try { await api(`/api/auth/business-admin-requests/${id}/decision`, 'POST', { decision }); await load(); await onChanged(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar la decisión.'); }
    finally { setDeciding(null); }
  };
  return (
    <Panel kicker="Administradores de negocio" title="Solicitudes pendientes">
      {err && <div className="mb-4"><LoadError error={err} onRetry={() => void load()} /></div>}
      {!list ? <Skeleton /> : list.length === 0 ? <Empty title="Sin solicitudes" text="Cuando alguien pida una cuenta de administrador de negocio aparecerá aquí." /> : (
        <div className="space-y-3">{list.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 sm:flex-row sm:items-center" data-testid={`row-request-${r.id}`}>
            <div className="flex-1"><p className="font-bold">{r.name}</p><p className="text-xs text-muted-foreground">{r.email} · {fmtDate(r.createdAt)}</p></div>
            <button className={btnPrimary} disabled={deciding === r.id} onClick={() => void decide(r.id, 'approve')} data-testid={`button-request-approve-${r.id}`}>Aprobar</button>
            <button className={btnDanger} disabled={deciding === r.id} onClick={() => void decide(r.id, 'reject')} data-testid={`button-request-reject-${r.id}`}>Rechazar</button>
          </div>))}</div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Tras aprobar, asigna su negocio desde la pestaña Negocios.</p>
    </Panel>
  );
}

type UserDraft = { name: string; email: string; role: string; phone: string; address: string; password: string; active: boolean };
const blankUser: UserDraft = { name: '', email: '', role: 'cliente', phone: '', address: '', password: '', active: true };

function UsersTab({ state, run, busy, onError }: { state: OpsState; run: Run; busy: string | null; onError: (m: string) => void }) {
  const [d, setD] = useState<UserDraft>(blankUser);
  const [editId, setEditId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const save = async () => {
    if (!d.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return onError('Ingresa un nombre y un correo válidos.');
    if (!editId && d.password.length < 8) return onError('La contraseña debe tener al menos 8 caracteres.');
    if (editId && d.password && d.password.length < 8) return onError('La nueva contraseña debe tener al menos 8 caracteres.');
    const base = { name: d.name.trim(), email: d.email.trim().toLowerCase(), ...(roleOptions.some(r=>r.value===d.role)?{role:d.role}:{}), phone: d.phone.trim(), address: d.address.trim() };
    const ok = editId
      ? await run('user-save', () => api(`/api/operations/users/${editId}`, 'PATCH', { ...base, active: d.active, ...(d.password ? { password: d.password } : {}) }), 'Usuario actualizado.')
      : await run('user-save', () => api('/api/operations/users', 'POST', { ...base, password: d.password }), 'Usuario creado.');
    if (ok) { setD(blankUser); setEditId(null); }
  };
  const edit = (u: OpsUser) => { setEditId(u.id); setD({ name: u.name, email: u.email, role: u.role, phone: u.phone, address: u.address, password: '', active: u.active }); };
  const list = state.users.filter((u) => `${u.name} ${u.email} ${roleLabel(u.role)}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-5">
      <Panel kicker="Cuentas" title={editId ? `Editar usuario #${editId}` : 'Crear usuario'} actions={editId ? <button className={btnGhost} onClick={() => { setEditId(null); setD(blankUser); }}><X className="h-4 w-4" /> Cancelar</button> : undefined}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextInput label="Nombre" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="input-user-name" />
          <TextInput label="Correo" type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} data-testid="input-user-email" />
          <SelectInput label="Rol" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })} data-testid="select-user-role">{!roleOptions.some(r=>r.value===d.role)&&<option value={d.role}>{roleLabel(d.role)}</option>}{roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</SelectInput>
          <TextInput label="Teléfono" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} data-testid="input-user-phone" />
          <TextInput label="Dirección" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} data-testid="input-user-address" />
          <TextInput label={editId ? 'Nueva contraseña (opcional)' : 'Contraseña (mín. 8)'} type="password" autoComplete="new-password" value={d.password} onChange={(e) => setD({ ...d, password: e.target.value })} data-testid="input-user-password" />
          {editId && <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} data-testid="checkbox-user-active" /> Cuenta activa</label>}
          <button className={`${btnPrimary} lg:col-start-3`} disabled={busy === 'user-save'} onClick={() => void save()} data-testid="button-user-save">{busy === 'user-save' ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear usuario'}</button>
        </div>
      </Panel>
      <Panel title={`Usuarios (${state.users.length})`} actions={<div className="w-full sm:w-64"><TextInput label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-user-search" /></div>}>
        {list.length === 0 ? <Empty title="Sin resultados" text="No hay usuarios que coincidan." /> : (
          <TableWrap label="Tabla de usuarios"><table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/50"><tr><th className={thCls}>Nombre</th><th className={thCls}>Rol</th><th className={thCls}>Contacto</th><th className={thCls}>Estado</th><th className={thCls}>Acciones</th></tr></thead>
            <tbody>{list.map((u) => (
              <tr key={u.id} className="border-t border-border/60" data-testid={`row-user-${u.id}`}>
                <td className={tdCls}><p className="font-bold">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                <td className={tdCls}>{roleLabel(u.role)}</td>
                <td className={`${tdCls} text-xs`}>{u.phone || '—'}<br /><span className="text-muted-foreground">{u.address}</span></td>
                <td className={tdCls}><Pill on={u.active}>{u.active ? 'Activa' : 'Bloqueada'}</Pill></td>
                <td className={tdCls}><div className="flex gap-2">
                  <button className={btnGhost} onClick={() => edit(u)} aria-label={`Editar ${u.name}`} data-testid={`button-user-edit-${u.id}`}><Pencil className="h-4 w-4" /></button>
                  <button className={u.active ? btnDanger : btnGhost} disabled={busy === `u-${u.id}`} onClick={() => void run(`u-${u.id}`, () => api(`/api/operations/users/${u.id}`, 'PATCH', { active: !u.active }), u.active ? 'Usuario bloqueado.' : 'Usuario habilitado.')} data-testid={`button-user-toggle-${u.id}`}>{u.active ? 'Bloquear' : 'Habilitar'}</button>
                </div></td>
              </tr>))}</tbody>
          </table></TableWrap>
        )}
      </Panel>
    </div>
  );
}

function BusinessesTab({ state, run, busy, onError }: { state: OpsState; run: Run; busy: string | null; onError: (m: string) => void }) {
  const [editId, setEditId] = useState<number | null>(null);
  const admins = state.users.filter((u) => u.role === 'administrador_negocio');
  const editing = state.businesses.find((b) => b.id === editId);
  return (
    <div className="space-y-5">
      <Panel kicker="Negocios" title={editing ? `Editar ${editing.name}` : 'Registrar negocio'} actions={editing ? <button className={btnGhost} onClick={() => setEditId(null)}><X className="h-4 w-4" /> Cancelar</button> : undefined}>
        <BusinessForm key={editId ?? 'new'} initial={bizDraftFrom(editing)} admins={admins} isSystemAdmin saving={busy === 'biz-save'} onError={onError}
          submitLabel={editing ? 'Guardar cambios' : 'Registrar negocio'}
          onSubmit={async (body) => {
            const ok = editing
              ? await run('biz-save', () => api(`/api/operations/businesses/${editing.id}`, 'PATCH', body), 'Negocio actualizado.')
              : await run('biz-save', () => api('/api/operations/businesses', 'POST', body), 'Negocio registrado.');
            if (ok) setEditId(null);
            return ok;
          }} />
      </Panel>
      <Panel title={`Negocios (${state.businesses.length})`}>
        {state.businesses.length === 0 ? <Empty title="Sin negocios" text="Registra el primer local de Quillabamba arriba." /> : (
          <TableWrap label="Tabla de negocios"><table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/50"><tr><th className={thCls}>Negocio</th><th className={thCls}>Administrador</th><th className={thCls}>Contacto</th><th className={thCls}>Delivery</th><th className={thCls}>Estado</th><th className={thCls}>Acciones</th></tr></thead>
            <tbody>{state.businesses.map((b) => (
              <tr key={b.id} className="border-t border-border/60" data-testid={`row-business-${b.id}`}>
                <td className={tdCls}><p className="font-bold">{b.name}</p><p className="text-xs text-muted-foreground">RUC {b.ruc || '—'} · {b.cuisine}</p></td>
                <td className={tdCls}>
                  <select aria-label={`Administrador de ${b.name}`} className="h-11 w-full rounded-xl border border-input bg-background px-2 text-xs" value={b.administratorId ?? ''} disabled={busy === `b-${b.id}`} data-testid={`select-business-admin-${b.id}`}
                    onChange={(e) => void run(`b-${b.id}`, () => api(`/api/operations/businesses/${b.id}`, 'PATCH', { administratorId: e.target.value ? Number(e.target.value) : null }), 'Administrador asignado.')}>
                    <option value="">Sin asignar</option>
                    {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </td>
                <td className={`${tdCls} text-xs`}>{b.phone || '—'}<br /><span className="text-muted-foreground">{b.address}</span></td>
                <td className={`${tdCls} font-mono-app`}>{money(b.deliveryFee)}</td>
                <td className={tdCls}><div className="flex flex-col gap-1"><Pill on={b.active}>{b.active ? 'Habilitado' : 'Suspendido'}</Pill><Pill on={b.isOpen}>{b.isOpen ? 'Abierto' : 'Cerrado'}</Pill></div></td>
                <td className={tdCls}><div className="flex gap-2">
                  <button className={btnGhost} onClick={() => { setEditId(b.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label={`Editar ${b.name}`} data-testid={`button-business-edit-${b.id}`}><Pencil className="h-4 w-4" /></button>
                  <button className={b.active ? btnDanger : btnGhost} disabled={busy === `b-${b.id}`} onClick={() => void run(`b-${b.id}`, () => api(`/api/operations/businesses/${b.id}`, 'PATCH', { active: !b.active }), b.active ? 'Negocio suspendido.' : 'Negocio habilitado.')} data-testid={`button-business-toggle-${b.id}`}>{b.active ? 'Suspender' : 'Habilitar'}</button>
                </div></td>
              </tr>))}</tbody>
          </table></TableWrap>
        )}
      </Panel>
    </div>
  );
}

function ScopedCatalog({ state, kind, run, busy, onError }: { state: OpsState; kind: 'products' | 'categories'; run: Run; busy: string | null; onError: (m: string) => void }) {
  const [bizId, setBizId] = useState<number | null>(state.businesses[0]?.id ?? null);
  const biz = state.businesses.find((b) => b.id === bizId) ?? state.businesses[0];
  if (!biz) return <Empty title="Sin negocios" text="Registra un negocio antes de gestionar su carta." />;
  return (
    <div className="space-y-5">
      <div className="max-w-sm"><SelectInput label="Negocio" value={biz.id} onChange={(e) => setBizId(Number(e.target.value))} data-testid="select-catalog-business">{state.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</SelectInput></div>
      {kind === 'products'
        ? <ProductsManager key={biz.id} business={biz} products={state.products} categories={state.categories} run={run} busy={busy} onError={onError} />
        : <CategoriesManager key={biz.id} business={biz} categories={state.categories} products={state.products} run={run} busy={busy} onError={onError} />}
    </div>
  );
}

function CouriersTab({ state, run, busy }: { state: OpsState; run: Run; busy: string | null }) {
  const couriers = state.users.filter((u) => u.role === 'repartidor');
  const readyOrders = state.orders.filter((o) => o.status === 'ready');
  return (
    <div className="space-y-5">
      <Panel kicker="Flota" title={`Repartidores (${couriers.length})`}>
        {couriers.length === 0 ? <Empty title="Sin repartidores" text="Crea usuarios con rol Repartidor en la pestaña Usuarios." /> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{couriers.map((c) => {
            const mine = state.orders.filter((o) => o.deliveryPartnerUserId === String(c.id));
            const onRoute = mine.filter((o) => o.status === 'on_the_way' || o.status === 'ready').length;
            const done = mine.filter((o) => o.status === 'delivered').length;
            return (
              <div key={c.id} className="rounded-xl bg-muted/40 p-4" data-testid={`card-courier-${c.id}`}>
                <div className="flex items-start justify-between gap-2"><div><p className="font-bold">{c.name}</p><p className="text-xs text-muted-foreground">{c.email} · {c.phone || 'sin teléfono'}</p></div><Pill on={c.active}>{c.active ? 'Activo' : 'Inactivo'}</Pill></div>
                <p className="mt-3 font-mono-app text-xs">{onRoute} asignados en curso · {done} entregados</p>
                <button className={`${c.active ? btnDanger : btnGhost} mt-3 w-full`} disabled={busy === `u-${c.id}`} onClick={() => void run(`u-${c.id}`, () => api(`/api/operations/users/${c.id}`, 'PATCH', { name: c.name, email: c.email, role: c.role, phone: c.phone, address: c.address, active: !c.active }), c.active ? 'Repartidor desactivado.' : 'Repartidor activado.')} data-testid={`button-courier-toggle-${c.id}`}>{c.active ? 'Desactivar' : 'Activar'}</button>
              </div>);
          })}</div>
        )}
      </Panel>
      <Panel kicker="Delivery" title={`Pedidos listos para asignar (${readyOrders.length})`}>
        <OrderBoard orders={state.orders} couriers={state.users} isAdmin run={run} busy={busy} onlyReady />
      </Panel>
    </div>
  );
}

function PaymentsTab({ state }: { state: OpsState }) {
  const orders = [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Panel kicker="Derivado de pedidos reales" title="Pagos">
      <p className="mb-4 text-xs text-muted-foreground">Métodos e importes declarados en los pedidos. La entrega confirma la venta, pero no verifica el cobro ni una transferencia bancaria.</p>
      {orders.length === 0 ? <Empty title="Sin pedidos" text="Aún no hay pedidos registrados." /> : (
        <TableWrap label="Tabla de pagos"><table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/50"><tr><th className={thCls}>Pedido</th><th className={thCls}>Negocio</th><th className={thCls}>Método</th><th className={thCls}>Monto</th><th className={thCls}>Situación</th></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.id} className="border-t border-border/60" data-testid={`row-payment-${o.id}`}>
              <td className={tdCls}>#{o.id}<br /><span className="text-xs text-muted-foreground">{fmtDate(o.createdAt)}</span></td>
              <td className={tdCls}>{o.restaurantName}</td>
              <td className={tdCls}>{paymentLabels[o.paymentMethod]}</td>
              <td className={`${tdCls} font-mono-app`}>{money(o.total)}</td>
              <td className={tdCls}>{o.status === 'delivered' ? <Pill on>Entregado · cobro no verificado</Pill> : o.status === 'cancelled' ? <Pill on={false}>Anulado</Pill> : <Pill on={false}>Pendiente · {statusLabels[o.status]}</Pill>}</td>
            </tr>))}</tbody>
        </table></TableWrap>
      )}
    </Panel>
  );
}

function SettingsTab({ state, run, busy, onError }: { state: OpsState; run: Run; busy: string | null; onError: (m: string) => void }) {
  const [name, setName] = useState(state.settings.platformName);
  const [min, setMin] = useState(state.settings.minimumOrder);
  return (
    <Panel kicker="Plataforma" title="Configuración general">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextInput label="Nombre de la plataforma" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-settings-name" />
        <TextInput label="Pedido mínimo (S/)" type="number" min="0" step="0.1" value={min} onChange={(e) => setMin(e.target.value)} data-testid="input-settings-minimum" />
        <button className={btnPrimary} disabled={busy === 'settings'} data-testid="button-settings-save" onClick={() => {
          if (!name.trim()) return onError('El nombre de la plataforma es obligatorio.');
          if (!Number.isFinite(Number(min)) || Number(min) < 0) return onError('El pedido mínimo debe ser mayor o igual a cero.');
          void run('settings', () => api('/api/operations/settings', 'PATCH', { platformName: name.trim(), minimumOrder: String(min) }), 'Configuración guardada.');
        }}>{busy === 'settings' ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Panel>
  );
}
