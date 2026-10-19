import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { ArrowRight, Bike, Building2, Check, ClipboardList, Eye, EyeOff, LogOut, MapPin, PackageCheck, ShieldCheck, Store, Users, Utensils } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { confirmRegistrationCode, sendRegistrationCode } from '@workspace/api-client-react';
import { useAuth } from '@workspace/replit-auth-web';

export type UserRole = 'cliente' | 'administrador_negocio' | 'repartidor' | 'administrador_sistema';

export type UserSession = {
  name: string;
  email: string;
  role: UserRole;
};

type StoredAccount = UserSession & { password: string };
type PendingVerification = { account: StoredAccount; mode: 'login' | 'register' };
type AuthField = 'name' | 'email' | 'password' | 'verificationCode' | 'passwordConfirmation';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span id={id} role="alert" className="mt-1.5 block text-xs font-bold text-red-600" data-testid={`${id}-error`}>{message}</span>;
}

type PasswordVisibilityInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  toggleTestId: string;
};

function PasswordVisibilityInput({ className, toggleTestId, ...inputProps }: PasswordVisibilityInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block">
      <input {...inputProps} type={visible ? 'text' : 'password'} className={`${className ?? ''} pr-11`} />
      <button
        type="button"
        disabled={inputProps.disabled}
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        aria-controls={inputProps.id}
        data-testid={toggleTestId}
        className="absolute inset-y-0 right-2 inline-flex w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </span>
  );
}

function normalizeEmail(email: string) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function hasAccountWithEmail(accounts: StoredAccount[], email: string) {
  const normalizedEmail = normalizeEmail(email);
  return accounts.some((account) => normalizeEmail(account.email) === normalizedEmail);
}

const SESSION_KEY = 'quillayaa-session';
const ACCOUNTS_KEY = 'quillayaa-accounts';
const SYSTEM_ADMIN_ACCOUNT: StoredAccount = {
  name: 'Administrador del sistema',
  email: 'admin@gmail.com',
  password: 'admin',
  role: 'administrador_sistema',
};
const DEMO_TEST_ACCOUNTS: StoredAccount[] = import.meta.env.DEV ? [
  { name: 'Cliente de prueba', email: 'cliente@gmail.com', password: 'cliente', role: 'cliente' },
  { name: 'Repartidor de prueba', email: 'repartidor@gmail.com', password: 'repartidor', role: 'repartidor' },
] : [];

export const roleHome: Record<UserRole, string> = {
  cliente: '/',
  administrador_negocio: '/business',
  repartidor: '/delivery',
  administrador_sistema: '/admin',
};

export const roleLabels: Record<UserRole, string> = {
  cliente: 'Cliente',
  administrador_negocio: 'Administrador del negocio',
  repartidor: 'Repartidor',
  administrador_sistema: 'Administrador del sistema',
};

export const roleDescriptions: Record<UserRole, string> = {
  cliente: 'Compra, carrito y seguimiento de pedidos.',
  administrador_negocio: 'Negocio, productos y pedidos recibidos.',
  repartidor: 'Entregas asignadas y estados de delivery.',
  administrador_sistema: 'Usuarios, negocios, operaciones y reportes.',
};

function normalizeRole(role: unknown): UserRole | null {
  if (role === 'administrador') return 'administrador_sistema';
  if (role === 'cliente' || role === 'administrador_negocio' || role === 'repartidor' || role === 'administrador_sistema') return role;
  return null;
}

export function readSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Omit<UserSession, 'role'> & { role: unknown };
    const role = normalizeRole(parsed.role);
    if (!role) return null;
    const session = { name: parsed.name, email: parsed.email, role };
    if (parsed.role !== role) saveSession(session);
    return session;
  } catch {
    return null;
  }
}

function saveSession(session: UserSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = `/api/logout?returnTo=${encodeURIComponent('/login')}`;
}

