import { useState } from 'react';
import { PackageCheck, Store, LogOut, Plus, Pencil, Trash2, Save, Store as StoreIcon, Settings, BarChart3, Tag, TrendingUp, Image as ImageIcon, Upload } from 'lucide-react';
import { useLocation } from 'wouter';
import { clearSession } from '@/pages/role-access';

type BusinessProfile = { name: string; ruc: string; address: string; phone: string };
type BusinessProduct = { id: number; name: string; category: string; price: number; stock: number; available: boolean; image?: string };
type BusinessOrder = { id: string; customer: string; total: number; status: string };
type BusinessTab = 'orders' | 'sales' | 'products' | 'categories' | 'profile';

const initialProfile: BusinessProfile = {
  name: 'Sazón de la Plaza',
  ruc: '20123456789',
  address: 'Plaza de Armas s/n, Quillabamba',
  phone: '987654321',
};

const initialProducts: BusinessProduct[] = [
  { id: 1, name: 'Tacacho con cecina', category: 'Favoritos', price: 26, stock: 15, available: true, image: '/restaurant-selva.jpg' },
  { id: 2, name: 'Juane de la casa', category: 'Favoritos', price: 22, stock: 20, available: true, image: '/restaurant-selva.jpg' },
  { id: 3, name: 'Chapo de plátano', category: 'Bebidas', price: 9, stock: 10, available: true },
];

const initialOrders: BusinessOrder[] = [
  { id: 'Q-1049', customer: 'Carlos Huamán', total: 52, status: 'Recibido' },
  { id: 'Q-1048', customer: 'Ana Lucía Torres', total: 31.5, status: 'En cocina' },
];

const menu: Array<{ id: BusinessTab; label: string; icon: any }> = [
  { id: 'orders', label: 'Pedidos activos', icon: PackageCheck },
  { id: 'sales', label: 'Resumen de ventas', icon: BarChart3 },
  { id: 'products', label: 'Carta por categorías', icon: StoreIcon },
  { id: 'categories', label: 'Categorías', icon: Tag },
  { id: 'profile', label: 'Perfil del negocio', icon: Settings },
];

