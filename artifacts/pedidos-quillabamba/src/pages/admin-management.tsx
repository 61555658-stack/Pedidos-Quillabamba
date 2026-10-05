import { useEffect, useState } from "react";
import { BarChart3, Bike, CircleDollarSign, LayoutDashboard, Pencil, Plus, Save, Settings2, Store, Tag, Trash2, Users, X } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/api";
import { RoleHeader, useAuth } from "@/pages/role-access";

type ManagementTab = "catalog" | "categories" | "customers" | "delivery" | "payments" | "reports" | "settings";
type ProductRow = { id: number; restaurantId: number; name: string; description: string; category: string; price: number; stock: number; active: boolean; image: string; popular: boolean };
type Category = { id: number; name: string };
type Customer = { id: number; name: string; email: string; orders: number; phone?: string | null; address?: string | null };
type AdminOrder = { id: number; customerName: string; total: number; status: string; paymentMethod: string; deliveryPartnerId?: number | null; deliveryAddress: string };
type Partner = { id: number; name: string; email: string };

const tabs: Array<{ id: ManagementTab; label: string; icon: typeof Store }> = [
  { id: "catalog", label: "Productos", icon: Store }, { id: "categories", label: "Categorías", icon: Tag },
  { id: "customers", label: "Clientes", icon: Users }, { id: "delivery", label: "Asignaciones", icon: Bike },
  { id: "payments", label: "Pagos", icon: CircleDollarSign }, { id: "reports", label: "Reportes", icon: BarChart3 },
  { id: "settings", label: "Configuración", icon: Settings2 },
];
const fieldClass = "h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:border-accent";

