import { Link } from 'wouter';
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from '@workspace/api-client-react';
import { useOperationsState, money } from '@/lib/operations-api';
import { SalesReport } from './sales-report';
import { Panel, LoadError, Skeleton, btnGhost } from './ui';
import { clearSession, readSession } from '@/pages/role-access';

export function OperationsDashboard() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 10_000 } });
  const { state, error, reload } = useOperationsState();
  return <main className="min-h-screen bg-background p-4 text-primary md:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-bold">QUILLAYAA · Administración</p><h1 className="mt-2 font-display text-3xl font-bold">Hola, {readSession()?.name}</h1><p className="mt-2 text-sm">{new Date().toLocaleDateString('es-PE',{timeZone:'America/Lima',dateStyle:'full'})}</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/admin/manage" className={btnGhost}>Gestionar plataforma</Link><button className={btnGhost} onClick={()=>{clearSession();window.location.assign(`${import.meta.env.BASE_URL}login`);}}>Salir</button></div>
      </header>
      {(error || summary.isError) && <LoadError error={error || 'No se pudo cargar el resumen.'} onRetry={()=>{void reload();void summary.refetch();}} />}
      {!summary.data ? <Skeleton/> : <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Ventas de productos hoy',money(summary.data.todaySales)],['Pedidos activos',summary.data.activeOrders],['Negocios habilitados',summary.data.restaurants],['Repartidores habilitados',summary.data.deliveryPartners]].map(([label,value])=><Panel key={label} title={String(value)}><p className="text-xs">{label}</p></Panel>)}
      </section>}
      <nav className="flex flex-wrap gap-2" aria-label="Operaciones">
        {[['users','Usuarios'],['approvals','Solicitudes'],['businesses','Negocios'],['orders','Pedidos'],['couriers','Repartidores'],['products','Productos'],['settings','Configuración']].map(([tab,label])=><Link className={btnGhost} key={tab} href={`/admin/manage?tab=${tab}`}>{label}</Link>)}
      </nav>
      {state && <SalesReport businesses={state.businesses} />}
    </div>
  </main>;
}
