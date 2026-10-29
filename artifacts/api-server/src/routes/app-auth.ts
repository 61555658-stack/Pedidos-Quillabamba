import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "@workspace/db";
import { Router, type IRouter, type Response } from "express";
import {
  DecideBusinessAdminRegistrationRequestBody,
  DecideBusinessAdminRegistrationRequestParams,
  DecideBusinessAdminRegistrationRequestResponse,
  ListBusinessAdminRegistrationRequestsResponse,
} from "@workspace/api-zod";
import { consumeVerifiedRegistration } from "./registration-verification";
import type { AppRole } from "../middlewares/appAuthMiddleware";
import { requireUser } from "../lib/operations-data";
import { SaveAccountProfileBody, GetAccountProfileResponse } from "@workspace/api-zod";
import { RegisterAccountBody } from "@workspace/api-zod";
import { courierSoat, normalizePlate, SoatError, type ActiveSoat } from "../lib/courier-soat";

const scrypt = promisify(scryptCallback);
const router: IRouter = Router();
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;

router.get("/auth/user", (req, res) => {
  res.setHeader("Cache-Control","no-store");
  res.json({user:req.isAuthenticated() ? req.user : null});
});
router.get("/account",async(req,res)=>{
  const user=requireUser(req);
  const result=await pool.query("SELECT name,COALESCE(phone,'') AS phone,COALESCE(address,'') AS address FROM public.users WHERE id=$1",[Number(user.id)]);
  res.json(GetAccountProfileResponse.parse(result.rows[0]));
});
router.patch("/account",async(req,res)=>{
  const user=requireUser(req);
  const d=SaveAccountProfileBody.parse(req.body);
  if(!d.name.trim()) {res.status(400).json({error:"Ingresa tu nombre."});return;}
  await pool.query("UPDATE public.users SET name=$1,phone=$2,address=$3,updated_at=now() WHERE id=$4",[d.name.trim(),d.phone,d.address,Number(user.id)]);
  res.json(GetAccountProfileResponse.parse({...d,name:d.name.trim()}));
});

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
   if (requested === "repartidor") return "repartidor";
  if (requested === "administrador_negocio") return "administrador_negocio";
  if (requested === "cliente") return "cliente";
  return null;
}

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterAccountBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revisa los datos de registro: nombre, correo, contraseña y documentos." });
  const { name, email, password, role, courier, soatVerificationId } = parsed.data;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (typeof name !== "string" || !name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || typeof password !== "string" || password.length < 8
    || !["cliente", "administrador_negocio", "repartidor", "administrador_sistema"].includes(role)) {
    return res.status(400).json({ error: "Revisa nombre, correo, rol y contraseña (mínimo 8 caracteres)." });
  }
  const assignedRole = roleForVerifiedEmail(normalizedEmail, role as AppRole);
  if (!assignedRole) return res.status(403).json({ error: "Ese rol requiere autorización del administrador." });
  let soat: ActiveSoat | undefined;
  if (role === "repartidor") {
    if (!courier || name.trim().split(/\s+/).length < 2) {
      return res.status(400).json({ error: "Completa tu nombre y apellidos, DNI, número de licencia y placa del vehículo." });
    }
    try { soat = courierSoat.approval(normalizedEmail, courier.vehiclePlate, soatVerificationId); }
    catch (error) {
      if (error instanceof SoatError) return res.status(error.status).json({ error: error.message });
      throw error;
    }
  }
  if (!consumeVerifiedRegistration(normalizedEmail, role)) return res.status(403).json({ error: "Verifica primero el correo con el código enviado." });
  const client = await pool.connect();
  try {
    const passwordHash = await hashPassword(password);
    const pendingBusinessAdminApproval = assignedRole === "administrador_negocio";
    const storedRole = pendingBusinessAdminApproval ? "administrador_negocio_pendiente" : assignedRole;
    await client.query("BEGIN");
    const inserted = await client.query(
      "INSERT INTO public.users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
      [name.trim(), normalizedEmail, passwordHash, storedRole],
    );
    const user = inserted.rows[0] as { id: number; name: string; email: string; role: AppRole };
    if (courier && soat) {
      await client.query(
        `INSERT INTO public.courier_registration_profiles
          (user_id,dni,license_number,vehicle_plate,soat_company,soat_policy_number,soat_start_date,soat_end_date,soat_verified_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [user.id, courier.dni, courier.licenseNumber.toUpperCase(), normalizePlate(courier.vehiclePlate),
          soat.company, soat.policyNumber, soat.startDate, soat.endDate, new Date(soat.checkedAt)],
      );
    }
    let sid: string | undefined;
    if (!pendingBusinessAdminApproval) {
      sid = randomBytes(32).toString("hex");
      await client.query("INSERT INTO public.sessions (id, user_id, expires_at) VALUES ($1,$2,$3)", [sid, user.id, new Date(Date.now() + sessionTtlMs)]);
    }
    await client.query("COMMIT");
    if (courier && soat) courierSoat.consume(normalizedEmail, courier.vehiclePlate);
    if (pendingBusinessAdminApproval) {
      return res.status(202).json({ pendingApproval: true });
    }
    setSessionCookie(res, sid!);
    return res.status(201).json({ user: { id: String(user.id), name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    await client.query("ROLLBACK");
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return res.status(409).json({ error: "Ese correo ya está registrado." });
    }
    req.log.error({ err: error }, "App account registration failed");
    return res.status(500).json({ error: "No se pudo crear la cuenta." });
  } finally { client.release(); }
});

router.post("/auth/login", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = req.body?.role;
  if (!["cliente", "administrador_negocio", "repartidor", "administrador_sistema"].includes(role)) {
    return res.status(400).json({ error: "Selecciona un rol válido para ingresar." });
  }
  if (!email || !password) return res.status(400).json({ error: "Ingresa correo y contraseña." });
  try {
    const result = await pool.query(
       "SELECT id, name, email, role, password_hash FROM public.users WHERE lower(email) = $1 AND active LIMIT 1",
      [email],
    );
    const user = result.rows[0] as { id: number; name: string; email: string; role: AppRole; password_hash: string } | undefined;
    if (!user || !(await verifyPassword(password, user.password_hash))) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    if ((user.role as string) === "administrador_negocio_pendiente") {
      return res.status(403).json({ error: "Tu solicitud de administrador de negocio está pendiente de aprobación." });
    }
    if ((user.role as string) === "administrador_negocio_rechazado") {
      return res.status(403).json({ error: "Tu solicitud fue rechazada. Comunícate con el administrador del sistema." });
    }
    if (user.role !== role) {
      return res.status(403).json({ error: "El rol seleccionado no coincide con esta cuenta. Selecciona el rol correcto para ingresar." });
    }
    await createSession(user.id, res);
    return res.json({ user: { id: String(user.id), name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    req.log.error({ err: error }, "App account login failed");
    return res.status(500).json({ error: "No se pudo iniciar sesión." });
  }
});

router.get("/auth/business-admin-requests", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Inicia sesión." });
    return;
  }
  if (req.user.role !== "administrador_sistema") {
    res.status(403).json({ error: "Se requiere una cuenta de administrador del sistema." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, name, email, created_at AS "createdAt"
       FROM public.users
       WHERE role = $1
       ORDER BY created_at ASC, id ASC`,
      ["administrador_negocio_pendiente"],
    );
    res.json(ListBusinessAdminRegistrationRequestsResponse.parse(result.rows));
  } catch (error) {
    req.log.error({ err: error }, "Could not list business administrator requests");
    res.status(500).json({ error: "No se pudieron cargar las solicitudes." });
  }
});

