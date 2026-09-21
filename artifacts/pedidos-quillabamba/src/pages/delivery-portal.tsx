import { useState } from 'react';
import { Bike, Check, ClipboardList, CreditCard, LogOut, MapPin, PackageCheck, Phone, Wallet } from 'lucide-react';
import { useLocation } from 'wouter';
import { clearSession, readSession } from '@/pages/role-access';

type DeliveryStatus = 'Pendiente de recoger' | 'En camino' | 'Entregado';

type Delivery = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  reference: string;
  items: string[];
  total: number;
  payment: 'Efectivo' | 'Yape' | 'Tarjeta';
  status: DeliveryStatus;
};

const initialDeliveries: Delivery[] = [
  { id: 'Q-1048', customer: 'Ana Lucía Torres', phone: '987 654 321', address: 'Jr. Junín 245', reference: 'Frente a la plaza de armas', items: ['Cecina con tacacho ×1', 'Chicha morada ×1'], total: 38.5, payment: 'Yape', status: 'En camino' },
  { id: 'Q-1045', customer: 'Carlos Huamán', phone: '986 111 204', address: 'Av. Edgar de la Torre 810', reference: 'Pueblo Nuevo, portón azul', items: ['Juane amazónico ×2', 'Cold brew ×1'], total: 48, payment: 'Efectivo', status: 'Pendiente de recoger' },
];

export default function DeliveryPortalPage() {
  const [, setLocation] = useLocation();
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const session = readSession();
  const assigned = deliveries.filter((delivery) => delivery.status !== 'Entregado');
  const completed = deliveries.filter((delivery) => delivery.status === 'Entregado');
  const updateStatus = (id: string, status: DeliveryStatus) => setDeliveries((current) => current.map((delivery) => delivery.id === id ? { ...delivery, status } : delivery));
  const logout = () => { clearSession(); setLocation('/login'); };
  const paymentIcon = (payment: Delivery['payment']) => payment === 'Yape' ? <Wallet className="h-4 w-4" /> : payment === 'Tarjeta' ? <CreditCard className="h-4 w-4" /> : <span className="font-mono-app text-xs font-bold">S/</span>;

  return <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
    <header className="border-b border-border/70 bg-[#f7f5ee]"><div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-5 md:px-8"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><Bike className="h-4 w-4" /></span><div><p className="font-display font-bold">QUILLAYAA</p><p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Panel de repartidor</p></div><div className="ml-auto flex items-center gap-3"><span className="hidden text-xs font-semibold text-muted-foreground sm:block">{session?.name || 'Repartidor'}</span><button onClick={logout} className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white" data-testid="button-delivery-logout"><LogOut className="h-3.5 w-3.5" /> Salir</button></div></div></header>
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Última milla</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">Mis entregas</h1><p className="mt-2 text-sm text-muted-foreground">Solo ves los pedidos que tienes asignados.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Disponible</span></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><PackageCheck className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">{assigned.length}</p><p className="mt-1 text-xs font-bold">Entregas pendientes</p></div><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><MapPin className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">{assigned.length}</p><p className="mt-1 text-xs font-bold">Direcciones de hoy</p></div><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><ClipboardList className="h-5 w-5 text-accent" /><p className="mt-4 font-mono-app text-2xl font-bold">{completed.length}</p><p className="mt-1 text-xs font-bold">Entregas realizadas</p></div></div>
      <section className="mt-8"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Pedidos asignados</h2><span className="font-mono-app text-[10px] uppercase tracking-wide text-muted-foreground">{assigned.length} activos</span></div><div className="mt-4 space-y-4">{assigned.map((delivery) => <article key={delivery.id} className="rounded-2xl bg-card p-5 ring-1 ring-border" data-testid={`card-delivery-assigned-${delivery.id}`}><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono-app text-[10px] font-bold uppercase tracking-[.16em] text-accent">Pedido {delivery.id}</span><span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{delivery.status}</span></div><h3 className="mt-3 font-display text-xl font-bold">{delivery.customer}</h3><p className="mt-2 flex items-start gap-2 text-sm leading-5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" /><span><b>{delivery.address}</b><br /><span className="text-xs text-muted-foreground">{delivery.reference}</span></span></p><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5 text-accent" /> {delivery.phone}</p></div><div className="rounded-2xl bg-[#f7f5ee] p-4 lg:min-w-[270px]"><p className="font-mono-app text-[10px] uppercase tracking-wide text-muted-foreground">Detalle del pedido</p><ul className="mt-3 space-y-2 text-xs font-semibold">{delivery.items.map((item) => <li key={item} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{item}</li>)}</ul><div className="mt-4 flex items-center justify-between border-t border-border pt-3"><span className="flex items-center gap-2 text-xs font-bold">{paymentIcon(delivery.payment)} {delivery.payment}</span><span className="font-mono-app text-sm font-bold">S/ {delivery.total.toFixed(2)}</span></div></div></div><div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Actualiza el pedido cuando cambie su situación.</p><select value={delivery.status} onChange={(event) => updateStatus(delivery.id, event.target.value as DeliveryStatus)} className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold outline-none" data-testid={`select-delivery-status-${delivery.id}`}><option>Pendiente de recoger</option><option>En camino</option><option>Entregado</option></select></div></article>)}</div></section>
      <section className="mt-9"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Entregas realizadas</h2><span className="font-mono-app text-[10px] uppercase tracking-wide text-muted-foreground">{completed.length} completadas</span></div>{completed.length ? <div className="mt-4 space-y-3">{completed.map((delivery) => <div key={delivery.id} className="flex flex-col justify-between gap-3 rounded-2xl bg-[#dce9d7] p-5 sm:flex-row sm:items-center" data-testid={`card-delivery-completed-${delivery.id}`}><div><p className="font-mono-app text-[10px] uppercase tracking-wide text-accent">Pedido {delivery.id}</p><p className="mt-1 font-bold">{delivery.customer}</p><p className="mt-1 text-xs text-muted-foreground">{delivery.address} · {delivery.payment} · S/ {delivery.total.toFixed(2)}</p></div><span className="flex items-center gap-2 text-xs font-bold text-emerald-800"><Check className="h-4 w-4" /> Entregado</span></div>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Tus entregas completadas aparecerán aquí.</div>}</section>
    </div>
  </main>;
}