export function syncSecureSession(user: { email: string | null; firstName: string | null; lastName: string | null; role: UserRole } | null) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  saveSession({ name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Usuario', email: user.email || '', role: user.role });
}

export function SecureRoleAuthPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, login } = useAuth();
  useEffect(() => {
    if (user) setLocation(roleHome[user.role]);
  }, [user, setLocation]);
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5"><div className="w-full max-w-md rounded-3xl bg-card p-8 text-center ring-1 ring-border"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="h-5 w-5" /></div><h1 className="mt-5 font-display text-2xl font-bold text-primary">Accede a Quillayaa</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Usa tu cuenta segura para ver pedidos y compartir la ubicación del reparto.</p><button disabled={isLoading} onClick={login} className="mt-6 min-h-12 w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{isLoading ? 'Verificando sesión…' : 'Iniciar sesión'}</button></div></main>;
}

function readAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [SYSTEM_ADMIN_ACCOUNT, ...DEMO_TEST_ACCOUNTS];
    const parsed = JSON.parse(raw) as Array<Omit<StoredAccount, 'role'> & { role: unknown }>;
    const accounts = parsed.flatMap((account) => {
      const role = normalizeRole(account.role);
      return role ? [{ ...account, role }] : [];
    });
    const systemAdminEmail = normalizeEmail(SYSTEM_ADMIN_ACCOUNT.email);
    const demoEmails = new Set(DEMO_TEST_ACCOUNTS.map((account) => normalizeEmail(account.email)));
    const storedSystemAdmin = accounts.find((account) => (
      normalizeEmail(account.email) === systemAdminEmail
      && account.role === SYSTEM_ADMIN_ACCOUNT.role
    ));
    const accountsWithoutBuiltIns = accounts.filter((account) => (
      normalizeEmail(account.email) !== systemAdminEmail
      && !demoEmails.has(normalizeEmail(account.email))
    ));
    const normalizedAccounts = [
      ...accountsWithoutBuiltIns,
      ...DEMO_TEST_ACCOUNTS,
      storedSystemAdmin ?? SYSTEM_ADMIN_ACCOUNT,
    ];
    if (JSON.stringify(normalizedAccounts) !== JSON.stringify(parsed)) {
      writeAccounts(normalizedAccounts);
    }
    return normalizedAccounts;
  } catch {
    return [SYSTEM_ADMIN_ACCOUNT, ...DEMO_TEST_ACCOUNTS];
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearFieldError = (field: AuthField) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  useEffect(() => {
    setPendingVerification(null);
    setVerificationCode('');
    setNotice('');
    setFieldErrors({});
    setRole('cliente');
  }, [mode]);

  const submit = async () => {
    if (submitting) return;
    setNotice('');
    const normalizedEmail = normalizeEmail(email);
    const errors: Partial<Record<AuthField, string>> = {};
    if (mode === 'register' && !name.trim()) {
      errors.name = 'Falta completar el campo «Nombre completo».';
    }
    if (!normalizedEmail) {
      errors.email = 'Falta completar el campo «Correo electrónico».';
    } else if (!normalizedEmail.includes('@')) {
      errors.email = 'Ingresa un correo electrónico válido.';
    }
    if (!password.trim()) {
      errors.password = 'Falta completar el campo «Contraseña».';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const accounts = readAccounts();
    if (mode === 'register') {
      if (role === 'administrador_sistema') {
        setNotice('El administrador del sistema no puede registrarse. Inicia sesión con tu cuenta.');
        return;
      }
      if (hasAccountWithEmail(accounts, normalizedEmail)) {
        setNotice('Ese correo ya está registrado. Inicia sesión para continuar.');
        return;
      }
      const account: StoredAccount = { name: name.trim(), email: normalizedEmail, password, role };
      setSubmitting(true);
      try {
        const result = await sendRegistrationCode({ email: normalizedEmail, role });
        if (!result.sent) throw new Error('No se pudo enviar el código.');
        setPendingVerification({ account, mode: 'register' });
        setVerificationCode('');
      } catch (error) {
        setNotice(apiErrorMessage(error, 'No pudimos enviar el código. Inténtalo más tarde.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const account = accounts.find((candidate) => normalizeEmail(candidate.email) === normalizedEmail && candidate.password === password && candidate.role === role);
    if (!account) {
      setNotice('Los datos no coinciden con una cuenta de ese rol. Regístrate primero o revisa tu selección.');
      return;
    }
    const isDevelopmentTestAccount = DEMO_TEST_ACCOUNTS.some((testAccount) => (
      normalizeEmail(testAccount.email) === normalizedEmail
      && testAccount.password === password
      && testAccount.role === role
    ));
    if (role !== 'administrador_sistema' && !isDevelopmentTestAccount) {
      setSubmitting(true);
      try {
        const result = await sendRegistrationCode({ email: account.email, role: account.role });
        if (!result.sent) throw new Error('No se pudo enviar el código.');
        setPendingVerification({ account, mode: 'login' });
        setVerificationCode('');
      } catch (error) {
        setNotice(apiErrorMessage(error, 'No pudimos enviar el código. Inténtalo más tarde.'));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    saveSession({ name: account.name, email: account.email, role: account.role });
    setLocation(roleHome[account.role]);
  };

  const verifyCode = async () => {
    if (!pendingVerification || pendingVerification.mode !== mode || submitting) return;
    setNotice('');
    if (!/^\d{6}$/.test(verificationCode)) {
      setFieldErrors((current) => ({
        ...current,
        verificationCode: verificationCode.trim()
          ? 'Ingresa los seis dígitos del código.'
          : 'Falta completar el campo «Código de verificación».',
      }));
      return;
    }
    clearFieldError('verificationCode');
    setSubmitting(true);
    try {
      const result = await confirmRegistrationCode({
        email: pendingVerification.account.email,
        role: pendingVerification.account.role,
        code: verificationCode,
      });
      if (!result.verified) throw new Error('No se pudo verificar el correo.');
      const accounts = readAccounts();
      if (mode === 'login') {
        const account = accounts.find((candidate) => normalizeEmail(candidate.email) === normalizeEmail(pendingVerification.account.email)
          && candidate.password === pendingVerification.account.password
          && candidate.role === pendingVerification.account.role);
        if (!account) {
          setPendingVerification(null);
          setNotice('La cuenta cambió. Ingresa tus datos nuevamente.');
          return;
        }
        saveSession({ name: account.name, email: account.email, role: account.role });
        setLocation(roleHome[account.role]);
        return;
      }
      if (pendingVerification.account.role === 'administrador_sistema') {
        setPendingVerification(null);
        setNotice('El administrador del sistema no puede registrarse.');
        return;
      }
      if (hasAccountWithEmail(accounts, pendingVerification.account.email)) {
        setPendingVerification(null);
        setNotice('Ese correo ya está registrado. Inicia sesión para continuar.');
        return;
      }
      writeAccounts([...accounts, pendingVerification.account]);
      saveSession({ name: pendingVerification.account.name, email: pendingVerification.account.email, role: pendingVerification.account.role });
      setLocation(roleHome[pendingVerification.account.role]);
    } catch (error) {
      setNotice(apiErrorMessage(error, 'No se pudo verificar el código. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  const roleOptions: Array<{ value: UserRole; icon: typeof Users }> = [
    { value: 'cliente', icon: Users },
    { value: 'administrador_negocio', icon: Building2 },
    { value: 'repartidor', icon: Bike },
    { value: 'administrador_sistema', icon: ShieldCheck },
  ];

  if (mode === 'login' && new URLSearchParams(window.location.search).get('recovery') === '1') {
    return <PasswordRecoveryPage />;
  }

  return (
    <div className="paper-grid min-h-[100dvh] bg-background px-4 py-5 sm:px-5 sm:py-6">
      <Link href="/" className="mx-auto flex max-w-[1100px] items-center gap-3" data-testid="link-role-auth-brand">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary"><Utensils className="h-4 w-4" /></span>
        <span className="font-display text-lg font-bold text-primary">QUILLAYAA<span className="text-accent">.</span></span>
      </Link>
      <div className="mx-auto mt-6 max-w-[1080px] overflow-hidden rounded-3xl bg-card ring-1 ring-border warm-shadow sm:mt-10 md:grid md:grid-cols-[.8fr_1.2fr]">
        <div className="relative min-h-[340px] overflow-hidden bg-violet-100 p-6 sm:min-h-[400px] sm:p-8 md:min-h-[650px] md:p-10">
          <img src="/quillabamba-access.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="relative flex h-full flex-col justify-between">
            <p className="font-mono-app text-[10px] uppercase tracking-[.18em] text-white drop-shadow-md">Acceso por roles</p>
            <div>
              <h1 className="font-display text-3xl font-bold leading-tight text-white drop-shadow-md md:text-4xl">Una plataforma,<br /><span className="text-secondary">cuatro formas</span><br />de trabajar.</h1>
              <p className="mt-5 max-w-xs text-sm leading-6 text-white/90 drop-shadow-md">Cada persona entra al espacio que corresponde a su cargo dentro de QUILLAYAA.</p>
            </div>
          </div>
        </div>
        <div className="p-5 min-[360px]:p-6 sm:p-12">
          <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">{mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu acceso'}</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-primary">{mode === 'login' ? 'Ingresa a tu plataforma' : 'Regístrate según tu cargo'}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Selecciona tu rol para abrir únicamente las herramientas que necesitas.</p>

          {mode === 'login' && DEMO_TEST_ACCOUNTS.length > 0 && <div className="mt-5 rounded-2xl border border-secondary bg-secondary/20 p-4" data-testid="notice-demo-access">
            <p className="text-xs font-extrabold text-primary">Accesos de prueba · solo desarrollo</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Cliente: cliente@gmail.com · contraseña: cliente</p>
            <p className="text-xs leading-5 text-muted-foreground">Repartidor: repartidor@gmail.com · contraseña: repartidor</p>
          </div>}

          {mode === 'register' && <label className="mt-7 block"><span className="mb-1.5 block text-xs font-bold text-primary">Nombre completo</span><input value={name} disabled={!!pendingVerification} onChange={(event) => { setName(event.target.value); setNotice(''); clearFieldError('name'); }} autoComplete="name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'role-name-error' : undefined} className={`h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus:border-accent disabled:opacity-60 sm:text-sm ${fieldErrors.name ? 'border-red-600 focus:border-red-600' : 'border-input'}`} data-testid="input-role-name" />{fieldErrors.name && <FieldError id="role-name-error" message={fieldErrors.name} />}</label>}
          <label className="mt-5 block"><span className="mb-1.5 block text-xs font-bold text-primary">Correo electrónico</span><input type="email" value={email} disabled={!!pendingVerification} onChange={(event) => { setEmail(event.target.value); setNotice(''); clearFieldError('email'); }} autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'role-email-error' : undefined} className={`h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus:border-accent disabled:opacity-60 sm:text-sm ${fieldErrors.email ? 'border-red-600 focus:border-red-600' : 'border-input'}`} placeholder="tu@correo.com" data-testid="input-role-email" />{fieldErrors.email && <FieldError id="role-email-error" message={fieldErrors.email} />}</label>
          <div className="mt-5">
            <label htmlFor="role-password" className="mb-1.5 block text-xs font-bold text-primary">Contraseña</label>
            <PasswordVisibilityInput id="role-password" value={password} disabled={!!pendingVerification} onChange={(event) => { setPassword(event.target.value); setNotice(''); clearFieldError('password'); }} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'role-password-error' : undefined} className={`h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus:border-accent disabled:opacity-60 sm:text-sm ${fieldErrors.password ? 'border-red-600 focus:border-red-600' : 'border-input'}`} placeholder="••••••••" data-testid="input-role-password" toggleTestId="button-toggle-role-password" />
            {fieldErrors.password && <FieldError id="role-password-error" message={fieldErrors.password} />}
          </div>
          {mode === 'login' && <Link href="/login?recovery=1" className="mt-2 block text-right text-xs font-bold text-accent" data-testid="link-forgot-password">¿Olvidaste tu contraseña?</Link>}

          <div className="mt-7">
            <p className="mb-3 text-xs font-bold text-primary">¿Cómo ingresarás?</p>
            <div className="grid gap-2 min-[360px]:grid-cols-2">
              {roleOptions.filter(({ value }) => mode === 'login' || value !== 'administrador_sistema').map(({ value, icon: Icon }) => <button type="button" key={value} disabled={!!pendingVerification} onClick={() => setRole(value)} className={`rounded-xl p-3 text-left ring-1 transition disabled:cursor-not-allowed ${role === value ? 'bg-secondary/35 text-primary ring-accent' : 'bg-background text-muted-foreground ring-border hover:ring-secondary'}`} data-testid={`button-role-${value}`}>
                <Icon className="h-4 w-4" />
                <span className="mt-2 block text-xs font-extrabold">{roleLabels[value]}</span>
                <span className="mt-1 block text-[10px] leading-4">{roleDescriptions[value]}</span>
              </button>)}
            </div>
          </div>

          {pendingVerification?.mode === mode && <div className="mt-6 rounded-2xl bg-secondary/20 p-4 ring-1 ring-secondary">
            <p className="text-sm font-bold text-primary">Revisa tu correo</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Enviamos un código de seis dígitos a {pendingVerification.account.email}. Caduca en 10 minutos. {mode === 'register' ? 'La cuenta se creará cuando lo confirmes.' : 'Entrarás a tu plataforma cuando lo confirmes.'}</p>
            <label className="mt-4 block"><span className="text-xs font-bold text-primary">Código de verificación</span><input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={verificationCode} onChange={event => { setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('verificationCode'); }} aria-invalid={Boolean(fieldErrors.verificationCode)} aria-describedby={fieldErrors.verificationCode ? 'role-verification-code-error' : undefined} className={`mt-1.5 h-11 w-full rounded-xl border bg-background px-3 text-center text-lg font-bold tracking-[.3em] ${fieldErrors.verificationCode ? 'border-red-600' : 'border-input'}`} placeholder="000000" data-testid="input-role-verification-code" />{fieldErrors.verificationCode && <FieldError id="role-verification-code-error" message={fieldErrors.verificationCode} />}</label>
            <button type="button" disabled={submitting} onClick={() => { setPendingVerification(null); setVerificationCode(''); setNotice(''); }} className="mt-3 min-h-11 text-left text-xs font-bold text-accent underline">Cambiar correo o solicitar otro código</button>
          </div>}
          {notice && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700" data-testid="status-role-auth-feedback">{notice}</p>}
          <button disabled={submitting} onClick={pendingVerification?.mode === mode ? verifyCode : submit} className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-extrabold text-white disabled:opacity-60" data-testid="button-role-auth-submit">{submitting ? 'Procesando...' : pendingVerification?.mode === mode ? mode === 'register' ? 'Verificar y crear cuenta' : 'Verificar e ingresar' : mode === 'login' && role === 'administrador_sistema' ? 'Entrar a mi plataforma' : 'Enviar código a mi correo'} <ArrowRight className="h-4 w-4 text-secondary" /></button>
          <p className="mt-6 text-center text-xs text-muted-foreground">{mode === 'login' ? '¿Aún no tienes cuenta? ' : '¿Ya tienes cuenta? '}<Link href={mode === 'login' ? '/register' : '/login'} className="font-bold text-accent" data-testid="link-role-auth-switch">{mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</Link></p>
        </div>
      </div>
    </div>
  );
}

export function PasswordRecoveryPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [pending, setPending] = useState<{ email: string; role: UserRole } | null>(null);
  const [complete, setComplete] = useState(false);
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const clearFieldError = (field: AuthField) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const requestCode = async () => {
    if (submitting) return;
    setNotice('');
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      setFieldErrors({
        email: normalizedEmail
          ? 'Ingresa un correo electrónico válido.'
          : 'Falta completar el campo «Correo electrónico».',
      });
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const account = readAccounts().find((candidate) => normalizeEmail(candidate.email) === normalizedEmail);
      const role = account?.role ?? 'cliente';
      const result = await sendRegistrationCode({ email: normalizedEmail, role });
      if (!result.sent) throw new Error('No se pudo enviar el código.');
      setPending({ email: normalizedEmail, role });
      setVerificationCode('');
      setNotice('');
    } catch (error) {
      setNotice(apiErrorMessage(error, 'No pudimos enviar el código. Inténtalo más tarde.'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!pending || submitting) return;
    setNotice('');
    const errors: Partial<Record<AuthField, string>> = {};
    if (!/^\d{6}$/.test(verificationCode)) {
      errors.verificationCode = verificationCode.trim()
        ? 'Ingresa los seis dígitos del código.'
        : 'Falta completar el campo «Código de verificación».';
    }
    if (password.length < 8) {
      errors.password = password.trim()
        ? 'La nueva contraseña debe tener al menos 8 caracteres.'
        : 'Falta completar el campo «Nueva contraseña».';
    }
    if (!passwordConfirmation.trim()) {
      errors.passwordConfirmation = 'Falta completar el campo «Confirma la nueva contraseña».';
    } else if (password !== passwordConfirmation) {
      errors.passwordConfirmation = 'Las contraseñas no coinciden.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await confirmRegistrationCode({
        email: pending.email,
        role: pending.role,
        code: verificationCode,
      });
      if (!result.verified) throw new Error('No se pudo verificar el código.');

      const accounts = readAccounts();
      const accountIndex = accounts.findIndex((account) => (
        normalizeEmail(account.email) === pending.email
        && account.role === pending.role
      ));
      if (accountIndex < 0) {
        setNotice('No pudimos restablecer el acceso. Comprueba el correo e inténtalo nuevamente.');
        return;
      }

      const updatedAccounts = accounts.map((account, index) => (
        index === accountIndex ? { ...account, password } : account
      ));
      writeAccounts(updatedAccounts);
      setComplete(true);
      setPassword('');
      setPasswordConfirmation('');
    } catch (error) {
      setNotice(apiErrorMessage(error, 'No se pudo verificar el código. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="paper-grid min-h-[100dvh] bg-background px-4 py-5 sm:px-5 sm:py-6">
      <Link href="/" className="mx-auto flex max-w-[1100px] items-center gap-3" data-testid="link-password-recovery-brand">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary"><Utensils className="h-4 w-4" /></span>
        <span className="font-display text-lg font-bold text-primary">QUILLAYAA<span className="text-accent">.</span></span>
      </Link>
      <main className="mx-auto mt-8 max-w-xl rounded-3xl bg-card p-6 ring-1 ring-border warm-shadow sm:mt-12 sm:p-10">
        <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Recupera tu acceso</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-primary">
          {complete ? 'Contraseña actualizada' : '¿Olvidaste tu contraseña?'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {complete
            ? 'Tu cuenta y tus datos siguen en el mismo lugar. Ya puedes iniciar sesión con tu nueva contraseña.'
            : 'Te enviaremos un código a tu correo para que puedas elegir una contraseña nueva.'}
        </p>

        {complete ? (
          <Link href="/login" className="mt-7 flex h-12 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white" data-testid="link-password-recovery-login">
            Volver a iniciar sesión
          </Link>
        ) : pending ? (
          <>
            <div className="mt-6 rounded-2xl bg-secondary/20 p-4 ring-1 ring-secondary">
              <p className="text-sm font-bold text-primary">Revisa tu correo</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Enviamos un código de seis dígitos a {pending.email}. Caduca en 10 minutos.
              </p>
            </div>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-xs font-bold text-primary">Código de verificación</span>
              <input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={verificationCode} onChange={(event) => { setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6)); clearFieldError('verificationCode'); }} aria-invalid={Boolean(fieldErrors.verificationCode)} aria-describedby={fieldErrors.verificationCode ? 'recovery-code-error' : undefined} className={`h-11 w-full rounded-xl border bg-background px-3 text-center text-lg font-bold tracking-[.3em] ${fieldErrors.verificationCode ? 'border-red-600' : 'border-input'}`} placeholder="000000" data-testid="input-password-recovery-code" />
              {fieldErrors.verificationCode && <FieldError id="recovery-code-error" message={fieldErrors.verificationCode} />}
            </label>
            <div className="mt-5">
              <label htmlFor="recovery-new-password" className="mb-1.5 block text-xs font-bold text-primary">Nueva contraseña</label>
              <PasswordVisibilityInput id="recovery-new-password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); clearFieldError('password'); }} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'recovery-new-password-error' : undefined} className={`h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus:border-accent sm:text-sm ${fieldErrors.password ? 'border-red-600 focus:border-red-600' : 'border-input'}`} placeholder="Al menos 8 caracteres" data-testid="input-password-recovery-new" toggleTestId="button-toggle-recovery-new-password" />
              {fieldErrors.password && <FieldError id="recovery-new-password-error" message={fieldErrors.password} />}
            </div>
            <div className="mt-5">
              <label htmlFor="recovery-confirm-password" className="mb-1.5 block text-xs font-bold text-primary">Confirma la nueva contraseña</label>
              <PasswordVisibilityInput id="recovery-confirm-password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => { setPasswordConfirmation(event.target.value); clearFieldError('passwordConfirmation'); }} aria-invalid={Boolean(fieldErrors.passwordConfirmation)} aria-describedby={fieldErrors.passwordConfirmation ? 'recovery-confirm-password-error' : undefined} className={`h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus:border-accent sm:text-sm ${fieldErrors.passwordConfirmation ? 'border-red-600 focus:border-red-600' : 'border-input'}`} placeholder="Repite tu nueva contraseña" data-testid="input-password-recovery-confirm" toggleTestId="button-toggle-recovery-confirm-password" />
              {fieldErrors.passwordConfirmation && <FieldError id="recovery-confirm-password-error" message={fieldErrors.passwordConfirmation} />}
            </div>
            {notice && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700" data-testid="status-password-recovery">{notice}</p>}
            <button type="button" disabled={submitting} onClick={() => void resetPassword()} className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white disabled:opacity-60" data-testid="button-password-recovery-submit">
              {submitting ? 'Verificando…' : 'Verificar y cambiar contraseña'}
            </button>
            <button type="button" disabled={submitting} onClick={() => { setPending(null); setVerificationCode(''); setFieldErrors({}); setNotice(''); }} className="mt-3 min-h-11 w-full text-center text-xs font-bold text-accent underline">
              Cambiar correo o solicitar otro código
            </button>
          </>
        ) : (
          <>
            <label className="mt-6 block">
              <span className="mb-1.5 block text-xs font-bold text-primary">Correo electrónico</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError('email'); setNotice(''); }} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'recovery-email-error' : undefined} className={`h-11 w-full rounded-xl border bg-background px-3 text-base outline-none focus:border-accent sm:text-sm ${fieldErrors.email ? 'border-red-600 focus:border-red-600' : 'border-input'}`} placeholder="tu@correo.com" data-testid="input-password-recovery-email" />
              {fieldErrors.email && <FieldError id="recovery-email-error" message={fieldErrors.email} />}
            </label>
            {notice && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700" data-testid="status-password-recovery">{notice}</p>}
            <button type="button" disabled={submitting} onClick={() => void requestCode()} className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white disabled:opacity-60" data-testid="button-password-recovery-request">
              {submitting ? 'Enviando…' : 'Enviar código de recuperación'}
            </button>
            <Link href="/login" className="mt-5 block text-center text-xs font-bold text-accent" data-testid="link-password-recovery-back">Volver a iniciar sesión</Link>
          </>
        )}
      </main>
    </div>
  );
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (typeof data?.error === 'string') return data.error;
  }
  return fallback;
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
    { id: 'Q-1048', customer: 'Ana Lucía Torres', address: 'Jr. Junín 245, frente a la plaza', detail: '2 productos · S/ 38.50', tone: 'bg-[#ede4ff]' },
    { id: 'Q-1045', customer: 'Carlos Huamán', address: 'Av. Edgar de la Torre 810, Pueblo Nuevo', detail: '3 productos · S/ 64.00', tone: 'bg-[#f7e8bd]' },
  ];
  const session = readSession();
  const logout = () => { clearSession(); setLocation('/login'); };

  return <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
    <header className="border-b border-border/70 bg-[#f7f5ee]"><div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-5 md:px-8"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><Bike className="h-4 w-4" /></span><div><p className="font-display font-bold">QUILLAYAA</p><p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Panel de repartidor</p></div><div className="ml-auto flex items-center gap-3"><span className="hidden text-xs font-semibold text-muted-foreground sm:block">{session?.name || 'Repartidor'}</span><button onClick={logout} className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white" data-testid="button-delivery-logout"><LogOut className="h-3.5 w-3.5" /> Salir</button></div></div></header>
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Última milla</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">Mis entregas</h1><p className="mt-2 text-sm text-muted-foreground">Consulta la dirección y actualiza cada entrega.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-100 px-3 py-2 text-xs font-bold text-violet-800"><span className="h-2 w-2 rounded-full bg-violet-500" /> Disponible</span></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><PackageCheck className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">{deliveries.length}</p><p className="mt-1 text-xs font-bold">Entregas asignadas</p></div><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><MapPin className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">2</p><p className="mt-1 text-xs font-bold">Zonas de hoy</p></div><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><ClipboardList className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">S/ 102.50</p><p className="mt-1 text-xs font-bold">Total en ruta</p></div></div>
      <div className="mt-7 space-y-4">{deliveries.map((delivery) => <article key={delivery.id} className={`rounded-2xl p-5 ring-1 ring-border ${delivery.tone}`} data-testid={`card-delivery-assigned-${delivery.id}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><span className="font-mono-app text-[10px] font-bold uppercase tracking-[.16em] text-accent">Pedido {delivery.id}</span><h2 className="mt-2 font-display text-xl font-bold">{delivery.customer}</h2><p className="mt-2 flex items-start gap-2 text-sm leading-5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{delivery.address}</p><p className="mt-2 text-xs font-semibold text-primary/60">{delivery.detail}</p></div><span className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-bold">{statuses[delivery.id]}</span></div><div className="mt-5 flex flex-col gap-2 border-t border-primary/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-primary/60">Actualiza el estado cuando avances con la entrega.</p><select value={statuses[delivery.id]} onChange={(event) => setStatuses((current) => ({ ...current, [delivery.id]: event.target.value }))} className="h-10 rounded-xl border border-primary/15 bg-white/65 px-3 text-xs font-bold outline-none" data-testid={`select-delivery-status-${delivery.id}`}><option>En ruta</option><option>Pendiente de recoger</option><option>Entregado</option></select></div></article>)}</div>
    </div>
  </main>;
}