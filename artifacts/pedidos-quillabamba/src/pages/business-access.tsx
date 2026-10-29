import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, KeyRound, LogOut, Store } from 'lucide-react';
import {
  getGetBusinessAccessQueryKey, useEnterBusinessAdministrator, useGetBusinessAccess, useOpenCashShift,
  useSetupBusinessAdministrator,
} from '@workspace/api-client-react';
import { clearSession, readSession } from '@/pages/role-access';
import { Banner, Empty, LoadError, SelectInput, Skeleton, TextInput, btnGhost, btnPrimary } from '@/components/ops/ui';
import { errText } from '@/lib/cash-format';
import { BrandLogo } from '@/components/brand-logo';
export { default as CashierPortalPage } from '@/pages/cashier-portal';

function Shell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  return (
    <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
      <header className="border-b border-border/70 bg-[#f7f5ee]">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <BrandLogo />
          <div>
            <p className="font-display font-bold">QUILLAYAA</p>
            <p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Acceso al negocio</p>
          </div>
          <button onClick={onLogout} className="ml-auto flex min-h-11 items-center gap-2 rounded-full bg-primary px-3.5 text-xs font-bold text-white"><LogOut className="h-3.5 w-3.5" /> Salir</button>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">{children}</div>
    </main>
  );
}

