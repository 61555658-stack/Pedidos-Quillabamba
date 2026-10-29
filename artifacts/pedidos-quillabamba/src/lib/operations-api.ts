import { useCallback, useEffect, useRef, useState } from 'react';
import type { OpeningHours } from '@workspace/api-client-react';

export type OpsUser = { id: number; name: string; email: string; role: string; active: boolean; phone: string; address: string };
export type OpsBusiness = { id: number; name: string; ruc: string; address: string; phone: string; administratorId: number | null; administratorName: string; isOpen: boolean; openNow: boolean; openingHours: OpeningHours | null; active: boolean; cuisine: string; deliveryFee: number; image: string };
export type OpsProduct = { id: number; restaurantId: number; name: string; description: string; category: string; price: number; stock: number; active: boolean; image: string; popular: boolean };
export type OpsCategory = { id: number; restaurantId: number; name: string; active: boolean };
export type OrderStatus = 'received' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';
export type OpsOrder = {
  id: number; restaurantId: number; restaurantName: string; customerName: string; total: number; status: OrderStatus;
  paymentMethod: 'cash' | 'yape' | 'card'; createdAt: string; deliveryAddress: string;
  deliveryPartnerUserId?: string; deliveryPartnerName?: string; deliveryPartnerEmail?: string;
  deliveryPartnerDni?: string; deliveryPartnerVehiclePlate?: string;
  businessPhone?: string; businessAddress?: string; customerPhone?: string; deliveryPartnerPhone?: string;
  items: { id: number; name: string; price: number; quantity: number }[]; deliveryFee: number; deliveredAt?: string; proofUrl?: string;
};
export type OpsState = { users: OpsUser[]; businesses: OpsBusiness[]; products: OpsProduct[]; categories: OpsCategory[]; orders: OpsOrder[]; settings: { platformName: string; minimumOrder: string } };

export const statusLabels: Record<OrderStatus, string> = {
  received: 'Recibido', preparing: 'En preparación', ready: 'Listo para recoger', on_the_way: 'En camino', delivered: 'Entregado', cancelled: 'Cancelado',
};
export const paymentLabels: Record<OpsOrder['paymentMethod'], string> = { cash: 'Efectivo', yape: 'Yape', card: 'Tarjeta' };
export const roleOptions = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'repartidor', label: 'Repartidor' },
  { value: 'administrador_negocio', label: 'Administrador de negocio' },
  { value: 'administrador_sistema', label: 'Administrador del sistema' },
];
export const roleLabel = (r: string) => roleOptions.find((o) => o.value === r)?.label ?? (r === 'administrador_negocio_pendiente' ? 'Negocio · pendiente de aprobación' : r === 'administrador_negocio_rechazado' ? 'Negocio · solicitud rechazada' : r);
export const money = (n: number) => `S/ ${(Number(n) || 0).toFixed(2)}`;
export const fmtDate = (s?: string) => {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });
};
export const limaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function readError(res: Response) {
  try {
    const data = await res.json();
    return data?.error || data?.message || `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

export async function api<T = unknown>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method, credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function uploadImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Solo se aceptan imágenes JPEG, PNG o WEBP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen debe pesar como máximo 5 MB.');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/files', { method: 'POST', credentials: 'include', body: fd });
  if (!res.ok) throw new Error(await readError(res));
  const data = await res.json();
  return data.path as string;
}

export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export function useOperationsState() {
  const [state, setState] = useState<OpsState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const reload = useCallback(async () => {
    try {
      const data = await api<OpsState>('/api/operations/state');
      if (alive.current) { setState(data); setError(''); }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'No se pudo cargar la información.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void reload();
    const t = window.setInterval(() => void reload(), 10_000);
    return () => { alive.current = false; window.clearInterval(t); };
  }, [reload]);
  return { state, error, loading, reload };
}

/** Runs a mutation, reloads state on success, returns error text or ''. */
export function useMutationRunner(reload: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const run = useCallback(async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key); setMessage(null);
    try {
      await fn();
      await reload();
      setMessage({ kind: 'ok', text: ok });
      return true;
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'La operación falló.' });
      return false;
    } finally {
      setBusy(null);
    }
  }, [reload]);
  return { busy, message, setMessage, run };
}