export default function AdminManagementPage() {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<ManagementTab>("catalog");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [settings, setSettings] = useState({ platformName: "QUILLAYAA", minimumOrder: "15" });
  const [newCategory, setNewCategory] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", category: "", price: "", stock: "" });
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [nextProducts, nextCategories, nextCustomers, nextOrders, nextPartners, nextSettings] = await Promise.all([
        apiRequest<ProductRow[]>("/api/admin/products"), apiRequest<Category[]>("/api/admin/categories"),
        apiRequest<Customer[]>("/api/admin/customers"), apiRequest<AdminOrder[]>("/api/admin/orders"),
        apiRequest<Partner[]>("/api/admin/delivery-partners"), apiRequest<Record<string, string>>("/api/admin/settings"),
      ]);
      setProducts(nextProducts); setCategories(nextCategories); setCustomers(nextCustomers); setOrders(nextOrders); setPartners(nextPartners);
      setSettings({ platformName: nextSettings.platformName || "QUILLAYAA", minimumOrder: nextSettings.minimumOrder || "15" });
    } catch (error) { setNotice(error instanceof Error ? error.message : "No pudimos cargar la administración."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);
  const announce = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const addProduct = async () => {
    if (!newProduct.name.trim() || !newProduct.category || !newProduct.price || !newProduct.stock) { announce("Completa nombre, categoría, precio y stock."); return; }
    try {
      await apiRequest("/api/admin/products", { method: "POST", body: JSON.stringify({ ...newProduct, price: Number(newProduct.price), stock: Number(newProduct.stock), category: newProduct.category }) });
      setNewProduct({ name: "", category: categories[0]?.name || "", price: "", stock: "" }); await reload(); announce("Producto registrado correctamente.");
    } catch (error) { announce(error instanceof Error ? error.message : "No pudimos guardar el producto."); }
  };
  const patchProduct = async (id: number, patch: Partial<ProductRow>) => {
    try { await apiRequest(`/api/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); await reload(); announce("Producto actualizado."); }
    catch (error) { announce(error instanceof Error ? error.message : "No pudimos actualizar el producto."); }
  };
  const removeProduct = async (id: number) => {
    try { await apiRequest(`/api/admin/products/${id}`, { method: "DELETE" }); await reload(); announce("Producto eliminado."); }
    catch (error) { announce(error instanceof Error ? error.message : "No pudimos eliminar el producto."); }
  };
  const addCategory = async () => {
    if (!newCategory.trim()) return;
    try { await apiRequest("/api/admin/categories", { method: "POST", body: JSON.stringify({ name: newCategory }) }); setNewCategory(""); await reload(); announce("Categoría guardada."); }
    catch (error) { announce(error instanceof Error ? error.message : "No pudimos guardar la categoría."); }
  };
  const removeCategory = async (id: number) => {
    try { await apiRequest(`/api/admin/categories/${id}`, { method: "DELETE" }); await reload(); announce("Categoría eliminada."); }
    catch (error) { announce(error instanceof Error ? error.message : "No pudimos eliminar la categoría."); }
  };
  const assign = async (orderId: number, deliveryPartnerId: string) => {
    try { await apiRequest(`/api/admin/orders/${orderId}/assignment`, { method: "PATCH", body: JSON.stringify({ deliveryPartnerId: deliveryPartnerId || null }) }); await reload(); announce("Asignación guardada."); }
    catch (error) { announce(error instanceof Error ? error.message : "No pudimos guardar la asignación."); }
  };
  const saveSettings = async () => {
    try { await apiRequest("/api/admin/settings", { method: "PATCH", body: JSON.stringify(settings) }); announce("Configuración guardada en el servidor."); }
    catch (error) { announce(error instanceof Error ? error.message : "No pudimos guardar la configuración."); }
  };
  const logout = async () => { await signOut(); window.location.assign("/login"); };

  return <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
    <RoleHeader role="administrador" />
    <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Operación persistente</p><h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">Gestión administrativa</h1><p className="mt-2 text-sm text-muted-foreground">Cada cambio se valida y guarda en PostgreSQL.</p></div><div className="flex items-center gap-2"><Link href="/admin" className="rounded-full border border-border px-4 py-2 text-xs font-bold">Dashboard</Link><button onClick={() => void logout()} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white">Salir</button></div></div>
      {notice && <div className="mt-5 flex items-center justify-between rounded-xl bg-secondary px-4 py-3 text-xs font-bold"><span>{notice}</span><button onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
      <div className="mt-7 grid gap-5 lg:grid-cols-[210px_1fr]"><aside className="h-fit rounded-2xl bg-primary p-3 text-white"><p className="px-3 pb-3 pt-2 font-mono-app text-[10px] uppercase tracking-[.16em] text-white/45">Módulos</p>{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-bold ${tab === id ? "bg-secondary text-primary" : "text-white/65 hover:bg-white/10"}`}><Icon className="h-4 w-4" />{label}</button>)}</aside>
        <section>{loading ? <div className="rounded-2xl bg-card p-12 text-center text-sm text-muted-foreground">Cargando información guardada...</div> : <>
          {tab === "catalog" && <section className="space-y-5"><div className="rounded-2xl bg-card p-5 ring-1 ring-border"><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-accent" /><h2 className="font-display text-xl font-bold">Registrar producto</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_100px_100px_auto]"><input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Nombre" className={fieldClass} /><select value={newProduct.category || categories[0]?.name || ""} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} className={fieldClass}>{categories.map((category) => <option key={category.id}>{category.name}</option>)}</select><input type="number" min="0" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} placeholder="Precio" className={fieldClass} /><input type="number" min="0" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} placeholder="Stock" className={fieldClass} /><button onClick={() => void addProduct()} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-white"><Plus className="h-4 w-4 text-secondary" /> Agregar</button></div></div><div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-border"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-4">Producto</th><th className="px-5 py-4">Categoría</th><th className="px-5 py-4">Precio</th><th className="px-5 py-4">Stock</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4" /></tr></thead><tbody>{products.map((product) => <tr key={product.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-4 font-bold">{product.name}</td><td className="px-5 py-4 text-xs">{product.category}</td><td className="px-5 py-4"><input type="number" defaultValue={product.price} onBlur={(e) => e.currentTarget.value !== String(product.price) && void patchProduct(product.id, { price: Number(e.currentTarget.value) })} className="w-20 rounded-lg border border-input bg-background px-2 py-1 font-mono-app text-xs" /></td><td className="px-5 py-4"><input type="number" min="0" defaultValue={product.stock} onBlur={(e) => e.currentTarget.value !== String(product.stock) && void patchProduct(product.id, { stock: Number(e.currentTarget.value) })} className="w-20 rounded-lg border border-input bg-background px-2 py-1 font-mono-app text-xs" /></td><td className="px-5 py-4"><button onClick={() => void patchProduct(product.id, { active: !product.active })} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${product.active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{product.active ? "Activo" : "Inactivo"}</button></td><td className="px-5 py-4"><button onClick={() => void removeProduct(product.id)} className="text-red-700"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div></section>}
          {tab === "categories" && <section className="rounded-2xl bg-card p-6 ring-1 ring-border"><h2 className="font-display text-xl font-bold">Categorías de menú</h2><div className="mt-5 flex gap-2"><input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nueva categoría" className={`${fieldClass} flex-1`} /><button onClick={() => void addCategory()} className="rounded-xl bg-primary px-4 text-xs font-bold text-white"><Plus className="inline h-4 w-4" /> Agregar</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{categories.map((category) => <div key={category.id} className="flex items-center justify-between rounded-xl border border-border p-4 text-sm font-bold"><span>{category.name}</span><button onClick={() => void removeCategory(category.id)} className="text-red-700"><Trash2 className="h-4 w-4" /></button></div>)}</div></section>}
          {tab === "customers" && <section className="overflow-x-auto rounded-2xl bg-card ring-1 ring-border"><div className="p-6"><h2 className="font-display text-xl font-bold">Clientes registrados</h2><p className="mt-1 text-sm text-muted-foreground">Datos leídos desde las cuentas y pedidos reales.</p></div><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-y border-border bg-muted/50 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Correo</th><th className="px-5 py-4">Dirección</th><th className="px-5 py-4">Pedidos</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id} className="border-b border-border/70 last:border-0"><td className="px-5 py-4 font-bold">{customer.name}</td><td className="px-5 py-4 text-xs">{customer.email}</td><td className="px-5 py-4 text-xs text-muted-foreground">{customer.address || "Sin dirección"}</td><td className="px-5 py-4 font-mono-app text-xs">{customer.orders}</td></tr>)}</tbody></table></section>}
          {tab === "delivery" && <section className="space-y-4"><div className="rounded-2xl bg-card p-6 ring-1 ring-border"><h2 className="font-display text-xl font-bold">Asignaciones y estados</h2><p className="mt-1 text-sm text-muted-foreground">Asigna cada pedido a un repartidor desde el servidor.</p></div>{orders.map((order) => <div key={order.id} className="rounded-2xl bg-card p-5 ring-1 ring-border"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="font-mono-app text-[10px] uppercase tracking-wide text-accent">Pedido Q-{order.id}</p><p className="mt-1 font-bold">{order.customerName} · S/ {order.total.toFixed(2)}</p><p className="mt-1 text-xs text-muted-foreground">{order.deliveryAddress} · {order.status}</p></div><select value={order.deliveryPartnerId || ""} onChange={(e) => void assign(order.id, e.target.value)} className={fieldClass}><option value="">Sin asignar</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></div></div>)}</section>}
          {tab === "payments" && <section className="rounded-2xl bg-card p-6 ring-1 ring-border"><h2 className="font-display text-xl font-bold">Pagos registrados</h2><div className="mt-5 grid gap-4 sm:grid-cols-3">{["cash", "yape", "card"].map((method) => <div key={method} className="rounded-xl bg-muted p-4"><p className="text-xs text-muted-foreground">{method === "cash" ? "Efectivo" : method === "yape" ? "Yape" : "Tarjeta"}</p><p className="mt-2 font-mono-app text-2xl font-bold">{orders.filter((order) => order.paymentMethod === method).length}</p><p className="mt-1 text-xs">pedidos registrados</p></div>)}</div></section>}
          {tab === "reports" && <section className="rounded-2xl bg-card p-6 ring-1 ring-border"><h2 className="font-display text-xl font-bold">Resumen de operación</h2><div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-primary p-4 text-white"><p className="text-xs text-white/60">Ventas registradas</p><p className="mt-2 font-mono-app text-2xl font-bold">S/ {orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}</p></div><div className="rounded-xl bg-muted p-4"><p className="text-xs text-muted-foreground">Pedidos</p><p className="mt-2 font-mono-app text-2xl font-bold">{orders.length}</p></div><div className="rounded-xl bg-muted p-4"><p className="text-xs text-muted-foreground">Clientes</p><p className="mt-2 font-mono-app text-2xl font-bold">{customers.length}</p></div></div></section>}
          {tab === "settings" && <section className="max-w-2xl rounded-2xl bg-card p-6 ring-1 ring-border"><h2 className="font-display text-xl font-bold">Configuración persistente</h2><div className="mt-5 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-bold">Nombre de plataforma</span><input value={settings.platformName} onChange={(e) => setSettings({ ...settings, platformName: e.target.value })} className={`${fieldClass} w-full`} /></label><label className="block"><span className="mb-1.5 block text-xs font-bold">Pedido mínimo (S/)</span><input type="number" value={settings.minimumOrder} onChange={(e) => setSettings({ ...settings, minimumOrder: e.target.value })} className={`${fieldClass} w-full`} /></label><button onClick={() => void saveSettings()} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-white"><Save className="h-3.5 w-3.5 text-secondary" /> Guardar</button></div></section>}
        </>}</section>
      </div>
    </div>
  </main>;
}