export default function BusinessPortalPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<BusinessTab>('products');
  
  const [profile, setProfile] = useState<BusinessProfile>(initialProfile);
  const [categories, setCategories] = useState(['Favoritos', 'Platos principales', 'Sopas', 'Bebidas', 'Postres']);
  const [products, setProducts] = useState<BusinessProduct[]>(initialProducts);
  const [orders, setOrders] = useState<BusinessOrder[]>(initialOrders);
  
  const [notice, setNotice] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', category: categories[0] || '', image: '', price: '', stock: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productCategoryFilter, setProductCategoryFilter] = useState('Todas');

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const readImageFile = (file: File | undefined, onLoad: (image: string) => void) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      announce('Selecciona un archivo de imagen válido.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      announce('La imagen debe pesar menos de 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoad(reader.result);
        announce('Imagen cargada desde el dispositivo.');
      }
    };
    reader.onerror = () => announce('No se pudo leer la imagen seleccionada.');
    reader.readAsDataURL(file);
  };

  const logout = () => { clearSession(); setLocation('/login'); };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      announce('La categoría ya existe.');
      return;
    }
    setCategories([...categories, trimmed]);
    setNewCategory('');
    announce('Categoría creada.');
    if (!newProduct.category) setNewProduct({ ...newProduct, category: trimmed });
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
    if (productCategoryFilter === cat) setProductCategoryFilter('Todas');
    announce('Categoría eliminada.');
  };

  const addProduct = () => {
    if (!newProduct.name.trim() || !newProduct.price || !newProduct.stock || !newProduct.category) {
      announce('Completa nombre, categoría, precio y stock.');
      return;
    }
    setProducts((current) => [...current, { 
      id: Date.now(), 
      name: newProduct.name.trim(), 
      category: newProduct.category, 
      price: Number(newProduct.price), 
      stock: Number(newProduct.stock), 
      available: true,
      image: newProduct.image.trim() || undefined
    }]);
    setNewProduct({ name: '', category: categories[0] || '', image: '', price: '', stock: '' });
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

  const visibleProducts = productCategoryFilter === 'Todas'
    ? products
    : products.filter((product) => product.category === productCategoryFilter);

  return (
    <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
      <header className="border-b border-border/70 bg-[#f7f5ee]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 md:px-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
            <Store className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display font-bold">QUILLAYAA</p>
            <p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Portal de Negocio</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs font-semibold text-muted-foreground sm:block">{profile.name}</span>
            <button onClick={logout} className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white" data-testid="button-business-logout">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-w-0 max-w-[1400px] gap-5 px-4 py-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 md:px-8 md:py-7">
        <aside className="h-fit min-w-0 rounded-2xl bg-primary p-2 text-white md:p-3">
          <p className="px-3 pb-3 pt-2 font-mono-app text-[10px] uppercase tracking-[.16em] text-white/45">Establecimiento</p>
          <nav aria-label="Secciones del negocio" className="flex gap-1 overflow-x-auto overscroll-x-contain pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
            {menu.map(({ id, label, icon: Icon }) => (
              <button 
                key={id} 
                onClick={() => setTab(id)} 
                className={`flex min-h-11 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-3 text-left text-xs font-bold transition md:w-full ${tab === id ? 'bg-secondary text-primary' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}
                data-testid={`button-business-tab-${id}`}
              >
                <Icon className="h-4 w-4 shrink-0" />{label}
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
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-100 px-3 py-2 text-xs font-bold text-violet-800">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> Negocio conectado
            </span>
          </div>

          {notice && <p className="mt-5 rounded-xl bg-violet-50 px-4 py-3 text-xs font-bold text-violet-700 animate-rise" data-testid="status-business-feedback">{notice}</p>}

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
                      <p className="hidden text-xs font-semibold text-muted-foreground sm:block">Estado actual:</p>
                      <select 
                        value={order.status} 
                        onChange={(event) => updateOrderStatus(order.id, event.target.value)} 
                        className="h-11 w-full max-w-full rounded-xl border border-input bg-background px-3 text-xs font-bold outline-none focus:border-accent sm:h-10 sm:w-auto"
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

          {tab === 'sales' && (
            <section className="mt-7 space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
                  <p className="text-xs text-muted-foreground">Ventas de hoy</p>
                  <p className="mt-2 font-mono-app text-2xl font-bold">S/ 245.50</p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold text-violet-600"><TrendingUp className="h-3 w-3" /> +12.5% vs ayer</p>
                </div>
                <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
                  <p className="text-xs text-muted-foreground">Esta semana</p>
                  <p className="mt-2 font-mono-app text-2xl font-bold">S/ 1,840.00</p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold text-violet-600"><TrendingUp className="h-3 w-3" /> +5.2% vs sem. ant.</p>
                </div>
                <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
                  <p className="text-xs text-muted-foreground">Este mes</p>
                  <p className="mt-2 font-mono-app text-2xl font-bold">S/ 6,230.00</p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-bold text-red-600"><TrendingUp className="h-3 w-3 rotate-180" /> -2.1% vs mes ant.</p>
                </div>
              </div>
              <div className="rounded-2xl bg-card p-6 ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-accent" />
                  <h2 className="font-display text-xl font-bold">Ventas de la semana</h2>
                </div>
                <div className="mt-8 flex h-44 items-end gap-3">
                  {[45, 60, 40, 85, 95, 110, 80].map((height, index) => (
                    <div key={index} className="flex flex-1 flex-col items-center gap-2">
                      <div className={`w-full max-w-[54px] rounded-t-xl ${index === 3 ? 'bg-accent' : 'bg-secondary'}`} style={{ height: `${Math.max(12, height)}px` }} />
                      <span className="font-mono-app text-[10px] text-muted-foreground">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][index]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === 'categories' && (
             <section className="mt-7 min-w-0 rounded-2xl bg-card p-4 ring-1 ring-border sm:p-6">
               <div className="flex flex-col gap-2 sm:flex-row">
                 <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} placeholder="Nueva categoría" className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-accent" data-testid="input-business-category" />
                 <button onClick={addCategory} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white" data-testid="button-business-add-category">
                  <Plus className="h-4 w-4 text-secondary" /> Crear
                </button>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {categories.map((category) => (
                   <div key={category} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-muted/50 px-4 py-3">
                     <span className="flex min-w-0 items-center gap-2 break-words text-sm font-bold"><Tag className="h-4 w-4 shrink-0 text-accent" />{category}</span>
                     <button onClick={() => removeCategory(category)} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-red-700 hover:bg-red-50" aria-label={`Eliminar ${category}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="col-span-full py-4 text-center text-sm text-muted-foreground">Aún no tienes categorías. Agrega una para organizar tu menú.</p>
                )}
              </div>
            </section>
          )}

          {tab === 'products' && (
            <section className="mt-7 space-y-5">
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.16em] text-accent">Secciones de la carta</p>
                    <h2 className="mt-2 font-display text-xl font-bold">Productos por categoría</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Selecciona una categoría para revisar lo que contiene.</p>
                  </div>
                  <span className="font-mono-app text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{visibleProducts.length} productos visibles</span>
                </div>
                 <div className="mt-5 flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2">
                  {['Todas', ...categories].map((category) => {
                    const count = category === 'Todas' ? products.length : products.filter((product) => product.category === category).length;
                     return <button key={category} onClick={() => setProductCategoryFilter(category)} className={`min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${productCategoryFilter === category ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-secondary/60 hover:text-primary'}`} data-testid={`button-business-category-filter-${category.toLowerCase().replace(/\s+/g, '-')}`}>{category} <span className={`ml-1 rounded-full px-1.5 py-0.5 font-mono-app text-[9px] ${productCategoryFilter === category ? 'bg-white/15' : 'bg-card'}`}>{count}</span></button>;
                  })}
                </div>
              </div>
              <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-accent" /><h2 className="font-display text-xl font-bold">Agregar a la carta</h2></div>
                <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                   <input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Nombre del plato" className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent sm:h-10 lg:col-span-2" data-testid="input-business-product-name" />
                   <select value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent sm:h-10 lg:col-span-1" data-testid="select-business-product-category">
                    {categories.length ? categories.map((cat) => <option key={cat}>{cat}</option>) : <option value="">Sin categoría</option>}
                  </select>
                   <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:col-span-3">
                     <input value={newProduct.image.startsWith('data:') ? '' : newProduct.image} onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })} placeholder={newProduct.image.startsWith('data:') ? 'Imagen cargada desde archivo' : 'URL de imagen (opcional)'} className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent sm:h-10" data-testid="input-business-product-image" />
                     <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-accent/35 bg-secondary/30 px-4 text-xs font-bold text-primary transition hover:bg-secondary/55 sm:min-h-10">
                      <Upload className="h-4 w-4" /> Subir archivo
                      <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { readImageFile(event.target.files?.[0], (image) => setNewProduct((current) => ({ ...current, image }))); event.target.value = ''; }} data-testid="input-business-product-image-file" />
                    </label>
                    {newProduct.image && <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-2 sm:col-span-2"><img src={newProduct.image} alt="Vista previa del producto" className="h-14 w-14 rounded-lg object-cover ring-1 ring-border" /><div><p className="text-xs font-bold">Vista previa</p><button type="button" onClick={() => setNewProduct({ ...newProduct, image: '' })} className="mt-1 text-[10px] font-bold text-red-700">Quitar imagen</button></div></div>}
                  </div>
                   <input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Precio (S/)" className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent sm:h-10 lg:col-span-2" data-testid="input-business-product-price" />
                   <input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} placeholder="Stock" className="h-11 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent sm:h-10 lg:col-span-2" data-testid="input-business-product-stock" />
                   <button onClick={addProduct} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white sm:h-10 lg:col-span-2" data-testid="button-business-add-product">
                    <Plus className="h-4 w-4 text-secondary" /> Guardar
                  </button>
                </div>
              </div>
              
               <div role="region" aria-label="Tabla de productos, desplázate horizontalmente para ver todas las columnas" tabIndex={0} className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-2xl bg-card ring-1 ring-border">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4 w-[280px]">Plato / Producto</th>
                      <th className="px-5 py-4">Categoría</th>
                      <th className="px-5 py-4">Precio</th>
                      <th className="px-5 py-4">Stock</th>
                      <th className="px-5 py-4">Disponibilidad</th>
                      <th className="px-5 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => (
                      <tr key={product.id} className="border-b border-border/70 last:border-0" data-testid={`row-business-product-${product.id}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {product.image ? (
                              <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-border" />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
                                <ImageIcon className="h-4 w-4 opacity-50" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              {editingId === product.id ? (
                                <div className="flex flex-col gap-1">
                                  <input value={product.name} onChange={(e) => updateProduct(product.id, { name: e.target.value })} placeholder="Nombre del plato" className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-accent" />
                                  <input value={product.image?.startsWith('data:') ? '' : product.image || ''} onChange={(e) => updateProduct(product.id, { image: e.target.value })} placeholder={product.image?.startsWith('data:') ? 'Imagen cargada desde archivo' : 'URL de imagen'} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-[10px] outline-none focus:border-accent" />
                                  <label className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-lg border border-accent/35 bg-secondary/30 px-2 text-[10px] font-bold text-primary">
                                    <Upload className="h-3 w-3" /> Cambiar archivo
                                    <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { readImageFile(event.target.files?.[0], (image) => updateProduct(product.id, { image })); event.target.value = ''; }} data-testid={`input-business-product-image-file-${product.id}`} />
                                  </label>
                                </div>
                              ) : (
                                <span className="block truncate font-bold">{product.name}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {editingId === product.id ? (
                            <select value={product.category} onChange={(e) => updateProduct(product.id, { category: e.target.value })} className="h-8 w-full rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-accent">
                              {categories.length ? categories.map((cat) => <option key={cat}>{cat}</option>) : <option value={product.category}>{product.category}</option>}
                            </select>
                          ) : product.category}
                        </td>
                        <td className="px-5 py-4 font-mono-app text-xs">
                          {editingId === product.id ? <input type="number" value={product.price} onChange={(e) => updateProduct(product.id, { price: Number(e.target.value) })} className="h-8 w-16 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-accent" /> : `S/ ${product.price.toFixed(2)}`}
                        </td>
                        <td className="px-5 py-4">
                          {editingId === product.id ? <input type="number" value={product.stock} onChange={(e) => updateProduct(product.id, { stock: Number(e.target.value) })} className="h-8 w-14 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:border-accent" /> : <span className={product.stock === 0 ? 'font-bold text-red-700' : ''}>{product.stock}</span>}
                        </td>
                        <td className="px-5 py-4">
                           <button onClick={() => updateProduct(product.id, { available: !product.available })} className={`min-h-11 rounded-full px-2.5 py-1 text-[10px] font-bold sm:min-h-0 ${product.available ? 'bg-violet-100 text-violet-800' : 'bg-muted text-muted-foreground'}`}>
                            {product.available ? 'Disponible' : 'Agotado'}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {editingId === product.id ? (
                               <button onClick={() => { setEditingId(null); announce('Plato guardado.'); }} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-secondary p-2 text-primary hover:bg-accent hover:text-white transition sm:min-h-0 sm:min-w-0" aria-label="Guardar">
                                <Save className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                               <button onClick={() => setEditingId(product.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-muted p-2 text-primary hover:bg-secondary transition sm:min-h-0 sm:min-w-0" aria-label="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            )}
                             <button onClick={() => removeProduct(product.id)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-red-50 p-2 text-red-700 hover:bg-red-100 transition sm:min-h-0 sm:min-w-0" aria-label="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!visibleProducts.length && <tr><td colSpan={6} className="px-5 py-12 text-center"><ImageIcon className="mx-auto h-6 w-6 text-muted-foreground/50" /><p className="mt-3 text-sm font-bold">Esta categoría todavía no tiene productos</p><p className="mt-1 text-xs text-muted-foreground">Agrega un producto y selecciona “{productCategoryFilter}” como categoría.</p></td></tr>}
                    {products.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                          No tienes productos en tu carta.
                        </td>
                      </tr>
                    )}
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
                
                <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">Muestra esta información a tus clientes.</p>
                  <button onClick={() => announce('Perfil del negocio actualizado.')} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white" data-testid="button-business-save-profile">
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
