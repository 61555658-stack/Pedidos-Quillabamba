import { pool } from "@workspace/db";
import { z } from "zod";
import type { AppUser } from "../middlewares/appAuthMiddleware";
import { AppError } from "./operations-data";

export function limaToday() {return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Lima",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
const querySchema=z.object({
  period:z.enum(["day","week","month"]).default("day"),
  date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(limaToday),
  businessId:z.coerce.number().int().positive().optional(),
});
export async function buildSalesReport(user:AppUser,query:unknown) {
  const q=querySchema.parse(query);
  const anchor=new Date(`${q.date}T00:00:00.000-05:00`);
  if(!Number.isFinite(anchor.getTime())||anchor.toISOString().slice(0,10)!==q.date) throw new AppError(400,"Selecciona una fecha válida.");
  // UTC is used only for arithmetic on Lima calendar dates (Peru has no DST).
  const calendar=new Date(`${q.date}T00:00:00Z`);
  if(q.period==="week") calendar.setUTCDate(calendar.getUTCDate()-(calendar.getUTCDay()+6)%7);
  if(q.period==="month") calendar.setUTCDate(1);
  const start=new Date(`${calendar.toISOString().slice(0,10)}T00:00:00-05:00`);
  const endCalendar=new Date(calendar);
  if(q.period==="month") endCalendar.setUTCMonth(endCalendar.getUTCMonth()+1);
  else endCalendar.setUTCDate(endCalendar.getUTCDate()+(q.period==="week"?7:1));
  const end=new Date(`${endCalendar.toISOString().slice(0,10)}T00:00:00-05:00`);
  const businesses=await pool.query(`SELECT id,name FROM public.restaurants WHERE ($1='administrador_sistema' OR (administrator_id=$2 AND active)) AND ($3::int IS NULL OR id=$3) ORDER BY name`,[user.role,Number(user.id),q.businessId??null]);
  if(q.businessId&&!businesses.rowCount) throw new AppError(403,"No tienes acceso al negocio seleccionado.");
  const orders=await pool.query("SELECT restaurant_id,total,delivery_fee,items FROM public.orders WHERE status='delivered' AND delivered_at >= $1 AND delivered_at < $2 AND restaurant_id=ANY($3::int[])",[start,end,businesses.rows.map(b=>b.id)]);
  const cents=(value:number)=>Math.round(value*100);
  const rows=businesses.rows.map(b=>{
    const matching=orders.rows.filter(o=>o.restaurant_id===b.id);
    const items=new Map<string,{productId:number;name:string;quantity:number;subtotal:number}>();
    let fees=0,productTotal=0,units=0;
    for(const o of matching){
      fees+=cents(Number(o.delivery_fee));
      for(const i of o.items){
        const key=JSON.stringify([i.id,i.name]);
        const item=items.get(key)||{productId:i.id,name:i.name,quantity:0,subtotal:0};
        item.quantity+=i.quantity;item.subtotal+=cents(i.price)*i.quantity;
        units+=i.quantity;productTotal+=cents(i.price)*i.quantity;items.set(key,item);
      }
    }
    return {businessId:b.id,businessName:b.name,orders:matching.length,units,productSales:productTotal/100,deliveryFees:fees/100,total:(productTotal+fees)/100,items:[...items.values()].map(i=>({...i,subtotal:i.subtotal/100}))};
  });
  const totals={orders:0,units:0,productSales:0,deliveryFees:0,total:0};
  for(const row of rows)for(const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key]+=row[key];
  for(const key of ["productSales","deliveryFees","total"] as const) totals[key]=Math.round(totals[key]*100)/100;
  return {period:q.period,date:q.date,start:start.toISOString(),end:end.toISOString(),businesses:rows,totals};
}
