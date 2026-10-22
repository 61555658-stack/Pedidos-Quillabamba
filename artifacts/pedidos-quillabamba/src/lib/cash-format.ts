type ApiLike = { status: number; data: unknown };
const isApi = (e: unknown): e is ApiLike => typeof e === 'object' && e !== null && 'status' in e && 'data' in e;

export const limaTime = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
export const shiftLabel = (s: string) => (s === 'morning' ? 'Mañana' : s === 'afternoon' ? 'Tarde' : s);

export function errText(e: unknown, fallback = 'La operación falló.') {
  if (isApi(e)) {
    const d = e.data as { error?: string; message?: string } | null;
    return d?.error || d?.message || fallback;
  }
  return e instanceof Error ? e.message : fallback;
}
export const errStatus = (e: unknown) => (isApi(e) ? e.status : 0);