export function BusinessAccessPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const access = useGetBusinessAccess({ query: { queryKey: getGetBusinessAccessQueryKey(), retry: false } });
  const enterAdmin = useEnterBusinessAdministrator();
  const setupAdmin = useSetupBusinessAdministrator();
  const openShift = useOpenCashShift();
  const [step, setStep] = useState<'choose' | 'cashier' | 'administrator'>('choose');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmation, setAdminConfirmation] = useState('');
  const [bizId, setBizId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const logout = () => { clearSession(); setLocation('/login'); };
  const data = access.data;

  useEffect(() => { if (data?.mode === 'cashier') setLocation('/business/cashier'); }, [data?.mode, setLocation]);

  const businesses = data?.businesses ?? [];
  const selectedBiz = bizId ?? businesses[0]?.id ?? null;

  const chooseAdmin = () => {
    setMessage(null);
    if (readSession()?.role === 'administrador_sistema') { setLocation('/business'); return; }
    setAdminUsername('');
    setAdminPassword('');
    setAdminConfirmation('');
    setStep('administrator');
  };
  const adminSetup = data?.administratorCredentialsConfigured === false;
  const adminPending = setupAdmin.isPending || enterAdmin.isPending;
  const submitAdministrator = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPending) return;
    setMessage(null);
    if (adminSetup && adminPassword !== adminConfirmation) {
      setMessage({ kind: 'error', text: 'Las contraseñas no coinciden.' }); return;
    }
    const mutation = adminSetup ? setupAdmin : enterAdmin;
    mutation.mutate({ data: { username: adminUsername.trim(), password: adminPassword } }, {
      onSuccess: (res) => {
        setAdminPassword(''); setAdminConfirmation('');
        qc.setQueryData(getGetBusinessAccessQueryKey(), res);
        void qc.invalidateQueries();
        setLocation('/business');
      },
      onError: (error) => {
        setAdminPassword(''); setAdminConfirmation('');
        setMessage({ kind: 'error', text: errText(error, 'No se pudo acceder a la administración.') });
        void access.refetch();
      },
    });
  };
  const submitCashier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiz) return;
    setMessage(null);
    openShift.mutate({ data: { businessId: selectedBiz, username: username.trim(), password } }, {
      onSuccess: () => { setPassword(''); void qc.invalidateQueries({ queryKey: getGetBusinessAccessQueryKey() }); setLocation('/business/cashier'); },
      onError: (err) => { setPassword(''); setMessage({ kind: 'error', text: errText(err, 'Usuario o contraseña de caja incorrectos.') }); },
    });
  };

  return (
    <Shell onLogout={logout}>
      <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">{readSession()?.email ?? 'Sesión de negocio'}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">¿Cómo vas a trabajar hoy?</h1>
      <div className="mt-6 space-y-4">
        <Banner message={message} />
        {access.isLoading ? <Skeleton /> : access.error ? (
          <LoadError error={errText(access.error, 'No se pudo verificar tu acceso.')} onRetry={() => void access.refetch()} />
        ) : !data || businesses.length === 0 ? (
          <Empty title="Aún no tienes un negocio asignado" text="Pide al administrador del sistema que te asigne un negocio para abrir caja o administrarlo." />
        ) : data.mode === 'cashier' ? <Skeleton /> : step === 'choose' && data.mode !== 'cashier_login' ? (
          <div className="grid gap-4 sm:grid-cols-[1.2fr_1fr]">
            <button onClick={() => { setStep('cashier'); setMessage(null); }} data-testid="access-choice-cashier"
              className="group flex min-h-48 flex-col items-center justify-center gap-5 rounded-2xl bg-primary p-6 text-center text-white transition hover:-translate-y-0.5">
              <KeyRound className="h-6 w-6 text-secondary" />
              <span>
                <span className="block font-display text-2xl font-bold">Cajero</span>
              </span>
            </button>
            <button onClick={chooseAdmin} disabled={enterAdmin.isPending} data-testid="access-choice-administrator"
              className="flex min-h-48 flex-col items-center justify-center gap-5 rounded-2xl bg-card p-6 text-center ring-1 ring-border transition hover:-translate-y-0.5 disabled:opacity-60">
              <Briefcase className="h-6 w-6 text-accent" />
              <span>
                <span className="block font-display text-2xl font-bold">Administrador del negocio</span>
              </span>
            </button>
          </div>
        ) : step === 'administrator' && data.mode !== 'cashier_login' ? (
          <form onSubmit={submitAdministrator} className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6 animate-rise" data-testid="administrator-access-form">
            <button type="button" disabled={adminPending} onClick={() => {
              setStep('choose'); setAdminPassword(''); setAdminConfirmation(''); setMessage(null);
            }} className={btnGhost} data-testid="administrator-back"><ArrowLeft className="h-4 w-4" /> Volver</button>
            <div>
              <h2 className="font-display text-xl font-bold">{adminSetup ? 'Crea tu acceso de administrador' : 'Ingresa como administrador'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{adminSetup
                ? 'Es tu primera vez. Crea el usuario y la contraseña que usarás para administrar tu negocio.'
                : 'Ingresa el usuario y la contraseña de administrador que creaste anteriormente.'}</p>
              <p className="mt-2 text-xs text-muted-foreground">Este acceso protege la administración y es independiente del correo y la contraseña con los que inicias sesión en la app.</p>
            </div>
            <TextInput label={adminSetup ? 'Crea tu usuario de administrador' : 'Usuario de administrador'}
              value={adminUsername} onChange={e => setAdminUsername(e.target.value)} disabled={adminPending}
              autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              minLength={3} maxLength={40} pattern={'[a-zA-Z0-9._\\-]+'} required data-testid="administrator-username" />
            {adminSetup && <p className="text-xs text-muted-foreground">De 3 a 40 caracteres. Usa letras sin tildes, números, puntos, guiones o guion bajo.</p>}
            <TextInput label={adminSetup ? 'Crea tu contraseña' : 'Contraseña de administrador'} type="password"
              value={adminPassword} onChange={e => setAdminPassword(e.target.value)} disabled={adminPending}
              autoComplete={adminSetup ? 'new-password' : 'current-password'}
              minLength={8} maxLength={128} required data-testid="administrator-password" />
            {adminSetup && <>
              <p className="text-xs text-muted-foreground">La contraseña debe tener al menos 8 caracteres.</p>
              <TextInput label="Confirma tu contraseña" type="password" value={adminConfirmation}
                onChange={e => setAdminConfirmation(e.target.value)} disabled={adminPending}
                autoComplete="new-password" minLength={8} maxLength={128} required data-testid="administrator-password-confirmation" />
            </>}
            <button type="submit" disabled={adminPending || !adminUsername.trim() || !adminPassword || (adminSetup && !adminConfirmation)}
              className={`${btnPrimary} w-full`} data-testid="administrator-submit">
              {adminPending ? 'Verificando…' : adminSetup ? 'Crear acceso y entrar' : 'Entrar como administrador'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCashier} className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-border sm:p-6 animate-rise">
            {data.mode !== 'cashier_login' && <button type="button" onClick={() => setStep('choose')} className={btnGhost} data-testid="cashier-back"><ArrowLeft className="h-4 w-4" /> Volver</button>}
            <div>
              <h2 className="font-display text-xl font-bold">Abrir caja</h2>
              <p className="mt-1 text-sm text-muted-foreground">Turno mañana: <b className="font-mono-app">caja1m</b> · Turno tarde: <b className="font-mono-app">caja1t</b>. La hora de apertura la registra el servidor.</p>
            </div>
            {businesses.length > 1 && (
              <SelectInput label="Negocio" value={selectedBiz ?? ''} onChange={(e) => setBizId(Number(e.target.value))}>
                {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectInput>
            )}
            {businesses.length === 1 && <p className="text-sm font-semibold">{businesses[0].name}</p>}
            <TextInput label="Usuario de caja" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" autoCapitalize="none" required data-testid="cashier-username" />
            <TextInput label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required data-testid="cashier-password" />
            <button type="submit" disabled={openShift.isPending || !username.trim() || !password} className={`${btnPrimary} w-full`} data-testid="cashier-open">
              {openShift.isPending ? 'Abriendo caja…' : 'Abrir caja'}
            </button>
          </form>
        )}
      </div>
    </Shell>
  );
}

export function BusinessModeGate({ mode, children }: { mode: 'administrator' | 'cashier'; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const isSystemAdmin = readSession()?.role === 'administrador_sistema';
  const skip = mode === 'administrator' && isSystemAdmin;
  const access = useGetBusinessAccess({ query: { queryKey: getGetBusinessAccessQueryKey(), enabled: !skip, retry: false } });
  const current = access.data?.mode;
  const target = skip || !current ? null : mode === 'cashier'
    ? (current === 'cashier' ? null : '/business/access')
    : (current === 'administrator' ? null : current === 'cashier' ? '/business/cashier' : '/business/access');

  useEffect(() => { if (target) setLocation(target); }, [target, setLocation]);

  if (skip) return <>{children}</>;
  if (access.error) {
    return <main className="min-h-[100dvh] bg-[#f1efe7] p-6"><div className="mx-auto max-w-xl"><LoadError error={errText(access.error, 'No se pudo verificar tu acceso.')} onRetry={() => void access.refetch()} /></div></main>;
  }
  if (!current || target) return <main className="min-h-[100dvh] bg-[#f1efe7] p-6"><div className="mx-auto max-w-xl"><Skeleton /></div></main>;
  return <>{children}</>;
}

export default BusinessAccessPage;
