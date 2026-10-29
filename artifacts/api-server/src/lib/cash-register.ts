import { pool } from "@workspace/db";
import type { AppUser } from "../middlewares/appAuthMiddleware";
import { OpenCashShiftResponse } from "@workspace/api-zod";
import { AppError, ownsBusiness, orderSelect, toOrder } from "./operations-data";

export const shiftSelect = `SELECT s.*,r.name AS business_name,u.name AS opened_by_name
 FROM public.cash_shifts s JOIN public.restaurants r ON r.id=s.business_id
 JOIN public.users u ON u.id=s.opened_by`;
export function toShift(row: Record<string, any>) {
  return OpenCashShiftResponse.parse({
    id:row.id,businessId:row.business_id,businessName:row.business_name,
    username:row.username,shift:row.shift,openedByName:row.opened_by_name,
    openedAt:new Date(row.opened_at).toISOString(),
    closedAt:row.closed_at?new Date(row.closed_at).toISOString():null,
  });
}
export async function ownShift(user:AppUser,id:number) {
  const row=(await pool.query(`${shiftSelect} WHERE s.id=$1`,[id])).rows[0];
  if(!row)throw new AppError(404,"Turno de caja no encontrado.");
  await ownsBusiness(user,row.business_id);
  return row;
}
export async function activeCashShift(user:AppUser,client:Pick<typeof pool,"query">=pool,lock=false) {
  if(user.role!=="administrador_negocio"||user.businessMode!=="cashier"||!user.cashShiftId)throw new AppError(403,"Abre una caja para atender pedidos.");
  const row=(await client.query(`SELECT s.* FROM public.cash_shifts s JOIN public.restaurants r ON r.id=s.business_id
   WHERE s.id=$1 AND s.opened_by=$2 AND s.closed_at IS NULL AND r.administrator_id=$2 AND r.active${lock?" FOR UPDATE OF s":""}`,[user.cashShiftId,Number(user.id)])).rows[0];
  if(!row)throw new AppError(403,"La caja está cerrada o ya no tienes acceso al negocio. Inicia sesión nuevamente.");
  return row;
}
export async function cashShiftReport(user:AppUser,id:number) {
  const shift=await ownShift(user,id);
  const [orders,events]=await Promise.all([
    pool.query(`${orderSelect} WHERE o.restaurant_id=$2 AND (o.cash_shift_id=$1 OR EXISTS (
      SELECT 1 FROM public.cash_order_events e WHERE e.order_id=o.id AND e.shift_id=$1))
      ORDER BY o.created_at,o.id`,[id,shift.business_id]),
    pool.query(`SELECT e.*,u.name AS courier_name FROM public.cash_order_events e LEFT JOIN public.users u ON u.id=e.courier_id WHERE e.shift_id=$1 ORDER BY e.created_at,e.id`,[id]),
  ]);
  const totals={handledOrders:orders.rows.length,deliveredOrders:0,units:0,productSales:0,deliveryFees:0,total:0};
  for(const o of orders.rows)if(o.status==="delivered"&&o.cash_shift_id===id){
    totals.deliveredOrders++;
    for(const item of o.items){totals.units+=item.quantity;totals.productSales+=Math.round(Number(item.price)*100)*item.quantity;}
    totals.deliveryFees+=Math.round(Number(o.delivery_fee)*100);
  }
  totals.productSales/=100;totals.deliveryFees/=100;
  totals.total=Math.round((totals.productSales+totals.deliveryFees)*100)/100;
  return{shift:toShift(shift),orders:orders.rows.map(row=>toOrder(row,"administrador_negocio")),events:events.rows.map(e=>({id:e.id,orderId:e.order_id,action:e.action,createdAt:new Date(e.created_at).toISOString(),courierName:e.courier_name??null})),totals};
}
export async function closeCashShift(user:AppUser,id:number) {
  await ownShift(user,id);
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const updated=await client.query("UPDATE public.cash_shifts SET closed_at=now(),closed_by=$1 WHERE id=$2 AND closed_at IS NULL RETURNING id",[Number(user.id),id]);
    if(!updated.rowCount)throw new AppError(409,"Esta caja ya está cerrada.");
    await client.query("UPDATE public.sessions SET business_mode='cashier_login',cash_shift_id=NULL WHERE cash_shift_id=$1",[id]);
    await client.query("COMMIT");
    return toShift((await pool.query(`${shiftSelect} WHERE s.id=$1`,[id])).rows[0]);
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
