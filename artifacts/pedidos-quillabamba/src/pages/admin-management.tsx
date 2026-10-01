import { useState, useMemo } from 'react';
import { BarChart3, Bike, Check, CircleDollarSign, ClipboardList, LayoutDashboard, LogOut, MapPin, PackageCheck, Pencil, Plus, Save, Settings2, Store, Tag, Trash2, UserCheck, Users, FileText, TrendingUp } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { clearSession } from '@/pages/role-access';

type ManagementTab = 'users' | 'business-admins' | 'businesses' | 'products' | 'categories' | 'orders' | 'payments' | 'couriers' | 'delivery' | 'reports' | 'stats' | 'settings';

type PlatformUser = { id: number; name: string; email: string; role: string; active: boolean };
type BusinessAdmin = { id: number; userId: number; name: string; email: string; businessName: string; accountActive: boolean; permissionsActive: boolean };
type BusinessAccount = { id: number; name: string; ruc: string; address: string; phone: string; administrator: string; active: boolean };
type ProductRow = { id: number; name: string; business: string; category: string; price: number; stock: number; active: boolean };
type CategoryRow = { id: number; name: string; business: string; active: boolean };
type OrderRow = { id: string; customer: string; business: string; summary: string; total: number; payment: string; status: string; assigned: string; date: string };
type PaymentRow = { id: string; orderId: string; method: string; amount: number; status: string; date: string };
type CourierRow = { id: number; userId: number; name: string; contact: string; status: string; availability: string; deliveries: number; active: boolean };

const initialUsers: PlatformUser[] = [
  { id: 1, name: 'María Fernanda', email: 'maria@correo.com', role: 'Cliente', active: true },
  { id: 2, name: 'Luis Cárdenas', email: 'luis@delivery.pe', role: 'Repartidor', active: true },
  { id: 3, name: 'Teresa Ríos', email: 'tere@sazon.pe', role: 'Administrador del negocio', active: true },
  { id: 4, name: 'Admin Sistema', email: 'admin@gmail.com', role: 'Administrador del sistema', active: true },
  { id: 5, name: 'Rosa Huamán', email: 'rosa@delivery.pe', role: 'Repartidor', active: true },
];

const initialBusinessAdmins: BusinessAdmin[] = [
  { id: 1, userId: 3, name: 'Teresa Ríos', email: 'tere@sazon.pe', businessName: 'Sazón de la Plaza', accountActive: true, permissionsActive: true },
];

const initialBusinesses: BusinessAccount[] = [
  { id: 1, name: 'Sazón de la Plaza', ruc: '20123456789', address: 'Jr. Comercio 123', phone: '987654321', administrator: 'Teresa Ríos', active: true },
  { id: 2, name: 'Cevichería La Ribera', ruc: '20456789123', address: 'Av. Bolognesi 456', phone: '987654322', administrator: 'José Salas', active: true },
  { id: 3, name: 'Café Pangoa', ruc: '20678912345', address: 'Plaza de Armas', phone: '987654323', administrator: 'Elena Vargas', active: false },
];

const initialProducts: ProductRow[] = [
  { id: 1, name: 'Cecina con tacacho', business: 'Sazón de la Plaza', category: 'Platos fuertes', price: 24, stock: 18, active: true },
  { id: 2, name: 'Juane amazónico', business: 'Sazón de la Plaza', category: 'Platos fuertes', price: 18, stock: 24, active: true },
  { id: 3, name: 'Inchicapi de gallina', business: 'Sazón de la Plaza', category: 'Sopas', price: 16, stock: 8, active: true },
  { id: 4, name: 'Cold brew de altura', business: 'Café Pangoa', category: 'Bebidas', price: 12, stock: 0, active: false },
];

const initialCategories: CategoryRow[] = [
  { id: 1, name: 'Platos fuertes', business: 'Sazón de la Plaza', active: true },
  { id: 2, name: 'Sopas', business: 'Sazón de la Plaza', active: true },
  { id: 3, name: 'Pescados', business: 'Cevichería La Ribera', active: true },
  { id: 4, name: 'Mariscos', business: 'Cevichería La Ribera', active: true },
  { id: 5, name: 'Bebidas', business: 'Café Pangoa', active: true },
  { id: 6, name: 'Postres', business: 'Café Pangoa', active: true },
];

const initialOrders: OrderRow[] = [
  { id: 'Q-1048', customer: 'María Fernanda', business: 'Sazón de la Plaza', summary: '1x Cecina, 1x Jugo', total: 45.5, status: 'En camino', payment: 'Yape', assigned: 'Luis Cárdenas', date: '25/10/2023 14:30' },
  { id: 'Q-1047', customer: 'Luis Alberto', business: 'Cevichería La Ribera', summary: '2x Ceviche', total: 31.5, status: 'En cocina', payment: 'Efectivo', assigned: 'Sin asignar', date: '25/10/2023 14:15' },
  { id: 'Q-1046', customer: 'Ana Lucía Torres', business: 'Café Pangoa', summary: '2x Cold brew', total: 26.5, status: 'Entregado', payment: 'Tarjeta', assigned: 'Rosa Huamán', date: '24/10/2023 13:00' },
  { id: 'Q-1045', customer: 'Carlos Ruiz', business: 'Sazón de la Plaza', summary: '1x Juane', total: 18.0, status: 'Entregado', payment: 'Yape', assigned: 'Luis Cárdenas', date: '22/10/2023 12:00' },
];

