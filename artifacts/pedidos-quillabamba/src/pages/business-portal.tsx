import { useState } from 'react';
import { PackageCheck, Store, LogOut, Plus, Pencil, Trash2, Save, Store as StoreIcon, Settings } from 'lucide-react';
import { useLocation } from 'wouter';
import { clearSession } from '@/pages/role-access';

type BusinessProfile = { name: string; ruc: string; address: string; phone: string };
type BusinessProduct = { id: number; name: string; category: string; price: number; stock: number; available: boolean };
type BusinessOrder = { id: string; customer: string; total: number; status: string };
type BusinessTab = 'orders' | 'products' | 'profile';

const initialProfile: BusinessProfile = {
  name: 'Sazón de la Plaza',
  ruc: '20123456789',
  address: 'Plaza de Armas s/n, Quillabamba',
  phone: '987654321',
};

const initialProducts: BusinessProduct[] = [
  { id: 1, name: 'Tacacho con cecina', category: 'Favoritos', price: 26, stock: 15, available: true },
  { id: 2, name: 'Juane de la casa', category: 'Favoritos', price: 22, stock: 20, available: true },
  { id: 3, name: 'Chapo de plátano', category: 'Bebidas', price: 9, stock: 10, available: true },
];

const initialOrders: BusinessOrder[] = [
  { id: 'Q-1049', customer: 'Carlos Huamán', total: 52, status: 'Recibido' },
  { id: 'Q-1048', customer: 'Ana Lucía Torres', total: 31.5, status: 'En cocina' },
];

const menu: Array<{ id: BusinessTab; label: string; icon: any }> = [
  { id: 'orders', label: 'Pedidos activos', icon: PackageCheck },
  { id: 'products', label: 'Carta y productos', icon: StoreIcon },
  { id: 'profile', label: 'Perfil del negocio', icon: Settings },
];

