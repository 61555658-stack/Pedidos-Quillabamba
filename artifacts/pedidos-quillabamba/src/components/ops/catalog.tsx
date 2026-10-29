import { useState } from 'react';
import type { OpeningHours } from '@workspace/api-client-react';
import { OpeningHoursEditor } from './opening-hours';
import { ImageIcon, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { api, money, uploadImage, type OpsBusiness, type OpsCategory, type OpsProduct } from '@/lib/operations-api';
import { Empty, Field, Panel, Pill, SelectInput, TableWrap, TextInput, btnDanger, btnGhost, btnPrimary, inputCls, tdCls, thCls } from './ui';

type Run = (key: string, fn: () => Promise<unknown>, ok: string) => Promise<boolean>;
type ProductDraft = { name: string; description: string; category: string; price: string; stock: string; active: boolean; image: string; popular: boolean };
const emptyProduct: ProductDraft = { name: '', description: '', category: '', price: '', stock: '', active: true, image: '', popular: false };

export function ImageField({ value, onChange, onError }: { value: string; onChange: (v: string) => void; onError: (m: string) => void }) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className="grid gap-2">
      <Field label="Imagen (URL o archivo hasta 5 MB)">
        <div className="flex gap-2">
          <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder="/api/files/... o https://..." data-testid="input-image-url" />
          <label className={`${btnGhost} cursor-pointer shrink-0`}>
            <Upload className="h-4 w-4" />{uploading ? 'Subiendo…' : 'Subir'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} data-testid="input-image-file"
              onChange={async (e) => {
                const file = e.target.files?.[0]; e.target.value = '';
                if (!file) return;
                setUploading(true);
                try { onChange(await uploadImage(file)); } catch (err) { onError(err instanceof Error ? err.message : 'No se pudo subir la imagen.'); }
                finally { setUploading(false); }
              }} />
          </label>
        </div>
      </Field>
      {value && <div className="flex items-center gap-3"><img src={value} alt="Vista previa" className="h-14 w-14 rounded-lg object-cover ring-1 ring-border" /><button type="button" className="text-xs font-bold text-red-700" onClick={() => onChange('')}>Quitar imagen</button></div>}
    </div>
  );
}

function validateProduct(d: ProductDraft) {
  if (!d.name.trim()) return 'El nombre es obligatorio.';
  const p = Number(d.price), s = Number(d.stock);
  if (d.price.trim() === '' || !Number.isFinite(p) || p < 0) return 'El precio debe ser un número mayor o igual a cero.';
  if (d.stock.trim() === '' || !Number.isInteger(s) || s < 0) return 'El stock debe ser un entero mayor o igual a cero.';
  return '';
}

