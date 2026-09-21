import { Banknote, BarChart3, Bike, Building2, PackageCheck, ShieldCheck, Users, Utensils } from 'lucide-react';
import { Link } from 'wouter';

type Role = {
  title: string;
  eyebrow: string;
  icon: typeof Users;
  tone: string;
  items: string[];
};

// Vista de arquitectura funcional incorporada desde el esquema de QUILLAYAA.
// Resume permisos, responsabilidades y el flujo central del pedido.
const roles: Role[] = [
  {
    title: 'Cliente',
    eyebrow: 'Compra y seguimiento',
    icon: Users,
    tone: 'bg-[#f7e8bd]',
    items: ['Registrarse e iniciar sesión', 'Ver productos y categorías', 'Gestionar carrito', 'Realizar y consultar pedidos'],
  },
  {
    title: 'Administrador del negocio',
    eyebrow: 'Operación del establecimiento',
    icon: Building2,
    tone: 'bg-[#dce9d7]',
    items: ['Registrar información y RUC', 'Gestionar productos y categorías', 'Controlar disponibilidad', 'Atender pedidos recibidos'],
  },
  {
    title: 'Repartidor',
    eyebrow: 'Última milla',
    icon: Bike,
    tone: 'bg-[#f1d7c7]',
    items: ['Ver entregas asignadas', 'Consultar dirección del cliente', 'Actualizar estado de entrega'],
  },
  {
    title: 'Administrador del sistema',
    eyebrow: 'Supervisión general',
    icon: ShieldCheck,
    tone: 'bg-[#d9e5ef]',
    items: ['Gestionar usuarios y negocios', 'Supervisar productos y pedidos', 'Gestionar repartidores', 'Consultar pagos y reportes'],
  },
];

export default function SystemMapPage() {
  return (
    <main className="min-h-[100dvh] bg-[#f7f5ee] px-5 py-8 text-primary md:px-10">
      <div className="mx-auto max-w-[1200px]">
        <Link href="/admin" className="text-xs font-bold text-muted-foreground hover:text-primary">
          ← Volver al panel
        </Link>
        <div className="mt-8 max-w-3xl">
          <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Arquitectura funcional</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em] sm:text-4xl">Mapa del sistema QUILLAYAA</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Cuatro roles, un pedido y dos procesos conectados: pago y delivery.</p>
        </div>

        <section className="mt-8 rounded-3xl bg-primary p-6 text-white shadow-[0_18px_50px_hsl(163_48%_18%/.15)] sm:p-9">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Utensils className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-[-.03em]">QUILLAYAA</h2>
            <p className="mt-1 text-sm text-white/60">Plataforma de pedidos de comida y bebidas</p>
          </div>
          <div className="mx-auto mt-8 h-8 w-px bg-white/20" />
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map(({ title, eyebrow, icon: Icon, tone, items }) => (
              <article key={title} className={`rounded-2xl p-5 text-primary ${tone}`} data-testid={`card-system-role-${title.toLowerCase()}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.14em] text-primary/55">{eyebrow}</p>
                    <h3 className="mt-2 font-display text-xl font-bold">{title}</h3>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/55"><Icon className="h-5 w-5" /></div>
                </div>
                <ul className="mt-5 space-y-2 border-t border-primary/10 pt-4 text-xs font-semibold leading-5">
                  {items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <div className="my-6 flex items-center justify-center gap-3 text-accent">
          <span className="hidden h-px flex-1 bg-border sm:block" />
          <span className="rounded-full bg-secondary px-4 py-2 font-mono-app text-[10px] font-bold uppercase tracking-[.14em] text-primary">Flujo central</span>
          <span className="hidden h-px flex-1 bg-border sm:block" />
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl bg-card p-6 text-center ring-1 ring-border">
            <PackageCheck className="mx-auto h-6 w-6 text-accent" />
            <h3 className="mt-4 font-display text-xl font-bold">Pedido</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">El cliente selecciona productos, confirma su dirección y recibe seguimiento.</p>
          </article>
          <article className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-6 text-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f7e8bd]"><Banknote className="h-5 w-5" /></div>
              <span className="font-mono-app text-lg text-accent">+</span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1d7c7]"><Bike className="h-5 w-5" /></div>
            </div>
            <h3 className="font-display text-xl font-bold">Pago y delivery</h3>
            <p className="text-sm leading-6 text-muted-foreground">Procesos asociados que avanzan junto al estado del pedido.</p>
          </article>
          <article className="rounded-2xl bg-card p-6 text-center ring-1 ring-border">
            <BarChart3 className="mx-auto h-6 w-6 text-accent" />
            <h3 className="mt-4 font-display text-xl font-bold">Reportes</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">La administración visualiza ventas, clientes y operación.</p>
          </article>
        </section>
      </div>
    </main>
  );
}