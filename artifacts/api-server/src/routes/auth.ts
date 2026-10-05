import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  createSession,
  deleteSession,
  hashPassword,
  isUserRole,
  requireAuth,
  toPublicUser,
  verifyPassword,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const role = req.body?.role ?? "cliente";
  if (name.length < 2 || !email.includes("@") || password.length < 8 || !isUserRole(role)) {
    res.status(400).json({ error: "Nombre, correo, rol y una contraseña de al menos 8 caracteres son obligatorios." });
    return;
  }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "Ese correo ya está registrado." });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash: await hashPassword(password),
    role,
  }).returning();
  await createSession(user.id, res);
  res.status(201).json(toPublicUser(user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const requestedRole = req.body?.role;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || (requestedRole && user.role !== requestedRole) || !(await verifyPassword(password, user?.passwordHash ?? ""))) {
    res.status(401).json({ error: "Correo, contraseña o rol incorrectos." });
    return;
  }
  await createSession(user.id, res);
  res.json(toPublicUser(user));
});

router.get("/auth/me", requireAuth(), (req, res) => {
  res.json(toPublicUser(req.user!));
});

router.patch("/auth/me", requireAuth(), async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
  const address = typeof req.body?.address === "string" ? req.body.address.trim() : undefined;
  if (!name && address === undefined) {
    res.status(400).json({ error: "No hay cambios para guardar." });
    return;
  }
  const [user] = await db.update(usersTable).set({
    ...(name ? { name } : {}),
    ...(address !== undefined ? { address } : {}),
    updatedAt: new Date(),
  }).where(eq(usersTable.id, req.user!.id)).returning();
  res.json(toPublicUser(user));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await deleteSession(req.cookies?.pq_session as string | undefined, res);
  res.status(204).send();
});

export default router;