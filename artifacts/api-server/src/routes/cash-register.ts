import { Router,type IRouter } from "express";
import { pool } from "@workspace/db";
import { z } from "zod";
import {
  OpenCashShiftBody, ReleaseCashierOrderBody, GetBusinessAccessResponse, GetCashierStateResponse,
  GetBusinessCashShiftResponse, ListBusinessCashShiftsResponse, GetOrderResponse,
} from "@workspace/api-zod";
import { requireUser,ownsBusiness,AppError,orderSelect,toOrder,visibleOrder } from "../lib/operations-data";
import { verifyPasswordHash } from "../lib/password";
import { activeCashShift,cashShiftReport,closeCashShift,ownShift,shiftSelect,toShift } from "../lib/cash-register";
import type { AppUser } from "../middlewares/appAuthMiddleware";

const router:IRouter=Router();
const id=(value:unknown)=>z.coerce.number().int().positive().parse(value);
async function accessContext(user:AppUser){
  const businesses=await pool.query(`SELECT id,name FROM public.restaurants WHERE active AND ($1='administrador_sistema' OR administrator_id=$2) ORDER BY name`,[user.role,Number(user.id)]);
  const shift=user.cashShiftId?(await pool.query(`${shiftSelect} WHERE s.id=$1 AND s.closed_at IS NULL`,[user.cashShiftId])).rows[0]:null;
  return GetBusinessAccessResponse.parse({mode:user.role==="administrador_sistema"?"administrator":user.businessMode||"choose",businesses:businesses.rows,shift:shift?toShift(shift):null});
}
router.get("/business/access",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio","administrador_sistema"],true);
  res.setHeader("Cache-Control","no-store");res.json(await accessContext(user));
});
router.post("/business/access/administrator",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio","administrador_sistema"],true);
  const result=await pool.query("UPDATE public.sessions SET business_mode='administrator' WHERE id=$1 AND business_mode IN ('choose','administrator') RETURNING id",[req.cookies.sid]);
  if(!result.rowCount)throw new AppError(403,"Cierra caja e inicia sesión nuevamente para administrar el negocio.");
  res.json(await accessContext({...user,businessMode:"administrator"}));
});
router.post("/cashier/open",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio"],true);
  const data=OpenCashShiftBody.parse(req.body);
  const businessId=id(data.businessId);
  const username=z.enum(["caja1m","caja1t"]).parse(data.username.trim().toLowerCase());
  const password=z.string().min(1).max(128).parse(data.password);
  await ownsBusiness(user,businessId);
  const session=(await pool.query("SELECT cashier_lock_until,business_mode FROM public.sessions WHERE id=$1",[req.cookies.sid])).rows[0];
  if(session?.business_mode==="cashier")throw new AppError(409,"Ya tienes una caja abierta en esta sesión.");
  if(session?.cashier_lock_until&&new Date(session.cashier_lock_until).getTime()>Date.now())throw new AppError(429,"Demasiados intentos. Espera 15 minutos antes de volver a intentar.");
  const credential=(await pool.query("SELECT * FROM public.cashier_credentials WHERE username=$1",[username])).rows[0];
  if(!credential||!verifyPasswordHash(password,credential.password_hash)){
    await pool.query(`UPDATE public.sessions SET cashier_login_failures=cashier_login_failures+1,
     cashier_lock_until=CASE WHEN cashier_login_failures+1>=5 THEN now()+interval '15 minutes' ELSE cashier_lock_until END WHERE id=$1`,[req.cookies.sid]);
    throw new AppError(401,"Usuario o contraseña de caja incorrectos.");
  }
  const client=await pool.connect();let shiftId:number;
  try{
    await client.query("BEGIN");
    const current=(await client.query("SELECT business_mode FROM public.sessions WHERE id=$1 AND user_id=$2 FOR UPDATE",[req.cookies.sid,Number(user.id)])).rows[0];
    if(!current)throw new AppError(401,"La sesión terminó. Inicia sesión nuevamente.");
    if(current.business_mode==="cashier")throw new AppError(409,"Esta sesión ya tiene una caja abierta.");
    const existing=await client.query("SELECT id FROM public.cash_shifts WHERE business_id=$1 AND username=$2 AND closed_at IS NULL",[businessId,username]);
    if(existing.rowCount)throw new AppError(409,"Esta caja ya tiene un turno abierto. El administrador puede consultarlo y cerrarlo si quedó abandonado.");
    const created=await client.query("INSERT INTO public.cash_shifts(business_id,opened_by,username,shift) VALUES($1,$2,$3,$4) RETURNING id",[businessId,Number(user.id),username,credential.shift]);
    shiftId=created.rows[0].id;
    await client.query("UPDATE public.sessions SET business_mode='cashier',cash_shift_id=$1,cashier_login_failures=0,cashier_lock_until=NULL WHERE id=$2",[shiftId,req.cookies.sid]);
    await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");if((e as {code?:string}).code==="23505")throw new AppError(409,"Esta caja acaba de ser abierta en otra sesión.");throw e;}finally{client.release();}
  res.status(201).json(toShift(await ownShift(user,shiftId)));
});
router.get("/cashier/state",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio"],true);
  const shift=await activeCashShift(user);
  const [orders,couriers]=await Promise.all([
    pool.query(`${orderSelect} WHERE o.restaurant_id=$1 AND (o.status IN ('received','preparing','ready','on_the_way') OR o.cash_shift_id=$2) ORDER BY o.created_at DESC,o.id DESC`,[shift.business_id,shift.id]),
    pool.query("SELECT id,name FROM public.users WHERE active AND role='repartidor' ORDER BY name"),
  ]);
  res.setHeader("Cache-Control","no-store");
  res.json(GetCashierStateResponse.parse({shift:toShift(await ownShift(user,shift.id)),orders:orders.rows.map(toOrder),couriers:couriers.rows}));
});
router.post("/cashier/orders/:orderId/release",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio"],true);
  const orderId=id(req.params.orderId),data=ReleaseCashierOrderBody.parse(req.body);
  const courierId=data.courierId===null?null:id(data.courierId);
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const shift=await activeCashShift(user,client,true);
    const order=(await client.query("SELECT * FROM public.orders WHERE id=$1 AND restaurant_id=$2 FOR UPDATE",[orderId,shift.business_id])).rows[0];
    if(!order)throw new AppError(404,"El pedido no pertenece a esta caja.");
    if(!["received","preparing","ready"].includes(order.status))throw new AppError(409,"El pedido ya salió a reparto o fue finalizado.");
    if(order.delivery_partner_id&&order.delivery_partner_id!==courierId)throw new AppError(409,"El pedido ya tiene un repartidor. Solicita la reasignación al administrador del sistema.");
    if(courierId){
      const courier=await client.query("SELECT id FROM public.users WHERE id=$1 AND active AND role='repartidor' FOR SHARE",[courierId]);
      if(!courier.rowCount)throw new AppError(400,"Elige un repartidor habilitado.");
    }
    if(!(order.status==="ready"&&order.cash_shift_id&&order.delivery_partner_id===courierId)){
      await client.query("UPDATE public.orders SET status='ready',delivery_partner_id=$1,cash_shift_id=COALESCE(cash_shift_id,$2),updated_at=now() WHERE id=$3",[courierId,shift.id,orderId]);
      await client.query("INSERT INTO public.cash_order_events(shift_id,order_id,action,courier_id) VALUES($1,$2,$3,$4)",[shift.id,orderId,courierId?"assigned":"released",courierId]);
    }
    await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  res.json(GetOrderResponse.parse(toOrder(await visibleOrder(user,orderId))));
});
router.post("/cashier/close",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio"],true);
  const shift=await activeCashShift(user);
  const closed=await closeCashShift(user,shift.id);
  res.json(closed);
});
router.get("/business/cash-shifts",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio","administrador_sistema"]);
  const businessId=id(req.query.businessId);await ownsBusiness(user,businessId);
  const rows=await pool.query(`${shiftSelect} WHERE s.business_id=$1 ORDER BY s.opened_at DESC,s.id DESC`,[businessId]);
  res.setHeader("Cache-Control","no-store");res.json(ListBusinessCashShiftsResponse.parse({shifts:rows.rows.map(toShift)}));
});
router.get("/business/cash-shifts/:shiftId",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio","administrador_sistema"]);
  res.setHeader("Cache-Control","no-store");res.json(GetBusinessCashShiftResponse.parse(await cashShiftReport(user,id(req.params.shiftId))));
});
router.post("/business/cash-shifts/:shiftId/close",async(req,res)=>{
  const user=requireUser(req,["administrador_negocio","administrador_sistema"]);
  res.json(await closeCashShift(user,id(req.params.shiftId)));
});
export default router;
