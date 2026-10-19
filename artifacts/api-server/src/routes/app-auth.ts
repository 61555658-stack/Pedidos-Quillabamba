import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "@workspace/db";
import { Router, type IRouter, type Response } from "express";
import { consumeVerifiedRegistration } from "./registration-verification";
import type { AppRole } from "../middlewares/appAuthMiddleware";

const scrypt = promisify(scryptCallback);
const router: IRouter = Router();
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;

function setSessionCookie(res: Response, sid: string) {
  res.cookie("sid", sid, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: sessionTtlMs });
}

async function createSession(userId: number, res: Response) {
  const sid = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO public.sessions (id, user_id, expires_at) VALUES ($1, $2, $3)", [sid, userId, new Date(Date.now() + sessionTtlMs)]);
  setSessionCookie(res, sid);
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function roleForVerifiedEmail(email: string, requested: AppRole): AppRole | null {
  const normalized = email.trim().toLowerCase();
  if (normalized === (process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase()) return "administrador_sistema";
  if (requested === "repartidor" && normalized === (process.env.INITIAL_COURIER_EMAIL || "").trim().toLowerCase()) return "repartidor";
  if (requested === "administrador_negocio" && normalized === (process.env.INITIAL_BUSINESS_ADMIN_EMAIL || "").trim().toLowerCase()) return "administrador_negocio";
  if (requested === "cliente") return "cliente";
  return null;
}

router.post("/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body ?? {};
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (typeof name !== "string" || !name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || typeof password !== "string" || password.length < 8
    || !["cliente", "administrador_negocio", "repartidor", "administrador_sistema"].includes(role)) {
    return res.status(400).json({ error: "Revisa nombre, correo, rol y contraseña (mínimo 8 caracteres)." });
  }
  const assignedRole = roleForVerifiedEmail(normalizedEmail, role as AppRole);
  if (!assignedRole) return res.status(403).json({ error: "Ese rol requiere autorización del administrador." });
  if (!consumeVerifiedRegistration(normalizedEmail, role)) return res.status(403).json({ error: "Verifica primero el correo con el código enviado." });
  try {
    const passwordHash = await hashPassword(password);
    const inserted = await pool.query(
      "INSERT INTO public.users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name.trim(), normalizedEmail, passwordHash, assignedRole],
    );
    const user = inserted.rows[0] as { id: number; name: string; email: string; role: AppRole };
    await createSession(user.id, res);
    return res.status(201).json({ user: { id: String(user.id), name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return res.status(409).json({ error: "Ese correo ya está registrado." });
    }
    req.log.error({ err: error }, "App account registration failed");
    return res.status(500).json({ error: "No se pudo crear la cuenta." });
  }
});

router.post("/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ error: "Ingresa correo y contraseña." });
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, password_hash FROM public.users WHERE lower(email) = $1 LIMIT 1",
      [email],
    );
    const user = result.rows[0] as { id: number; name: string; email: string; role: AppRole; password_hash: string } | undefined;
    if (!user || !(await verifyPassword(password, user.password_hash))) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    await createSession(user.id, res);
    return res.json({ user: { id: String(user.id), name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    req.log.error({ err: error }, "App account login failed");
    return res.status(500).json({ error: "No se pudo iniciar sesión." });
  }
});

router.post("/auth/logout", async (req, res) => {
  const sid = req.cookies?.sid;
  if (typeof sid === "string") await pool.query("DELETE FROM public.sessions WHERE id = $1", [sid]);
  res.clearCookie("sid", { path: "/" });
  return res.json({ success: true });
});

export default router;