export function ProductsManager({ business, products, categories, run, busy, onError }: { business: OpsBusiness; products: OpsProduct[]; categories: OpsCategory[]; run: Run; busy: string | null; onError: (m: string) => void }) {
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const own = products.filter((p) => p.restaurantId === business.id);
  const cats = categories.filter((c) => c.restaurantId === business.id);
  const visible = filter ? own.filter((p) => p.category === filter) : own;

  const submit = async () => {
    const err = validateProduct(draft);
    if (err) return onError(err);
    const body = { restaurantId: business.id, name: draft.name.trim(), description: draft.description.trim(), category: draft.category, price: Number(draft.price), stock: Number(draft.stock), active: draft.active, image: draft.image.trim(), popular: draft.popular };
    const ok = editingId
      ? await run('product-save', () => api(`/api/operations/products/${editingId}`, 'PATCH', body), 'Producto actualizado.')
      : await run('product-save', () => api('/api/operations/products', 'POST', body), 'Producto creado.');
    if (ok) { setDraft(emptyProduct); setEditingId(null); }
  };
  const edit = (p: OpsProduct) => { setEditingId(p.id); setDraft({ name: p.name, description: p.description, category: p.category, price: String(p.price), stock: String(p.stock), active: p.active, image: p.image, popular: p.popular }); };

  return (
    <div className="space-y-5">
      <Panel kicker={business.name} title={editingId ? `Editar producto #${editingId}` : 'Nuevo producto'} actions={editingId ? <button className={btnGhost} onClick={() => { setEditingId(null); setDraft(emptyProduct); }}><X className="h-4 w-4" /> Cancelar edición</button> : undefined}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2"><TextInput label="Nombre" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="input-product-name" /></div>
          <SelectInput label="Categoría" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} data-testid="select-product-category">
            <option value="">Sin categoría</option>
            {cats.map((c) => <option key={c.id} value={c.name}>{c.name}{c.active ? '' : ' (inactiva)'}</option>)}
            {draft.category && !cats.some((c) => c.name === draft.category) && <option value={draft.category}>{draft.category}</option>}
          </SelectInput>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Precio S/" type="number" min="0" step="0.1" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} data-testid="input-product-price" />
            <TextInput label="Stock" type="number" min="0" step="1" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} data-testid="input-product-stock" />
          </div>
          <div className="sm:col-span-2"><TextInput label="Descripción" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} data-testid="input-product-description" /></div>
          <div className="sm:col-span-2"><ImageField value={draft.image} onChange={(image) => setDraft((d) => ({ ...d, image }))} onError={onError} /></div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} data-testid="checkbox-product-active" /> Disponible para venta</label>
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={draft.popular} onChange={(e) => setDraft({ ...draft, popular: e.target.checked })} data-testid="checkbox-product-popular" /> Destacado</label>
          <button className={`${btnPrimary} lg:col-span-2`} disabled={busy === 'product-save'} onClick={() => void submit()} data-testid="button-product-save"><Plus className="h-4 w-4" />{busy === 'product-save' ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear producto'}</button>
        </div>
      </Panel>
      <Panel title={`Carta (${own.length})`} kicker="Productos" actions={
        <div className="w-full sm:w-56"><SelectInput label="Filtrar por categoría" value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="select-product-filter"><option value="">Todas</option>{cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</SelectInput></div>}>
        {visible.length === 0 ? <Empty title="Sin productos" text="Crea el primer plato de esta carta con el formulario de arriba." /> : (
          <TableWrap label="Tabla de productos">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/50"><tr><th className={thCls}>Producto</th><th className={thCls}>Categoría</th><th className={thCls}>Precio</th><th className={thCls}>Stock</th><th className={thCls}>Estado</th><th className={thCls}>Acciones</th></tr></thead>
              <tbody>{visible.map((p) => (
                <tr key={p.id} className="border-t border-border/60" data-testid={`row-product-${p.id}`}>
                  <td className={tdCls}><div className="flex items-center gap-3">{p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted"><ImageIcon className="h-4 w-4 opacity-40" /></span>}<div><p className="font-bold">{p.name}</p>{p.popular && <p className="text-[11px] text-accent">Destacado</p>}</div></div></td>
                  <td className={tdCls}>{p.category || '—'}</td>
                  <td className={`${tdCls} font-mono-app`}>{money(p.price)}</td>
                  <td className={`${tdCls} font-mono-app ${p.stock === 0 ? 'text-red-700 font-bold' : ''}`}>{p.stock}</td>
                  <td className={tdCls}><Pill on={p.active}>{p.active ? 'Activo' : 'Inactivo'}</Pill></td>
                  <td className={tdCls}><div className="flex gap-2">
                    <button className={btnGhost} onClick={() => edit(p)} aria-label={`Editar ${p.name}`} data-testid={`button-product-edit-${p.id}`}><Pencil className="h-4 w-4" /></button>
                    <button className={btnGhost} disabled={busy === `p-${p.id}`} onClick={() => void run(`p-${p.id}`, () => api(`/api/operations/products/${p.id}`, 'PATCH', { active: !p.active }), p.active ? 'Producto desactivado.' : 'Producto activado.')} data-testid={`button-product-toggle-${p.id}`}>{p.active ? 'Desactivar' : 'Activar'}</button>
                    <button className={btnDanger} disabled={busy === `p-${p.id}`} aria-label={`Eliminar ${p.name}`} onClick={() => { if (window.confirm(`¿Eliminar ${p.name}?`)) void run(`p-${p.id}`, () => api(`/api/operations/products/${p.id}`, 'DELETE'), 'Producto eliminado.'); }} data-testid={`button-product-delete-${p.id}`}><Trash2 className="h-4 w-4" /></button>
                  </div></td>
                </tr>))}</tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}

export function CategoriesManager({ business, categories, products, run, busy, onError }: { business: OpsBusiness; categories: OpsCategory[]; products: OpsProduct[]; run: Run; busy: string | null; onError: (m: string) => void }) {
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const cats = categories.filter((c) => c.restaurantId === business.id);
  const create = async () => {
    if (!name.trim()) return onError('Escribe un nombre para la categoría.');
    if (await run('cat-new', () => api('/api/operations/categories', 'POST', { restaurantId: business.id, name: name.trim(), active: true }), 'Categoría creada.')) setName('');
  };
  return (
    <Panel kicker={business.name} title="Categorías">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1"><TextInput label="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} data-testid="input-category-name" /></div>
        <button className={btnPrimary} disabled={busy === 'cat-new'} onClick={() => void create()} data-testid="button-category-create"><Plus className="h-4 w-4" /> Crear</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {cats.length === 0 && <div className="sm:col-span-2"><Empty title="Sin categorías" text="Las categorías ordenan la carta que ven los clientes." /></div>}
        {cats.map((c) => {
          const count = products.filter((p) => p.restaurantId === business.id && p.category === c.name).length;
          return (
            <div key={c.id} className="rounded-xl bg-muted/40 p-3" data-testid={`card-category-${c.id}`}>
              {editId === c.id ? (
                <div className="flex gap-2">
                  <input aria-label="Nombre de categoría" className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} data-testid={`input-category-edit-${c.id}`} />
                  <button className={btnPrimary} disabled={busy === `c-${c.id}`} onClick={async () => { if (!editName.trim()) return onError('El nombre no puede estar vacío.'); if (await run(`c-${c.id}`, () => api(`/api/operations/categories/${c.id}`, 'PATCH', { restaurantId: business.id, name: editName.trim(), active: c.active }), 'Categoría renombrada.')) setEditId(null); }}>Guardar</button>
                  <button className={btnGhost} onClick={() => setEditId(null)} aria-label="Cancelar"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-bold">{c.name}</p><p className="text-[11px] text-muted-foreground">{count} productos · {c.active ? 'activa' : 'inactiva'}</p></div>
                  <div className="flex gap-1.5">
                    <button className={btnGhost} aria-label={`Renombrar ${c.name}`} onClick={() => { setEditId(c.id); setEditName(c.name); }}><Pencil className="h-4 w-4" /></button>
                    <button className={btnGhost} disabled={busy === `c-${c.id}`} onClick={() => void run(`c-${c.id}`, () => api(`/api/operations/categories/${c.id}`, 'PATCH', { restaurantId: business.id, name: c.name, active: !c.active }), 'Estado de categoría actualizado.')}>{c.active ? 'Desactivar' : 'Activar'}</button>
                    <button className={btnDanger} disabled={busy === `c-${c.id}`} aria-label={`Eliminar ${c.name}`} onClick={() => { if (window.confirm(`¿Eliminar la categoría ${c.name}?`)) void run(`c-${c.id}`, () => api(`/api/operations/categories/${c.id}`, 'DELETE'), 'Categoría eliminada.'); }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

type BizDraft = { name: string; ruc: string; address: string; phone: string; cuisine: string; deliveryFee: string; image: string; isOpen: boolean; active: boolean; administratorId: string; openingHours: OpeningHours | null };
export const bizDraftFrom = (b?: OpsBusiness): BizDraft => ({ name: b?.name ?? '', ruc: b?.ruc ?? '', address: b?.address ?? '', phone: b?.phone ?? '', cuisine: b?.cuisine ?? '', deliveryFee: b ? String(b.deliveryFee) : '0', image: b?.image ?? '', isOpen: b?.isOpen ?? true, active: b?.active ?? true, administratorId: b?.administratorId != null ? String(b.administratorId) : '', openingHours: b?.openingHours ? { ...b.openingHours, days: [...b.openingHours.days] } : null });

export function BusinessForm({ initial, admins, isSystemAdmin, saving, onSubmit, onError, submitLabel }: { initial: BizDraft; admins?: { id: number; name: string; email: string }[]; isSystemAdmin: boolean; saving: boolean; onSubmit: (body: Record<string, unknown>) => Promise<boolean>; onError: (m: string) => void; submitLabel: string }) {
  const [d, setD] = useState<BizDraft>(initial);
  const submit = async () => {
    if (!d.name.trim()) return onError('El nombre del negocio es obligatorio.');
    if (isSystemAdmin && d.openingHours && (!d.openingHours.days.length || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(d.openingHours.opensAt) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(d.openingHours.closesAt) || d.openingHours.opensAt === d.openingHours.closesAt)) return onError('Selecciona al menos un día y horas de apertura y cierre válidas y diferentes.');
    if (d.ruc.trim() && !/^\d{11}$/.test(d.ruc.trim())) return onError('El RUC debe tener exactamente 11 dígitos.');
    const fee = Number(d.deliveryFee);
    if (!Number.isFinite(fee) || fee < 0) return onError('La tarifa de delivery debe ser mayor o igual a cero.');
    const body: Record<string, unknown> = { name: d.name.trim(), ruc: d.ruc.trim(), address: d.address.trim(), phone: d.phone.trim(), cuisine: d.cuisine.trim(), deliveryFee: fee, image: d.image.trim(), isOpen: d.isOpen };
    if (isSystemAdmin) { body.openingHours = d.openingHours; body.active = d.active; body.administratorId = d.administratorId ? Number(d.administratorId) : null; }
    if (await onSubmit(body) && !initial.name) setD(bizDraftFrom());
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <TextInput label="Nombre" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="input-business-name" />
      <TextInput label="RUC (opcional, 11 dígitos)" inputMode="numeric" maxLength={11} value={d.ruc} onChange={(e) => setD({ ...d, ruc: e.target.value.replace(/\D/g, '') })} data-testid="input-business-ruc" />
      <TextInput label="Teléfono" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} data-testid="input-business-phone" />
      <TextInput label="Dirección" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} data-testid="input-business-address" />
      <TextInput label="Tipo de cocina" value={d.cuisine} onChange={(e) => setD({ ...d, cuisine: e.target.value })} data-testid="input-business-cuisine" />
      <TextInput label="Tarifa de delivery S/" type="number" min="0" step="0.1" value={d.deliveryFee} onChange={(e) => setD({ ...d, deliveryFee: e.target.value })} data-testid="input-business-fee" />
      {isSystemAdmin && admins && (
        <SelectInput label="Administrador del negocio" value={d.administratorId} onChange={(e) => setD({ ...d, administratorId: e.target.value })} data-testid="select-business-admin">
          <option value="">Sin asignar</option>
          {admins.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.email}</option>)}
        </SelectInput>
      )}
      <div className="sm:col-span-2"><ImageField value={d.image} onChange={(image) => setD((x) => ({ ...x, image }))} onError={onError} /></div>
      {isSystemAdmin && <OpeningHoursEditor value={d.openingHours} onChange={openingHours => setD(current => ({ ...current, openingHours }))} />}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={d.isOpen} onChange={(e) => setD({ ...d, isOpen: e.target.checked })} data-testid="checkbox-business-open" /> {d.openingHours ? 'Permitir pedidos dentro del horario (desmarca para cerrar temporalmente)' : 'Abierto para pedidos'}</label>
        {isSystemAdmin && <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} data-testid="checkbox-business-active" /> Negocio habilitado en la plataforma</label>}
        <button className={`${btnPrimary} ml-auto`} disabled={saving} onClick={() => void submit()} data-testid="button-business-save">{saving ? 'Guardando…' : submitLabel}</button>
      </div>
    </div>
  );
}
