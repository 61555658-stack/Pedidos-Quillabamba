import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type User } from "@workspace/db";
import type { NextFunction, Request, RequestHandler, Response } from "express";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "pq_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET must be set.");
}
const SESSION_SECRET = sessionSecret;

export type UserRole = "cliente" | "administrador" | "repartidor";
export type PublicUser = Pick<User, "id" | "name" | "email" | "role" | "phone" | "address"> & {
  role: UserRole;
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "cliente" || value === "administrador" || value === "repartidor";
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    phone: user.phone,
    address: user.address,
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashSessionToken(token: string): string {
  return createHmac("sha256", SESSION_SECRET).update(token).digest("hex");
}

export async function createSession(userId: number, res: Response): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({
    id: hashSessionToken(token),
    userId,
    expiresAt,
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export async function deleteSession(token: string | undefined, res: Response): Promise<void> {
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, hashSessionToken(token)));
  }
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function getAuthenticatedUser(req: Request): Promise<User | null> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return null;
  const [result] = await db
    .select({ user: usersTable, session: sessionsTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(and(eq(sessionsTable.id, hashSessionToken(token)), gt(sessionsTable.expiresAt, new Date())))
    .limit(1);
  return result?.user ?? null;
}

export const loadUser: RequestHandler = async (req, _res, next) => {
  req.user = await getAuthenticatedUser(req);
  next();
};

export function requireAuth(roles?: UserRole[]): RequestHandler {
  return async (req, res, next: NextFunction) => {
    const user = req.user ?? await getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Debes iniciar sesión para continuar." });
      return;
    }
    req.user = user;
    if (roles && !roles.includes(user.role as UserRole)) {
      res.status(403).json({ error: "No tienes permisos para esta acción." });
      return;
    }
    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: User | null;
    }
  }
}