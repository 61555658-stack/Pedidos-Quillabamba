import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Bike, Check, ClipboardList, LogOut, MapPin, PackageCheck, Store, Users, Utensils } from "lucide-react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/api";

export type UserRole = "cliente" | "administrador" | "repartidor";
export type UserSession = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  address?: string | null;
};

export const roleHome: Record<UserRole, string> = {
  cliente: "/",
  administrador: "/admin",
  repartidor: "/delivery",
};
export const roleLabels: Record<UserRole, string> = {
  cliente: "Cliente",
  administrador: "Administrador",
  repartidor: "Repartidor",
};
export const roleDescriptions: Record<UserRole, string> = {
  cliente: "Compra, carrito y seguimiento de pedidos.",
  administrador: "Productos, pedidos, pagos y reportes.",
  repartidor: "Entregas asignadas y estados de delivery.",
};

let currentSession: UserSession | null = null;
export function readSession(): UserSession | null {
  return currentSession;
}
export function clearSession(): void {
  currentSession = null;
  void fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  window.dispatchEvent(new Event("pq-auth-change"));
}

type AuthContextValue = {
  user: UserSession | null;
  loading: boolean;
  signIn: (email: string, password: string, role: UserRole) => Promise<UserSession>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<UserSession>;
  signOut: () => Promise<void>;
  updateProfile: (data: { name?: string; address?: string }) => Promise<UserSession>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider.");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(currentSession);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest<UserSession>("/api/auth/me")
      .then((nextUser) => {
        if (active) {
          currentSession = nextUser;
          setUser(nextUser);
        }
      })
      .catch(() => {
        if (active) {
          currentSession = null;
          setUser(null);
        }
      })
      .finally(() => active && setLoading(false));
    const onAuthChange = () => setUser(currentSession);
    window.addEventListener("pq-auth-change", onAuthChange);
    return () => {
      active = false;
      window.removeEventListener("pq-auth-change", onAuthChange);
    };
  }, []);

  const signIn = async (email: string, password: string, role: UserRole) => {
    const nextUser = await apiRequest<UserSession>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
    currentSession = nextUser;
    setUser(nextUser);
    return nextUser;
  };
  const register = async (name: string, email: string, password: string, role: UserRole) => {
    const nextUser = await apiRequest<UserSession>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role }),
    });
    currentSession = nextUser;
    setUser(nextUser);
    return nextUser;
  };
  const signOut = async () => {
    await apiRequest<void>("/api/auth/logout", { method: "POST" });
    currentSession = null;
    setUser(null);
  };
  const updateProfile = async (data: { name?: string; address?: string }) => {
    const nextUser = await apiRequest<UserSession>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    currentSession = nextUser;
    setUser(nextUser);
    return nextUser;
  };

  return <AuthContext.Provider value={{ user, loading, signIn, register, signOut, updateProfile }}>{children}</AuthContext.Provider>;
}

