import { pool } from "@workspace/db";
import type { NextFunction, Request, Response } from "express";

export type AppRole = "cliente" | "administrador_negocio" | "repartidor" | "administrador_sistema";
export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  role: AppRole;
  businessMode?: "choose" | "administrator" | "cashier" | "cashier_login";
  cashShiftId?: number | null;
}

declare global {
  namespace Express {
    interface User extends AppUser {}
    interface Request {
      user?: User;
      isAuthenticated(): this is Request & { user: User };
    }
  }
}

export async function appAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];
  const sid = req.cookies?.sid;
  if (!sid || typeof sid !== "string") return next();
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, s.business_mode, s.cash_shift_id
       FROM public.sessions s JOIN public.users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW() AND u.active
       AND u.role IN ('cliente','repartidor','administrador_negocio','administrador_sistema')`,
      [sid],
    );
    const row = result.rows[0] as { id: number; name: string; email: string; role: AppRole; business_mode: AppUser["businessMode"]; cash_shift_id: number | null } | undefined;
    if (row) req.user = { id: String(row.id), email: row.email, firstName: row.name, lastName: null, role: row.role, businessMode:row.business_mode, cashShiftId:row.cash_shift_id };
    return next();
  } catch (error) {
    return next(error);
  }
}