router.post("/auth/business-admin-requests/:userId/decision", async (req, res): Promise<void> => {
  const params = DecideBusinessAdminRegistrationRequestParams.safeParse(req.params);
  const body = DecideBusinessAdminRegistrationRequestBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "La decisión o la solicitud no son válidas." });
    return;
  }
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Inicia sesión." });
    return;
  }
  if (req.user.role !== "administrador_sistema") {
    res.status(403).json({ error: "Se requiere una cuenta de administrador del sistema." });
    return;
  }

  try {
    const userId = params.data.userId;
    if (body.data.decision === "approve") {
      const result = await pool.query(
        "UPDATE public.users SET role = $1, updated_at = NOW() WHERE id = $2 AND role = $3 RETURNING id",
        ["administrador_negocio", userId, "administrador_negocio_pendiente"],
      );
      if (!result.rowCount) {
        res.status(404).json({ error: "La solicitud ya fue atendida o no existe." });
        return;
      }
      res.json(DecideBusinessAdminRegistrationRequestResponse.parse({ decision: "approved" }));
      return;
    }

    const result = await pool.query(
      "UPDATE public.users SET role = $1, updated_at = NOW() WHERE id = $2 AND role = $3 RETURNING id",
      ["administrador_negocio_rechazado", userId, "administrador_negocio_pendiente"],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "La solicitud ya fue atendida o no existe." });
      return;
    }
    res.json(DecideBusinessAdminRegistrationRequestResponse.parse({ decision: "rejected" }));
  } catch (error) {
    req.log.error({ err: error }, "Could not decide business administrator request");
    res.status(500).json({ error: "No se pudo guardar la decisión." });
  }
});

router.post("/auth/logout", async (req, res) => {
  const sid = req.cookies?.sid;
  if (typeof sid === "string") await pool.query("DELETE FROM public.sessions WHERE id = $1", [sid]);
  res.clearCookie("sid", { path: "/" });
  return res.json({ success: true });
});

export default router;
