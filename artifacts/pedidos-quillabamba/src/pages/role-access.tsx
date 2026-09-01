import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Bike, Check, ClipboardList, LogOut, MapPin, PackageCheck, Store, Users, Utensils } from 'lucide-react';
import { Link, useLocation } from 'wouter';

export type UserRole = 'cliente' | 'administrador' | 'repartidor';

export type UserSession = {
  name: string;
  email: string;
  role: UserRole;
};

type StoredAccount = UserSession & { password: string };

const SESSION_KEY = 'quillayaa-session';
const ACCOUNTS_KEY = 'quillayaa-accounts';

export const roleHome: Record<UserRole, string> = {
  cliente: '/',
  administrador: '/admin',
  repartidor: '/delivery',
};

export const roleLabels: Record<UserRole, string> = {
  cliente: 'Cliente',
  administrador: 'Administrador',
  repartidor: 'Repartidor',
};

export const roleDescriptions: Record<UserRole, string> = {
  cliente: 'Compra, carrito y seguimiento de pedidos.',
  administrador: 'Productos, pedidos, pagos y reportes.',
  repartidor: 'Entregas asignadas y estados de delivery.',
};

export function readSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as UserSession : null;
  } catch {
    return null;
  }
}

function saveSession(session: UserSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) as StoredAccount[] : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function RoleAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('cliente');
  const [notice, setNotice] = useState('');

  const submit = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@') || !password.trim() || (mode === 'register' && !name.trim())) {
      setNotice('Completa nombre, correo y contraseña para continuar.');
      return;
    }

    const accounts = readAccounts();
    if (mode === 'register') {
      if (accounts.some((account) => account.email === normalizedEmail)) {
        setNotice('Ese correo ya está registrado. Inicia sesión para continuar.');
        return;
      }
      const account: StoredAccount = { name: name.trim(), email: normalizedEmail, password, role };
      writeAccounts([...accounts, account]);
      saveSession({ name: account.name, email: account.email, role: account.role });
      setLocation(roleHome[account.role]);
      return;
    }

    const account = accounts.find((candidate) => candidate.email === normalizedEmail && candidate.password === password && candidate.role === role);
    if (!account) {
      setNotice('Los datos no coinciden con una cuenta de ese rol. Regístrate primero o revisa tu selección.');
      return;
    }
    saveSession({ name: account.name, email: account.email, role: account.role });
    setLocation(roleHome[account.role]);
  };

  const roleOptions: Array<{ value: UserRole; icon: typeof Users }> = [
    { value: 'cliente', icon: Users },
    { value: 'administrador', icon: Store },
    { value: 'repartidor', icon: Bike },
  ];

  return (
    <div className="paper-grid min-h-[100dvh] bg-background px-5 py-6">
      <Link href="/" className="mx-auto flex max-w-[1100px] items-center gap-3" data-testid="link-role-auth-brand">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary"><Utensils className="h-4 w-4" /></span>
        <span className="font-display text-lg font-bold text-primary">QUILLAYAA<span className="text-accent">.</span></span>
      </Link>
      <div className="mx-auto mt-10 max-w-[1080px] overflow-hidden rounded-3xl bg-card ring-1 ring-border warm-shadow md:grid md:grid-cols-[.8fr_1.2fr]">
        <div className="relative hidden min-h-[650px] overflow-hidden bg-primary p-10 md:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(39_93%_59%/.35),transparent_45%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <p className="font-mono-app text-[10px] uppercase tracking-[.18em] text-secondary">Acceso por roles</p>
            <div>
              <h1 className="font-display text-4xl font-bold leading-tight text-white">Una plataforma,<br /><span className="text-secondary">tres formas</span><br />de trabajar.</h1>
              <p className="mt-5 max-w-xs text-sm leading-6 text-white/60">Cada persona entra al espacio que corresponde a su cargo dentro de QUILLAYAA.</p>
            </div>
          </div>
        </div>
        <div className="p-7 sm:p-12">
          <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">{mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu acceso'}</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-primary">{mode === 'login' ? 'Ingresa a tu plataforma' : 'Regístrate según tu cargo'}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Selecciona tu rol para abrir únicamente las herramientas que necesitas.</p>

          {mode === 'register' && <label className="mt-7 block"><span className="mb-1.5 block text-xs font-bold text-primary">Nombre completo</span><input value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" placeholder="María Quispe" data-testid="input-role-name" /></label>}
          <label className="mt-5 block"><span className="mb-1.5 block text-xs font-bold text-primary">Correo electrónico</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" placeholder="tu@correo.com" data-testid="input-role-email" /></label>
          <label className="mt-5 block"><span className="mb-1.5 block text-xs font-bold text-primary">Contraseña</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" placeholder="••••••••" data-testid="input-role-password" /></label>

          <div className="mt-7">
            <p className="mb-3 text-xs font-bold text-primary">¿Cómo ingresarás?</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {roleOptions.map(({ value, icon: Icon }) => <button type="button" key={value} onClick={() => setRole(value)} className={`rounded-xl p-3 text-left ring-1 transition ${role === value ? 'bg-secondary/35 text-primary ring-accent' : 'bg-background text-muted-foreground ring-border hover:ring-secondary'}`} data-testid={`button-role-${value}`}>
                <Icon className="h-4 w-4" />
                <span className="mt-2 block text-xs font-extrabold">{roleLabels[value]}</span>
                <span className="mt-1 block text-[10px] leading-4">{roleDescriptions[value]}</span>
              </button>)}
            </div>
          </div>

          {notice && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700" data-testid="status-role-auth-feedback">{notice}</p>}
          <button onClick={submit} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-extrabold text-white" data-testid="button-role-auth-submit">{mode === 'login' ? 'Entrar a mi plataforma' : 'Crear cuenta y continuar'} <ArrowRight className="h-4 w-4 text-secondary" /></button>
          <p className="mt-6 text-center text-xs text-muted-foreground">{mode === 'login' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}<Link href={mode === 'login' ? '/register' : '/login'} className="font-bold text-accent" data-testid="link-role-auth-switch">{mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</Link></p>
        </div>
      </div>
    </div>
  );
}

export function RoleGate({ allowed, children }: { allowed: UserRole[]; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const session = readSession();

  useEffect(() => {
    if (!session) setLocation('/login');
    else if (!allowed.includes(session.role)) setLocation(roleHome[session.role]);
  }, [allowed, session, setLocation]);

  if (!session) return <AccessNotice title="Necesitas iniciar sesión" text="Ingresa con tu cuenta para acceder a esta plataforma." />;
  if (!allowed.includes(session.role)) return <AccessNotice title="Acceso restringido" text={`Esta sección es para ${allowed.map((role) => roleLabels[role]).join(' o ')}.`} />;
  return <>{children}</>;
}

function AccessNotice({ title, text }: { title: string; text: string }) {
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5"><div className="max-w-md rounded-3xl bg-card p-8 text-center ring-1 ring-border"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Check className="h-5 w-5" /></div><h1 className="mt-5 font-display text-2xl font-bold text-primary">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p><Link href="/login" className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-xs font-bold text-white">Ir a iniciar sesión</Link></div></main>;
}

export function DeliveryPortalPage() {
  const [, setLocation] = useLocation();
  const [statuses, setStatuses] = useState<Record<string, string>>({ 'Q-1048': 'En ruta', 'Q-1045': 'Pendiente de recoger' });
  const deliveries = [
    { id: 'Q-1048', customer: 'Ana Lucía Torres', address: 'Jr. Junín 245, frente a la plaza', detail: '2 productos · S/ 38.50', tone: 'bg-[#dce9d7]' },
    { id: 'Q-1045', customer: 'Carlos Huamán', address: 'Av. Edgar de la Torre 810, Pueblo Nuevo', detail: '3 productos · S/ 64.00', tone: 'bg-[#f7e8bd]' },
  ];
  const session = readSession();
  const logout = () => { clearSession(); setLocation('/login'); };

  return <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
    <header className="border-b border-border/70 bg-[#f7f5ee]"><div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-5 md:px-8"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><Bike className="h-4 w-4" /></span><div><p className="font-display font-bold">QUILLAYAA</p><p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Panel de repartidor</p></div><div className="ml-auto flex items-center gap-3"><span className="hidden text-xs font-semibold text-muted-foreground sm:block">{session?.name || 'Repartidor'}</span><button onClick={logout} className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white" data-testid="button-delivery-logout"><LogOut className="h-3.5 w-3.5" /> Salir</button></div></div></header>
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Última milla</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">Mis entregas</h1><p className="mt-2 text-sm text-muted-foreground">Consulta la dirección y actualiza cada entrega.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Disponible</span></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><PackageCheck className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">{deliveries.length}</p><p className="mt-1 text-xs font-bold">Entregas asignadas</p></div><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><MapPin className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">2</p><p className="mt-1 text-xs font-bold">Zonas de hoy</p></div><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><ClipboardList className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">S/ 102.50</p><p className="mt-1 text-xs font-bold">Total en ruta</p></div></div>
      <div className="mt-7 space-y-4">{deliveries.map((delivery) => <article key={delivery.id} className={`rounded-2xl p-5 ring-1 ring-border ${delivery.tone}`} data-testid={`card-delivery-assigned-${delivery.id}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><span className="font-mono-app text-[10px] font-bold uppercase tracking-[.16em] text-accent">Pedido {delivery.id}</span><h2 className="mt-2 font-display text-xl font-bold">{delivery.customer}</h2><p className="mt-2 flex items-start gap-2 text-sm leading-5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{delivery.address}</p><p className="mt-2 text-xs font-semibold text-primary/60">{delivery.detail}</p></div><span className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-bold">{statuses[delivery.id]}</span></div><div className="mt-5 flex flex-col gap-2 border-t border-primary/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-primary/60">Actualiza el estado cuando avances con la entrega.</p><select value={statuses[delivery.id]} onChange={(event) => setStatuses((current) => ({ ...current, [delivery.id]: event.target.value }))} className="h-10 rounded-xl border border-primary/15 bg-white/65 px-3 text-xs font-bold outline-none" data-testid={`select-delivery-status-${delivery.id}`}><option>En ruta</option><option>Pendiente de recoger</option><option>Entregado</option></select></div></article>)}</div>
    </div>
  </main>;
}