export default function BusinessPortalPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<BusinessTab>('orders');
  
  const [profile, setProfile] = useState<BusinessProfile>(initialProfile);
  const [products, setProducts] = useState<BusinessProduct[]>(initialProducts);
  const [orders, setOrders] = useState<BusinessOrder[]>(initialOrders);
  
  const [notice, setNotice] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', category: 'Favoritos', price: '', stock: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const logout = () => { clearSession(); setLocation('/login'); };

  const addProduct = () => {
    if (!newProduct.name.trim() || !newProduct.price || !newProduct.stock) {
      announce('Completa nombre, precio y stock.');
      return;
    }
    setProducts((current) => [...current, { 
      id: Date.now(), 
      name: newProduct.name.trim(), 
      category: newProduct.category, 
      price: Number(newProduct.price), 
      stock: Number(newProduct.stock), 
      available: true 
    }]);
    setNewProduct({ name: '', category: 'Favoritos', price: '', stock: '' });
    announce('Producto agregado a la carta.');
  };

  const updateProduct = (id: number, patch: Partial<BusinessProduct>) => {
    setProducts((current) => current.map((p) => p.id === id ? { ...p, ...patch } : p));
  };

  const removeProduct = (id: number) => {
    setProducts((current) => current.filter((p) => p.id !== id));
    announce('Producto eliminado de la carta.');
  };

  const updateOrderStatus = (id: string, status: string) => {
    setOrders((current) => current.map((o) => o.id === id ? { ...o, status } : o));
    announce(`Estado del pedido actualizado.`);
  };

  const categories = ['Favoritos', 'Platos principales', 'Sopas', 'Bebidas', 'Postres'];

  return (
    <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
      <header className="border-b border-border/70 bg-[#f7f5ee]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-5 md:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
            <Store className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display font-bold">QUILLAYAA</p>
            <p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Portal de Negocio</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs font-semibold text-muted-foreground sm:block">{profile.name}</span>
            <button onClick={logout} className="flex items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white" data-testid="button-business-logout">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-7 md:grid-cols-[220px_1fr] md:px-8">
        <aside className="h-fit rounded-2xl bg-primary p-3 text-white">
          <p className="px-3 pb-3 pt-2 font-mono-app text-[10px] uppercase tracking-[.16em] text-white/45">Establecimiento</p>
          <nav className="space-y-1">
            {menu.map(({ id, label, icon: Icon }) => (
              <button 
                key={id} 
                onClick={() => setTab(id)} 
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold transition ${tab === id ? 'bg-secondary text-primary' : 'text-white/65 hover:bg-white/10 hover:text-white'}`} 
                data-testid={`button-business-tab-${id}`}
              >
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Gestión directa</p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">
                {menu.find((item) => item.id === tab)?.label}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">Administra tu disponibilidad y atención al cliente.</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Negocio conectado
            </span>
          </div>

          {notice && <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700" data-testid="status-business-feedback">{notice}</p>}

          {tab === 'orders' && (
            <section className="mt-7 space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="rounded-2xl bg-card p-5 ring-1 ring-border" data-testid={`row-business-order-${order.id}`}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-mono-app text-[10px] uppercase tracking-wide text-accent">Pedido {order.id}</p>
                      <h2 className="mt-1 font-display text-lg font-bold">{order.customer}</h2>
                      <p className="mt-1 text-xs font-mono-app text-muted-foreground">S/ {order.total.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-semibold text-muted-foreground">Estado actual:</p>
                      <select 
                        value={order.status} 
                        onChange={(event) => updateOrderStatus(order.id, event.target.value)} 
                        className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold outline-none focus:border-accent" 
                        data-testid={`select-business-order-status-${order.id}`}
                      >
                        <option>Recibido</option>
                        <option>En cocina</option>
                        <option>Listo para entregar</option>
                        <option>Entregado al repartidor</option>
                        <option>Cancelado</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="rounded-2xl bg-card p-10 text-center ring-1 ring-border">
                  <p className="text-sm text-muted-foreground">No tienes pedidos activos en este momento.</p>
                </div>
              )}
            </section>
          )}

          {tab === 'products' && (
            <section className="mt-7 space-y-5">
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-accent" /><h2 className="font-display text-xl font-bold">Agregar a la carta</h2></div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_100px_100px_auto]">
                  <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Nombre del plato" className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent" data-testid="input-business-product-name" />
                  <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent" data-testid="select-business-product-category">
                    {categories.map((cat) => <option key={cat}>{cat}</option>)}
                  </select>
                  <input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Precio" className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent" data-testid="input-business-product-price" />
                  <input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} placeholder="Stock" className="h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent" data-testid="input-business-product-stock" />
                  <button onClick={addProduct} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white" data-testid="button-business-add-product">
                    <Plus className="h-4 w-4 text-secondary" /> Guardar
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-border">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4">Plato / Producto</th>
                      <th className="px-5 py-4">Categoría</th>
                      <th className="px-5 py-4">Precio</th>
                      <th className="px-5 py-4">Stock</th>
                      <th className="px-5 py-4">Disponibilidad</th>
                      <th className="px-5 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-border/70 last:border-0" data-testid={`row-business-product-${product.id}`}>
                        <td className="px-5 py-4 font-bold">
                          {editingId === product.id ? <input value={product.name} onChange={(e) => updateProduct(product.id, { name: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-accent" /> : product.name}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {editingId === product.id ? <select value={product.category} onChange={(e) => updateProduct(product.id, { category: e.target.value })} className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-accent">
                            {categories.map((cat) => <option key={cat}>{cat}</option>)}
                          </select> : product.category}
                        </td>
                        <td className="px-5 py-4 font-mono-app text-xs">
                          {editingId === product.id ? <input type="number" value={product.price} onChange={(e) => updateProduct(product.id, { price: Number(e.target.value) })} className="h-8 w-20 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-accent" /> : `S/ ${product.price.toFixed(2)}`}
                        </td>
                        <td className="px-5 py-4">
                          {editingId === product.id ? <input type="number" value={product.stock} onChange={(e) => updateProduct(product.id, { stock: Number(e.target.value) })} className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-accent" /> : <span className={product.stock === 0 ? 'font-bold text-red-700' : ''}>{product.stock}</span>}
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={() => updateProduct(product.id, { available: !product.available })} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${product.available ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>
                            {product.available ? 'Disponible' : 'Agotado'}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {editingId === product.id ? (
                              <button onClick={() => { setEditingId(null); announce('Plato guardado.'); }} className="rounded-lg bg-secondary p-2 text-primary" aria-label="Guardar">
                                <Save className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button onClick={() => setEditingId(product.id)} className="rounded-lg bg-muted p-2 text-primary" aria-label="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => removeProduct(product.id)} className="rounded-lg bg-red-50 p-2 text-red-700" aria-label="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'profile' && (
            <section className="mt-7 max-w-2xl rounded-2xl bg-card p-6 ring-1 ring-border">
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-primary">Nombre del establecimiento</span>
                  <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" data-testid="input-business-profile-name" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-primary">RUC</span>
                  <input value={profile.ruc} onChange={(e) => setProfile({ ...profile, ruc: e.target.value })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" data-testid="input-business-profile-ruc" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-primary">Dirección</span>
                  <input value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" data-testid="input-business-profile-address" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-primary">Teléfono de contacto</span>
                  <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" data-testid="input-business-profile-phone" />
                </label>
                
                <div className="flex items-center justify-between border-t border-border pt-5">
                  <p className="text-xs text-muted-foreground">Muestra esta información a tus clientes.</p>
                  <button onClick={() => announce('Perfil del negocio actualizado.')} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white" data-testid="button-business-save-profile">
                    <Save className="h-3.5 w-3.5 text-secondary" /> Guardar cambios
                  </button>
                </div>
              </div>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