const initialPayments: PaymentRow[] = [
  { id: 'P-1048', orderId: 'Q-1048', method: 'Yape', amount: 45.5, status: 'Confirmado', date: '25/10/2023 14:30' },
  { id: 'P-1047', orderId: 'Q-1047', method: 'Efectivo', amount: 31.5, status: 'Pendiente', date: '25/10/2023 14:15' },
  { id: 'P-1046', orderId: 'Q-1046', method: 'Tarjeta', amount: 26.5, status: 'Confirmado', date: '24/10/2023 13:00' },
  { id: 'P-1045', orderId: 'Q-1045', method: 'Yape', amount: 18.0, status: 'Confirmado', date: '22/10/2023 12:00' },
];

const initialCouriers: CourierRow[] = [
  { id: 1, userId: 2, name: 'Luis Cárdenas', contact: '999888777', status: 'En ruta', availability: 'No disponible', deliveries: 1, active: true },
  { id: 2, userId: 5, name: 'Rosa Huamán', contact: '999888776', status: 'Libre', availability: 'Disponible', deliveries: 1, active: true },
];

const menu: Array<{ id: ManagementTab; label: string; icon: any }> = [
  { id: 'users', label: 'Usuarios', icon: Users },
  { id: 'business-admins', label: 'Admin. de negocio', icon: UserCheck },
  { id: 'businesses', label: 'Negocios', icon: Store },
  { id: 'products', label: 'Productos', icon: PackageCheck },
  { id: 'categories', label: 'Categorías', icon: Tag },
  { id: 'orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'payments', label: 'Pagos', icon: CircleDollarSign },
  { id: 'couriers', label: 'Repartidores', icon: Bike },
  { id: 'delivery', label: 'Delivery', icon: MapPin },
  { id: 'reports', label: 'Reportes', icon: FileText },
  { id: 'stats', label: 'Estadísticas', icon: TrendingUp },
  { id: 'settings', label: 'Configuración', icon: Settings2 },
];

export default function AdminManagementPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<ManagementTab>('users');
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  
  const [users, setUsers] = useState(initialUsers);
  const [businessAdmins, setBusinessAdmins] = useState(initialBusinessAdmins);
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [orders, setOrders] = useState(initialOrders);
  const [payments, setPayments] = useState(initialPayments);
  const [couriers, setCouriers] = useState(initialCouriers);

  // Forms and Inline Edits
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Cliente' });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserData, setEditingUserData] = useState({ name: '', email: '', role: '' });

  const [editingAdminId, setEditingAdminId] = useState<number | null>(null);
  const [editingAdminData, setEditingAdminData] = useState({ name: '', email: '', businessName: '' });

  const [newBusiness, setNewBusiness] = useState({ name: '', ruc: '', address: '', phone: '', administrator: '' });
  const [editingBusinessId, setEditingBusinessId] = useState<number | null>(null);
  const [editingBusinessData, setEditingBusinessData] = useState({ name: '', ruc: '', address: '', phone: '', administrator: '' });

  const [newCategory, setNewCategory] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [reportPeriod, setReportPeriod] = useState('Esta semana');

  const [notice, setNotice] = useState('');
  const [platformName, setPlatformName] = useState('QUILLAYAA');
  const [minimumOrder, setMinimumOrder] = useState('15');

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };
  
  // -- USERS --
  const handleCreateUser = () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      announce('Completa el nombre y correo del usuario.');
      return;
    }
    const id = Date.now();
    setUsers([{ id, name: newUser.name, email: newUser.email, role: newUser.role, active: true }, ...users]);
    
    if (newUser.role === 'Administrador del negocio') {
      setBusinessAdmins([...businessAdmins, { id: Date.now(), userId: id, name: newUser.name, email: newUser.email, businessName: 'Sin asignar', accountActive: true, permissionsActive: true }]);
    }
    if (newUser.role === 'Repartidor') {
      setCouriers([...couriers, { id: Date.now(), userId: id, name: newUser.name, contact: '', status: 'Libre', availability: 'Disponible', deliveries: 0, active: true }]);
    }
    setNewUser({ name: '', email: '', role: 'Cliente' });
    announce('Usuario creado correctamente.');
  };

  const handleSaveUser = (id: number) => {
    const oldUser = users.find(u => u.id === id);
    if (!oldUser) return;
    const patch = editingUserData;

    setUsers(users.map(u => u.id === id ? { ...u, ...patch } : u));
    
    if (oldUser.role !== patch.role) {
      if (patch.role === 'Administrador del negocio') {
        setBusinessAdmins([...businessAdmins, { id: Date.now(), userId: id, name: patch.name, email: patch.email, businessName: 'Sin asignar', accountActive: true, permissionsActive: true }]);
      } else if (oldUser.role === 'Administrador del negocio') {
        setBusinessAdmins(businessAdmins.filter(ba => ba.userId !== id));
      }
      if (patch.role === 'Repartidor') {
        setCouriers([...couriers, { id: Date.now(), userId: id, name: patch.name, contact: '', status: 'Libre', availability: 'Disponible', deliveries: 0, active: true }]);
      } else if (oldUser.role === 'Repartidor') {
        setCouriers(couriers.filter(c => c.userId !== id));
      }
    }
    
    setEditingUserId(null);
    announce('Usuario actualizado.');
  };

  const toggleUserActive = (id: number) => {
    setUsers(users.map(u => u.id === id ? { ...u, active: !u.active } : u));
    const user = users.find(u => u.id === id);
    announce(user?.active ? 'Usuario bloqueado.' : 'Usuario habilitado.');
  };

  // -- BUSINESS ADMINS --
  const handleSaveAdmin = (id: number) => {
    setBusinessAdmins(businessAdmins.map(a => a.id === id ? { ...a, ...editingAdminData } : a));
    setEditingAdminId(null);
    announce('Administrador del negocio actualizado.');
  };

  const toggleAdminAccount = (id: number) => {
    setBusinessAdmins(businessAdmins.map(a => a.id === id ? { ...a, accountActive: !a.accountActive } : a));
    announce('Estado de cuenta actualizado.');
  };

  const toggleAdminPerms = (id: number) => {
    setBusinessAdmins(businessAdmins.map(a => a.id === id ? { ...a, permissionsActive: !a.permissionsActive } : a));
    announce('Permisos actualizados.');
  };
  
  // -- BUSINESSES --
  const handleCreateBusiness = () => {
    if (!newBusiness.name.trim() || !newBusiness.ruc.trim()) {
      announce('Completa nombre y RUC del negocio.');
      return;
    }
    setBusinesses([{ id: Date.now(), ...newBusiness, active: true }, ...businesses]);
    setNewBusiness({ name: '', ruc: '', address: '', phone: '', administrator: '' });
    announce('Negocio registrado.');
  };

  const handleSaveBusiness = (id: number) => {
    const oldBiz = businesses.find(b => b.id === id);
    if (!oldBiz) return;

    const newName = editingBusinessData.name;
    const oldName = oldBiz.name;

    if (oldName !== newName) {
      setBusinessAdmins(admins => admins.map(a => a.businessName === oldName ? { ...a, businessName: newName } : a));
      setProducts(prods => prods.map(p => p.business === oldName ? { ...p, business: newName } : p));
      setCategories(cats => cats.map(c => c.business === oldName ? { ...c, business: newName } : c));
      setOrders(ords => ords.map(o => o.business === oldName ? { ...o, business: newName } : o));
    }

    setBusinesses(businesses.map(b => b.id === id ? { ...b, ...editingBusinessData } : b));
    setEditingBusinessId(null);
    announce('Datos del negocio guardados.');
  };

  const toggleBusinessActive = (id: number) => {
    setBusinesses(businesses.map(b => b.id === id ? { ...b, active: !b.active } : b));
    const biz = businesses.find(b => b.id === id);
    announce(biz?.active ? 'Negocio pausado.' : 'Negocio habilitado.');
  };
  
  const handleBusinessAccess = (businessId: number, targetTab: ManagementTab) => {
    setSelectedBusinessId(businessId);
    setTab(targetTab);
  };

  // -- CONTEXT-AWARE DATA --
  const selectedBusiness = businesses.find(b => b.id === selectedBusinessId);
  const isScopedTab = ['products', 'categories', 'orders', 'payments'].includes(tab);

  const filteredProducts = selectedBusiness ? products.filter(p => p.business === selectedBusiness.name) : [];
  const filteredCategories = selectedBusiness ? categories.filter(c => c.business === selectedBusiness.name) : [];
  const filteredOrders = selectedBusiness ? orders.filter(o => o.business === selectedBusiness.name) : [];
  const filteredPayments = selectedBusiness ? payments.filter(p => {
    const order = orders.find(o => o.id === p.orderId);
    return order?.business === selectedBusiness.name;
  }) : [];

  // -- PRODUCTS --
  const toggleProductActive = (id: number) => {
    setProducts(products.map(p => p.id === id ? { ...p, active: !p.active } : p));
    announce('Estado del producto actualizado.');
  };
  
  // -- CATEGORIES --
  const addCategory = () => {
    if (!newCategory.trim() || !selectedBusiness) return;
    setCategories([...categories, { id: Date.now(), name: newCategory.trim(), business: selectedBusiness.name, active: true }]);
    setNewCategory('');
    announce('Categoría creada.');
  };
  
  const saveCategory = (id: number) => {
    const cat = categories.find(c => c.id === id);
    if (cat && cat.name !== editingCategoryName && selectedBusiness) {
      setProducts(products.map(p => (p.category === cat.name && p.business === selectedBusiness.name) ? { ...p, category: editingCategoryName } : p));
    }
    setCategories(categories.map(c => c.id === id ? { ...c, name: editingCategoryName } : c));
    setEditingCategoryId(null);
    announce('Categoría renombrada.');
  };

  const toggleCategoryActive = (id: number) => {
    setCategories(categories.map(c => c.id === id ? { ...c, active: !c.active } : c));
    announce('Estado de categoría actualizado.');
  };
  
  // -- COURIERS --
  const toggleCourierActive = (id: number) => {
    setCouriers(couriers.map(c => {
      if (c.id === id) {
        const active = !c.active;
        return { ...c, active, availability: active ? 'Disponible' : 'No disponible' };
      }
      return c;
    }));
    announce('Estado de repartidor actualizado.');
  };
  
  // -- DELIVERY --
  const updateOrderStatus = (id: string, status: string) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
    announce(`Estado de pedido ${id} actualizado a ${status}.`);
  };
  const updateOrderAssigned = (id: string, assigned: string) => {
    setOrders(orders.map(o => o.id === id ? { ...o, assigned } : o));
    announce(`Repartidor asignado al pedido ${id}.`);
  };

  const logout = () => { clearSession(); setLocation('/login'); };

  // Deriving Stats and Chart Data (Global)
  const statsClients = users.filter(u => u.role === 'Cliente').length;
  const statsAdmins = businessAdmins.length;
  const statsBusinesses = businesses.length;
  const statsCouriers = couriers.length;
  const statsOrdersAll = orders.length;
  const statsOrdersPending = orders.filter(o => o.status !== 'Entregado' && o.status !== 'Cancelado').length;
  const statsOrdersDelivered = orders.filter(o => o.status === 'Entregado').length;
  const statsOrdersCancelled = orders.filter(o => o.status === 'Cancelado').length;
  const totalSales = orders.filter(o => o.status === 'Entregado').reduce((acc, o) => acc + o.total, 0);
  
  const paymentConfirmations = payments.filter(p => p.status === 'Confirmado').length;
  const paymentPendings = payments.filter(p => p.status === 'Pendiente').length;

  const chartData = useMemo(() => {
    const dates = orders.reduce((acc, o) => {
      const d = o.date.split(' ')[0];
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    let keys = Object.keys(dates).sort((a, b) => {
       const pa = a.split('/').reverse().join('');
       const pb = b.split('/').reverse().join('');
       return pa.localeCompare(pb);
    });
    
    if (keys.length === 0) keys = ['25/10/2023'];
    const max = Math.max(...Object.values(dates), 1);
    
    return keys.map(k => ({
      date: k.substring(0, 5),
      count: dates[k] || 0,
      height: ((dates[k] || 0) / max) * 100
    }));
  }, [orders]);

  const EmptyBusinessSelector = ({ title }: { title: string }) => (
    <div className="mt-2 rounded-2xl bg-card p-12 text-center ring-1 ring-border">
      <Store className="mx-auto h-10 w-10 text-muted-foreground opacity-50" />
      <h3 className="mt-4 font-display text-xl font-bold">Selecciona un negocio</h3>
      <p className="mt-2 text-sm text-muted-foreground">Debes elegir un negocio para gestionar sus {title}.</p>
    </div>
  );

  return <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
    <header className="border-b border-border/70 bg-[#f7f5ee]">
       <div className="mx-auto flex min-h-16 max-w-[1400px] items-center gap-2 px-4 py-2 md:h-16 md:gap-3 md:px-8 md:py-0">
         <Link href="/admin" className="flex min-w-0 items-center gap-2 md:gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
            <LayoutDashboard className="h-4 w-4" />
          </span>
           <div className="min-w-0">
            <p className="font-display font-bold">QUILLAYAA</p>
             <p className="font-mono-app text-[9px] uppercase leading-tight tracking-[.08em] text-muted-foreground sm:tracking-[.14em]">Administrador del sistema</p>
          </div>
        </Link>
         <div className="ml-auto flex shrink-0 items-center gap-2">
           <Link href="/admin" aria-label="Ir al dashboard" className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-2 py-2 text-xs font-bold text-muted-foreground hover:bg-muted sm:px-3"><LayoutDashboard className="h-4 w-4 sm:hidden" /><span className="sr-only sm:not-sr-only">Dashboard</span></Link>
           <button onClick={logout} className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-3 py-2 text-xs font-bold text-white sm:px-3.5" data-testid="button-admin-logout">
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        </div>
      </div>
    </header>
    
     <div className="mx-auto grid min-w-0 max-w-[1400px] gap-5 px-4 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:px-8 md:py-7">
       <aside className="h-fit min-w-0 rounded-2xl bg-primary p-2 text-white md:p-3">
        <p className="px-3 pb-3 pt-2 font-mono-app text-[10px] uppercase tracking-[.16em] text-white/45">Módulos</p>
         <nav aria-label="Módulos de administración" className="flex gap-1 overflow-x-auto overscroll-x-contain pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
          {menu.map(({ id, label, icon: Icon }) => (
             <button key={id} onClick={() => setTab(id)} className={`flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-3 text-left text-xs font-bold transition md:w-full ${tab === id ? 'bg-secondary text-primary' : 'text-white/65 hover:bg-white/10 hover:text-white'}`} data-testid={`button-admin-module-${id}`}>
               <Icon className="h-4 w-4 shrink-0" />{label}
            </button>
          ))}
        </nav>
      </aside>
      
      <section className="min-w-0">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Control de plataforma</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">{menu.find((item) => item.id === tab)?.label}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Administra las operaciones de QUILLAYAA desde un solo lugar.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-100 px-3 py-2 text-xs font-bold text-violet-800">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> Sistema operativo
          </span>
        </div>
        
        {notice && <p className="mt-5 rounded-xl bg-violet-50 px-4 py-3 text-xs font-bold text-violet-700" data-testid="status-management-feedback">{notice}</p>}
        
        {isScopedTab && (
          <div className="mt-7 mb-6 rounded-2xl bg-card p-5 ring-1 ring-border flex flex-col lg:flex-row lg:items-center justify-between gap-5">
           <div className="min-w-0 w-full lg:max-w-xs">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Contexto de negocio</p>
              <select
                value={selectedBusinessId || ''}
                onChange={e => setSelectedBusinessId(Number(e.target.value) || null)}
                 className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm font-bold text-primary focus:border-accent outline-none sm:h-10"
                data-testid="select-business-context"
              >
                <option value="">Seleccionar negocio...</option>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            {selectedBusiness && (
               <div className="flex min-w-0 flex-wrap gap-x-8 gap-y-4 break-words text-xs bg-muted/50 rounded-xl px-4 py-3 lg:bg-transparent lg:px-0 lg:py-0">
                <div><p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">RUC</p><p className="font-mono-app font-bold text-sm">{selectedBusiness.ruc}</p></div>
                <div><p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">Admin Responsable</p><p className="font-bold text-sm">{selectedBusiness.administrator}</p></div>
                <div>
                  <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">Estado</p>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 font-bold text-[10px] ${selectedBusiness.active ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-800'}`}>{selectedBusiness.active ? 'Activo' : 'Pausado'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'users' && <section className="mt-7 space-y-5">
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="font-display text-lg font-bold mb-4">Crear usuario</h2>
             <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
               <input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nombre completo" className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-sm sm:h-10 sm:min-w-[200px] sm:flex-1 sm:w-auto" />
               <input value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="Correo electrónico" className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-sm sm:h-10 sm:min-w-[200px] sm:flex-1 sm:w-auto" />
               <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold sm:h-10 sm:w-auto">
                <option>Cliente</option>
                <option>Administrador del negocio</option>
                <option>Repartidor</option>
                <option>Administrador del sistema</option>
              </select>
               <button onClick={handleCreateUser} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white sm:h-10">
                <Plus className="h-4 w-4 text-secondary" /> Agregar
              </button>
            </div>
          </div>
          
           <div role="region" aria-label="Tabla de usuarios" tabIndex={0} className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card ring-1 ring-border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-5 py-4">Usuario</th><th className="px-5 py-4">Correo</th><th className="px-5 py-4">Rol</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Acción</th></tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/70 last:border-0" data-testid={`row-admin-user-${user.id}`}>
                    <td className="px-5 py-4 font-bold">
                      {editingUserId === user.id ? 
                        <input value={editingUserData.name} onChange={e => setEditingUserData({ ...editingUserData, name: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs" /> 
                        : user.name}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {editingUserId === user.id ? 
                        <input value={editingUserData.email} onChange={e => setEditingUserData({ ...editingUserData, email: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs" /> 
                        : user.email}
                    </td>
                    <td className="px-5 py-4">
                      {editingUserId === user.id ? (
                        <select value={editingUserData.role} onChange={(e) => setEditingUserData({ ...editingUserData, role: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold">
                          <option>Cliente</option>
                          <option>Administrador del negocio</option>
                          <option>Repartidor</option>
                          <option>Administrador del sistema</option>
                        </select>
                      ) : <span className="text-xs font-semibold">{user.role}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${user.active ? 'bg-violet-100 text-violet-800' : 'bg-red-100 text-red-700'}`}>{user.active ? 'Activo' : 'Bloqueado'}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingUserId === user.id ? (
                           <button onClick={() => handleSaveUser(user.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-secondary p-2 text-primary sm:min-h-0 sm:min-w-0" aria-label={`Guardar ${user.name}`} data-testid="button-save-user"><Save className="h-3.5 w-3.5" /></button>
                        ) : (
                           <button onClick={() => { setEditingUserId(user.id); setEditingUserData({ name: user.name, email: user.email, role: user.role }); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-muted p-2 text-primary sm:min-h-0 sm:min-w-0" aria-label={`Editar ${user.name}`} data-testid="button-edit-user"><Pencil className="h-3.5 w-3.5" /></button>
                        )}
                         <button onClick={() => toggleUserActive(user.id)} className="min-h-11 rounded-lg bg-muted px-3 py-2 text-[10px] font-bold sm:min-h-0">{user.active ? 'Bloquear' : 'Habilitar'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>}

        {tab === 'business-admins' && <section role="region" aria-label="Tabla de administradores de negocio" tabIndex={0} className="mt-7 max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card ring-1 ring-border">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-4">Administrador</th><th className="px-5 py-4">Correo</th><th className="px-5 py-4">Negocio asociado</th><th className="px-5 py-4">Cuenta</th><th className="px-5 py-4">Permisos</th><th className="px-5 py-4 text-right">Acciones</th></tr>
            </thead>
            <tbody>
              {businessAdmins.map((admin) => (
                <tr key={admin.id} className="border-b border-border/70 last:border-0">
                  <td className="px-5 py-4 font-bold">
                    {editingAdminId === admin.id ? <input value={editingAdminData.name} onChange={e => setEditingAdminData({ ...editingAdminData, name: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs" /> : admin.name}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
                    {editingAdminId === admin.id ? <input value={editingAdminData.email} onChange={e => setEditingAdminData({ ...editingAdminData, email: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs" /> : admin.email}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-primary">
                    {editingAdminId === admin.id ? (
                      <select value={editingAdminData.businessName} onChange={e => setEditingAdminData({ ...editingAdminData, businessName: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold">
                        <option>Sin asignar</option>
                        {businesses.map(b => <option key={b.id}>{b.name}</option>)}
                      </select>
                    ) : admin.businessName}
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleAdminAccount(admin.id)} className={`min-h-11 rounded-full px-2.5 py-1 text-[10px] font-bold sm:min-h-0 ${admin.accountActive ? 'bg-violet-100 text-violet-800' : 'bg-red-100 text-red-700'}`}>{admin.accountActive ? 'Activa' : 'Bloqueada'}</button>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleAdminPerms(admin.id)} className={`min-h-11 rounded-full px-2.5 py-1 text-[10px] font-bold sm:min-h-0 ${admin.permissionsActive ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{admin.permissionsActive ? 'Completos' : 'Restringidos'}</button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {editingAdminId === admin.id ? (
                      <button onClick={() => handleSaveAdmin(admin.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-secondary p-2 text-primary sm:min-h-0 sm:min-w-0" aria-label={`Guardar ${admin.name}`}><Save className="h-3.5 w-3.5" /></button>
                    ) : (
                      <button onClick={() => { setEditingAdminId(admin.id); setEditingAdminData({ name: admin.name, email: admin.email, businessName: admin.businessName }); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-muted p-2 text-primary sm:min-h-0 sm:min-w-0" aria-label={`Editar ${admin.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>}

        {tab === 'businesses' && <section className="mt-7 space-y-6">
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="font-display text-lg font-bold mb-4">Registrar negocio</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_150px_1fr_150px_1fr_auto]">
              <input value={newBusiness.name} onChange={e => setNewBusiness({ ...newBusiness, name: e.target.value })} placeholder="Nombre comercial" className="h-11 min-w-0 rounded-xl border border-input bg-background px-3 text-xs sm:h-10" />
              <input value={newBusiness.ruc} onChange={e => setNewBusiness({ ...newBusiness, ruc: e.target.value })} placeholder="RUC" className="h-10 rounded-xl border border-input bg-background px-3 text-xs" />
              <input value={newBusiness.address} onChange={e => setNewBusiness({ ...newBusiness, address: e.target.value })} placeholder="Dirección" className="h-10 rounded-xl border border-input bg-background px-3 text-xs" />
              <input value={newBusiness.phone} onChange={e => setNewBusiness({ ...newBusiness, phone: e.target.value })} placeholder="Teléfono" className="h-10 rounded-xl border border-input bg-background px-3 text-xs" />
              <input value={newBusiness.administrator} onChange={e => setNewBusiness({ ...newBusiness, administrator: e.target.value })} placeholder="Admin responsable" className="h-10 rounded-xl border border-input bg-background px-3 text-xs" />
              <button onClick={handleCreateBusiness} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white sm:h-10">
                <Plus className="h-4 w-4 text-secondary" /> Registrar
              </button>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {businesses.map((business) => (
              <article key={business.id} className="rounded-2xl bg-card p-5 ring-1 ring-border flex flex-col" data-testid={`card-admin-business-${business.id}`}>
                {editingBusinessId === business.id ? (
                  <div className="space-y-3 flex-1">
                    <input value={editingBusinessData.name} onChange={e => setEditingBusinessData({ ...editingBusinessData, name: e.target.value })} placeholder="Nombre" className="h-9 w-full rounded-lg border border-input px-2 text-xs font-bold" />
                    <input value={editingBusinessData.ruc} onChange={e => setEditingBusinessData({ ...editingBusinessData, ruc: e.target.value })} placeholder="RUC" className="h-9 w-full rounded-lg border border-input px-2 text-xs font-mono-app" />
                    <input value={editingBusinessData.address} onChange={e => setEditingBusinessData({ ...editingBusinessData, address: e.target.value })} placeholder="Dirección" className="h-9 w-full rounded-lg border border-input px-2 text-xs" />
                    <input value={editingBusinessData.phone} onChange={e => setEditingBusinessData({ ...editingBusinessData, phone: e.target.value })} placeholder="Teléfono" className="h-9 w-full rounded-lg border border-input px-2 text-xs" />
                    <input value={editingBusinessData.administrator} onChange={e => setEditingBusinessData({ ...editingBusinessData, administrator: e.target.value })} placeholder="Admin responsable" className="h-9 w-full rounded-lg border border-input px-2 text-xs" />
                    
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => handleSaveBusiness(business.id)} className="min-h-11 flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white">Guardar</button>
                      <button onClick={() => setEditingBusinessId(null)} className="min-h-11 flex-1 rounded-xl bg-muted px-3 py-2 text-xs font-bold">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                        <Store className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingBusinessId(business.id); setEditingBusinessData({ ...business }); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-muted p-1.5 text-primary hover:bg-border sm:min-h-0 sm:min-w-0" aria-label={`Editar ${business.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${business.active ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-800'}`}>{business.active ? 'Activo' : 'Pausado'}</span>
                      </div>
                    </div>
                    <h2 className="mt-4 font-display text-lg font-bold">{business.name}</h2>
                    <p className="mt-1 font-mono-app text-[10px] text-muted-foreground">RUC {business.ruc}</p>
                    <div className="mt-3 space-y-1 mb-4 flex-1">
                      <p className="text-xs text-muted-foreground"><span className="font-semibold text-primary">Dir:</span> {business.address}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-semibold text-primary">Tel:</span> {business.phone}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-semibold text-primary">Admin:</span> {business.administrator}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-border pt-4 mt-auto">
                      <button onClick={() => handleBusinessAccess(business.id, 'products')} className="min-h-11 rounded-lg bg-background border border-border px-2 py-2 text-[10px] font-bold hover:bg-muted transition sm:min-h-0" data-testid={`btn-goto-products-${business.id}`}>Productos</button>
                      <button onClick={() => handleBusinessAccess(business.id, 'categories')} className="min-h-11 rounded-lg bg-background border border-border px-2 py-2 text-[10px] font-bold hover:bg-muted transition sm:min-h-0" data-testid={`btn-goto-categories-${business.id}`}>Categorías</button>
                      <button onClick={() => handleBusinessAccess(business.id, 'orders')} className="min-h-11 rounded-lg bg-background border border-border px-2 py-2 text-[10px] font-bold hover:bg-muted transition sm:min-h-0" data-testid={`btn-goto-orders-${business.id}`}>Pedidos</button>
                      <button onClick={() => handleBusinessAccess(business.id, 'payments')} className="min-h-11 rounded-lg bg-background border border-border px-2 py-2 text-[10px] font-bold hover:bg-muted transition sm:min-h-0" data-testid={`btn-goto-payments-${business.id}`}>Pagos</button>
                    </div>
                    <button onClick={() => toggleBusinessActive(business.id)} className="mt-2 w-full rounded-xl bg-muted px-3 py-2.5 text-xs font-bold transition hover:bg-accent/10 hover:text-accent">
                      {business.active ? 'Pausar temporalmente' : 'Reactivar negocio'}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>}

        {tab === 'products' && (
          !selectedBusiness ? <EmptyBusinessSelector title="productos" /> : (
            <section role="region" aria-label="Tabla de productos" tabIndex={0} className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card ring-1 ring-border">
              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center">
                  <PackageCheck className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="mt-4 text-sm font-bold text-muted-foreground">No hay productos registrados para este negocio.</p>
                </div>
              ) : (
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-4">Producto</th><th className="px-5 py-4">Categoría</th><th className="px-5 py-4">Precio</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4 text-right">Estado</th></tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="border-b border-border/70 last:border-0" data-testid={`row-admin-product-${product.id}`}>
                        <td className="px-5 py-4 font-bold">{product.name}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{product.category}</td>
                        <td className="px-5 py-4 font-mono-app text-xs">S/ {product.price.toFixed(2)}</td>
                        <td className="px-5 py-4">
                          <span className={product.stock === 0 ? 'font-bold text-red-700' : ''}>{product.stock > 0 ? product.stock : 'Agotado'}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button onClick={() => toggleProductActive(product.id)} className={`min-h-11 rounded-full px-2.5 py-1 text-[10px] font-bold sm:min-h-0 ${product.active ? 'bg-violet-100 text-violet-800' : 'bg-muted text-muted-foreground'}`}>
                            {product.active ? 'Activo' : 'Desactivado'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        )}

        {tab === 'categories' && (
          !selectedBusiness ? <EmptyBusinessSelector title="categorías" /> : (
            <section className="min-w-0 rounded-2xl bg-card p-4 ring-1 ring-border sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Nueva categoría" className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm" data-testid="input-admin-category" />
                <button onClick={addCategory} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white" data-testid="button-admin-add-category">
                  <Plus className="h-4 w-4 text-secondary" /> Crear
                </button>
              </div>
              
              {filteredCategories.length === 0 ? (
                <div className="mt-8 p-8 text-center">
                  <Tag className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="mt-4 text-sm font-bold text-muted-foreground">No hay categorías registradas para este negocio.</p>
                </div>
              ) : (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {filteredCategories.map((category) => (
                    <div key={category.id} className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      {editingCategoryId === category.id ? (
                        <input value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} className="h-11 min-w-0 w-full flex-1 rounded-lg border border-input bg-background px-2 text-xs font-bold sm:h-8" />
                      ) : (
                        <span className="flex min-w-0 items-center gap-2 break-words text-sm font-bold">
                          <Tag className="h-4 w-4 shrink-0 text-accent" />{category.name}
                        </span>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-2 sm:ml-4 sm:shrink-0 sm:gap-3">
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground border border-border">
                          {filteredProducts.filter(p => p.category === category.name).length} prod.
                        </span>
                        <button onClick={() => toggleCategoryActive(category.id)} className={`min-h-11 rounded-full px-2 py-1 text-[10px] font-bold sm:min-h-0 ${category.active ? 'bg-violet-100 text-violet-800' : 'bg-muted text-muted-foreground'}`}>
                          {category.active ? 'Activa' : 'Desactivada'}
                        </button>
                        {editingCategoryId === category.id ? (
                          <button onClick={() => saveCategory(category.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-secondary p-1.5 text-primary sm:min-h-0 sm:min-w-0" aria-label={`Guardar ${category.name}`}><Check className="h-3.5 w-3.5" /></button>
                        ) : (
                          <button onClick={() => { setEditingCategoryId(category.id); setEditingCategoryName(category.name); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-background p-1.5 text-muted-foreground border border-border hover:bg-muted sm:min-h-0 sm:min-w-0" aria-label={`Editar ${category.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        )}

        {tab === 'orders' && (
          !selectedBusiness ? <EmptyBusinessSelector title="pedidos" /> : (
            <section role="region" aria-label="Tabla de pedidos" tabIndex={0} className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card ring-1 ring-border">
              {filteredOrders.length === 0 ? (
                <div className="p-12 text-center">
                  <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="mt-4 text-sm font-bold text-muted-foreground">No hay pedidos registrados para este negocio.</p>
                </div>
              ) : (
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-4">N° Pedido</th><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Resumen</th><th className="px-5 py-4">Monto</th><th className="px-5 py-4">Pago</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4">Repartidor</th></tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border/70 last:border-0">
                        <td className="px-5 py-4 font-mono-app font-bold">{order.id}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{order.date}</td>
                        <td className="px-5 py-4 font-bold">{order.customer}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground max-w-[150px] truncate" title={order.summary}>{order.summary}</td>
                        <td className="px-5 py-4 font-mono-app text-xs">S/ {order.total.toFixed(2)}</td>
                        <td className="px-5 py-4 text-xs">{order.payment}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${order.status === 'Entregado' ? 'bg-violet-100 text-violet-800' : order.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{order.status}</span>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{order.assigned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        )}

        {tab === 'payments' && (
          !selectedBusiness ? <EmptyBusinessSelector title="pagos" /> : (
            <section role="region" aria-label="Tabla de pagos" tabIndex={0} className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card ring-1 ring-border">
              {filteredPayments.length === 0 ? (
                <div className="p-12 text-center">
                  <CircleDollarSign className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="mt-4 text-sm font-bold text-muted-foreground">No hay pagos registrados para este negocio.</p>
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-4">ID Pago</th><th className="px-5 py-4">Pedido asociado</th><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Método</th><th className="px-5 py-4">Monto</th><th className="px-5 py-4 text-right">Estado</th></tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-border/70 last:border-0">
                        <td className="px-5 py-4 font-mono-app font-bold text-muted-foreground">{payment.id}</td>
                        <td className="px-5 py-4 font-mono-app font-bold">{payment.orderId}</td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">{payment.date}</td>
                        <td className="px-5 py-4 text-xs font-semibold">{payment.method}</td>
                        <td className="px-5 py-4 font-mono-app text-xs">S/ {payment.amount.toFixed(2)}</td>
                        <td className="px-5 py-4 text-right">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold inline-block ${payment.status === 'Confirmado' ? 'bg-violet-100 text-violet-800' : payment.status === 'Rechazado' || payment.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        )}

        {tab === 'couriers' && <section role="region" aria-label="Tabla de repartidores" tabIndex={0} className="mt-7 max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card ring-1 ring-border">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-4">Repartidor</th><th className="px-5 py-4">Contacto</th><th className="px-5 py-4">Estado actual</th><th className="px-5 py-4">Disponibilidad</th><th className="px-5 py-4">Entregas asig.</th><th className="px-5 py-4 text-right">Acciones</th></tr>
            </thead>
            <tbody>
              {couriers.map((courier) => (
                <tr key={courier.id} className="border-b border-border/70 last:border-0">
                  <td className="px-5 py-4 font-bold">{courier.name}</td>
                  <td className="px-5 py-4 text-xs font-mono-app">{courier.contact}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold">{courier.status}</span></td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${courier.availability === 'Disponible' ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-800'}`}>{courier.availability}</span></td>
                  <td className="px-5 py-4 font-mono-app text-xs font-bold text-primary">{courier.deliveries}</td>
                  <td className="px-5 py-4 text-right">
                    <button onClick={() => toggleCourierActive(courier.id)} className={`min-h-11 rounded-lg px-3 py-2 text-[10px] font-bold sm:min-h-0 ${courier.active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}>
                      {courier.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>}

        {tab === 'delivery' && <section className="mt-7 space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl bg-card p-5 ring-1 ring-border" data-testid={`row-admin-assignment-${order.id}`}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-mono-app text-[10px] uppercase tracking-wide text-accent">Pedido {order.id}</p>
                  <h2 className="mt-1 font-display text-lg font-bold">{order.customer}</h2>
                  <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-primary">{order.business}</span> · {order.date}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)} className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold sm:h-10 sm:w-auto">
                    <option>Pendiente</option>
                    <option>En cocina</option>
                    <option>En camino</option>
                    <option>Entregado</option>
                    <option>Cancelado</option>
                  </select>
                  <select value={order.assigned} onChange={(e) => updateOrderAssigned(order.id, e.target.value)} className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold text-primary sm:h-10 sm:w-auto" data-testid={`select-assignment-${order.id}`}>
                    <option>Sin asignar</option>
                    {couriers.filter(c => c.active || c.name === order.assigned).map(c => (
                      <option key={c.id} value={c.name}>{c.name}{!c.active ? ' (Inactivo)' : ''}</option>
                    ))}
                  </select>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                    <MapPin className="h-4 w-4 text-accent" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>}

        {tab === 'reports' && <section className="mt-7 space-y-6">
          <div className="flex flex-col gap-3 bg-card p-5 rounded-2xl ring-1 ring-border sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-lg font-bold">Resumen de operaciones</h2>
            <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold sm:h-10 sm:w-auto">
              <option>Hoy</option>
              <option>Esta semana</option>
              <option>Este mes</option>
              <option>Todo el tiempo</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Total Pedidos</p>
              <p className="mt-3 font-mono-app text-3xl font-bold">{statsOrdersAll}</p>
              <p className="mt-2 text-[10px] font-bold text-violet-600">{statsOrdersDelivered} entregados</p>
            </div>
            <div className="rounded-2xl bg-primary text-white p-6 ring-1 ring-border">
              <p className="text-xs font-bold text-white/70">Ingresos (Pagados)</p>
              <p className="mt-3 font-mono-app text-3xl font-bold text-secondary">S/ {totalSales.toFixed(2)}</p>
              <p className="mt-2 text-[10px] font-bold text-white/50">{paymentConfirmations} pagos procesados</p>
            </div>
            <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Delivery</p>
              <p className="mt-3 font-mono-app text-3xl font-bold">{statsCouriers}</p>
              <p className="mt-2 text-[10px] font-bold text-amber-600">{statsOrdersPending} envíos pendientes</p>
            </div>
          </div>
        </section>}

        {tab === 'stats' && <section className="mt-7 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Clientes</p>
              <p className="mt-2 font-mono-app text-2xl font-bold">{statsClients}</p>
            </div>
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Administradores</p>
              <p className="mt-2 font-mono-app text-2xl font-bold">{statsAdmins}</p>
            </div>
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Negocios</p>
              <p className="mt-2 font-mono-app text-2xl font-bold">{statsBusinesses}</p>
            </div>
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Repartidores</p>
              <p className="mt-2 font-mono-app text-2xl font-bold">{statsCouriers}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Pedidos Totales</p>
              <p className="mt-2 font-mono-app text-xl font-bold">{statsOrdersAll}</p>
            </div>
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Entregados</p>
              <p className="mt-2 font-mono-app text-xl font-bold text-violet-600">{statsOrdersDelivered}</p>
            </div>
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Pendientes</p>
              <p className="mt-2 font-mono-app text-xl font-bold text-amber-600">{statsOrdersPending}</p>
            </div>
            <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <p className="text-xs font-bold text-muted-foreground">Cancelados</p>
              <p className="mt-2 font-mono-app text-xl font-bold text-red-600">{statsOrdersCancelled}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <div className="flex items-center gap-2 mb-8">
              <BarChart3 className="h-5 w-5 text-accent" />
              <h2 className="font-display text-xl font-bold">Frecuencia de pedidos</h2>
            </div>
            <div className="flex h-44 items-end gap-3 px-2">
              {chartData.map((data, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2 group">
                  <div className="relative flex w-full max-w-[64px] flex-col justify-end">
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100">{data.count}</span>
                    <div className="w-full rounded-t-xl bg-secondary group-hover:bg-accent transition-colors" style={{ height: `${data.height}%`, minHeight: '4px' }} />
                  </div>
                  <span className="font-mono-app text-[10px] text-muted-foreground">{data.date}</span>
                </div>
              ))}
            </div>
          </div>
        </section>}

        {tab === 'settings' && <section className="mt-7 max-w-2xl rounded-2xl bg-card p-6 ring-1 ring-border">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold">Nombre de la plataforma</span>
              <input value={platformName} onChange={(event) => setPlatformName(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold">Pedido mínimo general (S/)</span>
              <input type="number" value={minimumOrder} onChange={(event) => setMinimumOrder(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm" />
            </label>
            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Los cambios se aplican a la configuración global.</p>
              <button onClick={() => announce('Configuración guardada.')} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white" data-testid="button-save-admin-settings">
                <Save className="h-3.5 w-3.5 text-secondary" /> Guardar
              </button>
            </div>
          </div>
        </section>}
      </section>
    </div>
  </main>;
}
