import { pool } from "@workspace/db";
import { AppError } from "./operations-data";
import { createPasswordHash, verifyPasswordHash } from "./password";

/** Separate, account-scoped credentials; never accept an owner ID from the browser. */
export async function unlockBusinessAdministration(
  userId: number, sessionId: string,
  credentials: { username: string; password: string }, setup: boolean,
) {
  const username = credentials.username.trim().toLowerCase();
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query("BEGIN");
    const session = (await client.query(
      `SELECT business_mode FROM public.sessions WHERE id=$1 AND user_id=$2
       AND expires_at>now() FOR UPDATE`, [sessionId, userId],
    )).rows[0];
    if (!session) throw new AppError(401, "Inicia sesión de nuevo.");
    if (!["choose", "administrator"].includes(session.business_mode)) {
      throw new AppError(403, "Cierra caja e inicia sesión nuevamente para administrar el negocio.");
    }
    const business = await client.query(
      "SELECT id FROM public.restaurants WHERE administrator_id=$1 AND active LIMIT 1", [userId],
    );
    if (!business.rowCount) throw new AppError(403, "No tienes un negocio activo asignado.");
    const existing = (await client.query(
      "SELECT * FROM public.business_administrator_credentials WHERE user_id=$1 FOR UPDATE", [userId],
    )).rows[0];
    if (setup) {
      if (existing) throw new AppError(409, "Ya creaste tu acceso administrativo. Ingresa con tu usuario y contraseña.");
      const created = await client.query(
        `INSERT INTO public.business_administrator_credentials(user_id,username,password_hash)
         VALUES($1,$2,$3) ON CONFLICT(user_id) DO NOTHING RETURNING user_id`,
        [userId, username, createPasswordHash(credentials.password)],
      );
      if (!created.rowCount) throw new AppError(409, "Ya creaste tu acceso administrativo. Ingresa con tu usuario y contraseña.");
    } else {
      if (!existing) throw new AppError(409, "Primero crea tu usuario y contraseña de administrador.");
      if (existing.locked_until && new Date(existing.locked_until).getTime() > Date.now()) {
        throw new AppError(429, "Demasiados intentos. Espera 15 minutos antes de volver a intentar.");
      }
      if (existing.locked_until) {
        await client.query(
          "UPDATE public.business_administrator_credentials SET failed_attempts=0,locked_until=NULL WHERE user_id=$1",
          [userId],
        );
      }
      const passwordValid = verifyPasswordHash(credentials.password, existing.password_hash);
      if (existing.username !== username || !passwordValid) {
        await client.query(
          `UPDATE public.business_administrator_credentials SET failed_attempts=failed_attempts+1,
           locked_until=CASE WHEN failed_attempts+1>=5 THEN now()+interval '15 minutes' ELSE locked_until END
           WHERE user_id=$1`, [userId],
        );
        await client.query("COMMIT");
        committed = true;
        throw new AppError(401, "Usuario o contraseña de administrador incorrectos.");
      }
      await client.query(
        "UPDATE public.business_administrator_credentials SET failed_attempts=0,locked_until=NULL WHERE user_id=$1",
        [userId],
      );
    }
    await client.query(
      "UPDATE public.sessions SET business_mode='administrator',business_admin_verified_at=now() WHERE id=$1 AND user_id=$2",
      [sessionId, userId],
    );
    await client.query("COMMIT");
    committed = true;
  } finally {
    if (!committed) await client.query("ROLLBACK");
    client.release();
  }
}
