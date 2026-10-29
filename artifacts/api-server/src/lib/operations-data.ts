import { pool } from "@workspace/db";
import type { AppUser } from "../middlewares/appAuthMiddleware";
import type { Request } from "express";

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireUser(req: Request, roles?: string[], allowCashier = false): AppUser {
  if (!req.isAuthenticated()) throw new AppError(401, "Inicia sesión.");
  if (roles && !roles.includes(req.user.role)) throw new AppError(403, "No tienes permiso para esta acción.");
  if (!allowCashier && req.user.role === "administrador_negocio" && req.user.businessMode !== "administrator") {
    throw new AppError(403, req.user.businessMode === "cashier" ? "La caja no tiene permisos de administración. Cierra caja e inicia sesión de nuevo para administrar." : "Selecciona cómo deseas ingresar al negocio.");
  }
  return req.user;
}
export async function ownsBusiness(user: AppUser, id: number, client = pool) {
  const result = await client.query("SELECT id FROM public.restaurants WHERE id=$1 AND ($2='administrador_sistema' OR (administrator_id=$3 AND active))", [id, user.role, Number(user.id)]);
  if (!result.rowCount) throw new AppError(403, "Este negocio no está asignado a tu cuenta o está deshabilitado.");
}
export const orderSelect = `
 SELECT o.*, r.name AS current_restaurant_name, r.address AS business_address, r.phone AS business_phone,
 u.name AS courier_name, u.email AS courier_email, u.phone AS courier_phone, cu.phone AS customer_phone
 FROM public.orders o LEFT JOIN public.restaurants r ON r.id=o.restaurant_id
 LEFT JOIN public.users u ON u.id=o.delivery_partner_id
 LEFT JOIN public.users cu ON cu.id=o.customer_id`;

export function toOrder(o: Record<string, any>) {
  return {
    id: o.id, restaurantId: o.restaurant_id, restaurantName: o.restaurant_name,
    customerName: o.customer_name, customerUserId: String(o.customer_id),
    total: Number(o.total), deliveryFee: Number(o.delivery_fee),
    status: o.status, paymentMethod: o.payment_method,
    createdAt: new Date(o.created_at).toISOString(), deliveryAddress: o.delivery_address || "",
    items: o.items,
    businessAddress: o.business_address || "", businessPhone: o.business_phone || "",
    customerPhone: o.delivery_partner_id ? o.customer_phone || "" : "",
    deliveryPartnerPhone: o.courier_phone || "",
    ...(o.delivery_partner_id ? { deliveryPartnerUserId: String(o.delivery_partner_id), deliveryPartnerName: o.courier_name, deliveryPartnerEmail: o.courier_email } : {}),
    ...(o.delivered_at ? { deliveredAt: new Date(o.delivered_at).toISOString() } : {}),
    ...(o.proof_path ? { proofUrl: `/api/orders/${o.id}/proof` } : {}),
    rating: o.rating ?? null,
  };
}
export async function visibleOrders(user: AppUser) {
  const scope = user.role === "administrador_sistema" ? "TRUE"
    : user.role === "administrador_negocio" ? "r.administrator_id=$1 AND r.active"
    : user.role === "repartidor" ? "(o.delivery_partner_id=$1 OR (o.status IN ('received','preparing','ready') AND o.delivery_partner_id IS NULL))"
    : "o.customer_id=$1";
  const result = await pool.query(`${orderSelect} WHERE ${scope} ORDER BY o.created_at DESC, o.id DESC`, scope === "TRUE" ? [] : [Number(user.id)]);
  return result.rows.map(toOrder);
}
export async function visibleOrder(user: AppUser, id: number, allowUnclaimed = false) {
  const result = await pool.query(`${orderSelect} WHERE o.id=$1`, [id]);
  const row = result.rows[0];
  if (!row) throw new AppError(404, "Pedido no encontrado.");
  if (user.role === "administrador_sistema"
    || user.role === "cliente" && row.customer_id === Number(user.id)
    || user.role === "repartidor" && (row.delivery_partner_id === Number(user.id) || allowUnclaimed && ["received","preparing","ready"].includes(row.status) && !row.delivery_partner_id)) return row;
  if (user.role === "administrador_negocio") {
    await ownsBusiness(user, row.restaurant_id);
    return row;
  }
  throw new AppError(404, "Pedido no encontrado.");
}
export const businessSelect = `SELECT r.id,r.name,r.ruc,r.address,r.phone,r.administrator_id AS "administratorId",
  COALESCE(u.name,'Sin asignar') AS "administratorName",r.is_open AS "isOpen",r.active,r.cuisine,
  r.delivery_fee::float8 AS "deliveryFee",r.image,r.opening_hours AS "openingHours"
  FROM public.restaurants r LEFT JOIN public.users u ON u.id=r.administrator_id`;
export const productSelect = `SELECT p.id,p.restaurant_id AS "restaurantId",p.name,p.description,p.category,
  p.price::float8 AS price,p.stock,p.active,p.image,p.popular FROM public.products p`;
export const categorySelect = `SELECT c.id,c.restaurant_id AS "restaurantId",c.name,c.active FROM public.categories c`;
