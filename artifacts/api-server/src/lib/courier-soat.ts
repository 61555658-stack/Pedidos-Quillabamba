import { randomBytes } from "node:crypto";

const origin = "https://api.croma.run";
const ttl = 5 * 60_000;
export const normalizePlate = (plate: string) => plate.trim().toUpperCase().replace(/[\s-]/g, "");
const localDate = (now: number) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(now));

export class SoatError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export type ActiveSoat = {
  plate: string; company: string; policyNumber: string;
  startDate: string; endDate: string; checkedAt: number;
};
type Result = {
  status: "pending" | "active" | "inactive"; plate: string;
  verificationId?: string; company?: string; startDate?: string; endDate?: string;
};
type Lookup = {
  expiresAt: number; nextPollAt: number; jobUrl?: string;
  result?: Result; active?: ActiveSoat; verificationId?: string;
};
type Json = Record<string, any>;
const unavailable = () => new SoatError(503, "No pudimos confirmar el SOAT con Croma. Inténtalo más tarde; el registro no se ha completado.");

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function parseSoat(data: Json, plate: string, now = Date.now()): ActiveSoat | null {
  if (!data || typeof data.found !== "boolean" || typeof data.has_active_soat !== "boolean"
    || typeof data.plate !== "string" || normalizePlate(data.plate) !== normalizePlate(plate)) throw unavailable();
  if (!data.found || !data.has_active_soat) return null;
  const active = data.active;
  if (!active || active.status !== "VIGENTE" || active.annulled_date
    || !validDate(active.start_date) || !validDate(active.end_date)
    || typeof active.company !== "string" || !active.company.trim()
    || typeof active.policy_number !== "string" || !active.policy_number.trim()) throw unavailable();
  const today = localDate(now);
  if (active.start_date > today || active.end_date < today) return null;
  return { plate: normalizePlate(plate), company: active.company, policyNumber: active.policy_number,
    startDate: active.start_date, endDate: active.end_date, checkedAt: now };
}

// All approvals live on the server, bound to the email and plate, never to a client boolean.
export function createSoatService(fetcher: typeof fetch = fetch, getKey = () => process.env.CROMA_API_KEY) {
  const lookups = new Map<string, Lookup>();
  const inFlight = new Map<string, Promise<Result>>();
  const limits = new Map<string, { count: number; until: number }>();
  const keyFor = (email: string, plate: string) => `${email.trim().toLowerCase()}:${normalizePlate(plate)}`;

  function checkLimit(ip: string, now: number) {
    for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
    for (const [key, max] of [[ip, 5], ["__global__", 60]] as const) {
      const value = limits.get(key);
      if (value && value.count >= max) throw new SoatError(429, "Demasiadas consultas de SOAT. Espera unos minutos antes de intentarlo otra vez.");
    }
    for (const key of [ip, "__global__"]) {
      const value = limits.get(key) ?? { count: 0, until: now + 10 * 60_000 };
      value.count++; limits.set(key, value);
    }
  }
  async function lookup(email: string, plateInput: string, ip: string): Promise<Result> {
    const plate = normalizePlate(plateInput);
    if (!/^[A-Z0-9]{4,10}$/.test(plate)) throw new SoatError(400, "Ingresa una placa válida.");
    const key = keyFor(email, plate);
    const now = Date.now();
    for (const [id, value] of lookups) if (value.expiresAt <= now) lookups.delete(id);
    const previous = lookups.get(key);
    if (previous?.result) {
      if (previous.active && previous.active.endDate < localDate(now)) { lookups.delete(key); }
      else return previous.result;
    }
    const existing = inFlight.get(key);
    if (existing) return existing;
    const apiKey = getKey();
    if (!apiKey) throw new SoatError(503, "La verificación del SOAT no está disponible. No se puede registrar un repartidor sin verificar su seguro.");
    if (previous?.jobUrl && now < previous.nextPollAt) return { status: "pending", plate };
    const work = (async (): Promise<Result> => {
      let entry = lookups.get(key);
      if (!entry) {
        checkLimit(ip, now);
        if (lookups.size >= 1000) throw unavailable();
        entry = { expiresAt: now + ttl, nextPollAt: 0 };
        lookups.set(key, entry);
      }
      try {
        const response = await fetcher(entry.jobUrl || `${origin}/pe/apeseg/soat/v1`, {
          method: entry.jobUrl ? "GET" : "POST", redirect: "error",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Prefer: "wait=10" },
          ...(entry.jobUrl ? {} : { body: JSON.stringify({ plate }) }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw unavailable();
        const body = await response.json() as Json;
        if (body.error || (body.job && !["queued", "running", "completed"].includes(body.job.status))) throw unavailable();
        if (response.status === 202 || (body.job && body.job.status !== "completed")) {
          const url = new URL(body.job?.status_url, origin);
          // Never send the API key to a URL outside the documented jobs endpoint.
          if (url.origin !== origin || !/^\/jobs\/[A-Za-z0-9_-]+$/.test(url.pathname)
            || url.username || url.password || url.search || url.hash) throw unavailable();
          entry.jobUrl = url.href;
          entry.nextPollAt = Date.now() + Math.min(10_000, Math.max(2_000, Number(response.headers.get("Retry-After") || 2) * 1000 || 2000));
          return { status: "pending", plate };
        }
        const active = parseSoat(body.data, plate);
        entry.expiresAt = Date.now() + ttl;
        entry.active = active ?? undefined;
        entry.verificationId = active ? randomBytes(32).toString("hex") : undefined;
        entry.result = active ? { status: "active", plate, verificationId: entry.verificationId,
          company: active.company, startDate: active.startDate, endDate: active.endDate } : { status: "inactive", plate };
        return entry.result;
      } catch (error) {
        // Preserve a known job so retries poll it rather than buying another lookup.
        if (!entry.jobUrl) lookups.delete(key);
        throw error instanceof SoatError ? error : unavailable();
      }
    })();
    inFlight.set(key, work);
    try { return await work; } finally { inFlight.delete(key); }
  }
  function approval(email: string, plate: string, id?: string): ActiveSoat {
    const entry = lookups.get(keyFor(email, plate));
    if (!id || !entry?.active || entry.verificationId !== id || entry.expiresAt <= Date.now()
      || entry.active.endDate < localDate(Date.now())) {
      throw new SoatError(409, "Verifica nuevamente el SOAT de esta placa antes de registrarte.");
    }
    return entry.active;
  }
  return { lookup, approval, consume: (email: string, plate: string) => lookups.delete(keyFor(email, plate)) };
}
export const courierSoat = createSoatService();