export function RoleAuthPage({ mode }: { mode: "login" | "register" }) {
  const [, setLocation] = useLocation();
  const { signIn, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("cliente");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!email.trim().includes("@") || password.length < 8 || (mode === "register" && !name.trim())) {
      setNotice("Completa los campos y usa una contraseña de al menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      const session = mode === "register"
        ? await register(name.trim(), email.trim().toLowerCase(), password, role)
        : await signIn(email.trim().toLowerCase(), password, role);
      setLocation(roleHome[session.role]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No pudimos iniciar sesión.");
    } finally {
      setSubmitting(false);
    }
  };
  const roleOptions: Array<{ value: UserRole; icon: typeof Users }> = [
    { value: "cliente", icon: Users },
    { value: "administrador", icon: Store },
    { value: "repartidor", icon: Bike },
  ];
  return <div className="paper-grid min-h-[100dvh] bg-background px-5 py-6">
    <Link href="/" className="mx-auto flex max-w-[1100px] items-center gap-3" data-testid="link-role-auth-brand">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary"><Utensils className="h-4 w-4" /></span>
      <span className="font-display text-lg font-bold text-primary">QUILLAYAA<span className="text-accent">.</span></span>
    </Link>
    <div className="mx-auto mt-12 grid max-w-[1100px] overflow-hidden rounded-3xl bg-card ring-1 ring-border warm-shadow md:grid-cols-[.8fr_1.2fr]">
      <div className="relative hidden min-h-[560px] overflow-hidden bg-primary md:block"><img src="/hero-quillabamba.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" /><div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-primary/10" /><div className="relative flex h-full flex-col justify-between p-10"><p className="font-mono-app text-[10px] uppercase tracking-[.18em] text-secondary">Acceso seguro</p><div><h1 className="font-display text-4xl font-bold leading-tight text-white">Comida local,<br /><span className="text-secondary">sin perderte</span><br />en el camino.</h1><p className="mt-4 max-w-xs text-sm leading-6 text-white/60">Tu cuenta se guarda en el servidor y tus pedidos te acompañan en cualquier dispositivo.</p></div></div></div>
      <div className="p-7 sm:p-12"><p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">{mode === "login" ? "Qué gusto verte" : "Una vuelta nueva"}</p><h1 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-primary">{mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{mode === "login" ? "Accede a tus pedidos y herramientas según tu rol." : "Registra tu cuenta para pedir o trabajar con Quillayamba."}</p>
        <div className="mt-8 space-y-4">{mode === "register" && <label className="block"><span className="mb-1.5 block text-xs font-bold text-primary">Tu nombre</span><input value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" placeholder="María" data-testid="input-register-name" /></label>}<label className="block"><span className="mb-1.5 block text-xs font-bold text-primary">Correo electrónico</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" placeholder="tu@correo.com" data-testid="input-auth-email" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-primary">Contraseña</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" placeholder="Mínimo 8 caracteres" data-testid="input-auth-password" /></label>
          <div><span className="mb-2 block text-xs font-bold text-primary">Tu rol</span><div className="grid gap-2 sm:grid-cols-3">{roleOptions.map(({ value, icon: Icon }) => <button type="button" key={value} onClick={() => setRole(value)} className={`rounded-xl border p-3 text-left transition ${role === value ? "border-primary bg-primary text-white" : "border-border bg-background text-muted-foreground"}`} data-testid={`button-role-${value}`}><Icon className="mb-2 h-4 w-4" /><p className="text-xs font-bold">{roleLabels[value]}</p><p className={`mt-1 text-[10px] leading-4 ${role === value ? "text-white/60" : "text-muted-foreground"}`}>{roleDescriptions[value]}</p></button>)}</div></div>
          {notice && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700" data-testid="status-auth-feedback">{notice}</p>}
          <button type="button" onClick={() => void submit()} disabled={submitting} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-extrabold text-white disabled:opacity-60" data-testid="button-auth-submit">{submitting ? "Guardando..." : mode === "login" ? "Entrar" : "Crear cuenta"}<ArrowRight className="h-4 w-4 text-secondary" /></button>
        </div><p className="mt-6 text-center text-xs text-muted-foreground">{mode === "login" ? "¿Aún no tienes cuenta? " : "¿Ya tienes cuenta? "}<Link href={mode === "login" ? "/register" : "/login"} className="font-bold text-accent" data-testid="link-auth-switch">{mode === "login" ? "Regístrate" : "Inicia sesión"}</Link></p>
      </div>
    </div>
  </div>;
}

export function RoleGate({ allowed, children }: { allowed: UserRole[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!loading && !user) setLocation("/login");
    else if (!loading && user && !allowed.includes(user.role)) setLocation(roleHome[user.role]);
  }, [allowed, loading, setLocation, user]);
  if (loading || !user || !allowed.includes(user.role)) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">Verificando tu sesión...</div>;
  }
  return <>{children}</>;
}

export function RoleHeader({ role }: { role: UserRole }) {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  return <header className="border-b border-border/70 bg-[#f7f5ee]"><div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-5 md:px-8"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">{role === "repartidor" ? <Bike className="h-4 w-4" /> : <Store className="h-4 w-4" />}</span><div><p className="font-display font-bold">QUILLAYAA</p><p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Panel de {roleLabels[role].toLowerCase()}</p></div><div className="ml-auto flex items-center gap-3"><span className="hidden text-xs font-semibold text-muted-foreground sm:block">{user?.name}</span><button onClick={() => void signOut().then(() => setLocation("/login"))} className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white"><LogOut className="h-3.5 w-3.5" /> Salir</button></div></div></header>;
}