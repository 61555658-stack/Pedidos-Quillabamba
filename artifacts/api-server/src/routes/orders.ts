import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { z } from "zod";
import {
  CreateOrderBody, CreateOrderResponse, GetOrderResponse, ListOrdersResponse,
  ListRestaurantsResponse, ListRestaurantProductsResponse, UpdateOrderStatusBody,
  UpdateCourierLocationBody, GetCourierLocationResponse,
} from "@workspace/api-zod";
import { AppError, requireUser, visibleOrder, visibleOrders, toOrder, ownsBusiness } from "../lib/operations-data";
import { isBusinessOpen } from "../lib/opening-hours";
import { ensureOrderVouchers } from "../lib/order-vouchers";
import { processVoucherEmails } from "../lib/voucher-email";

const router: IRouter = Router();
const validId = (value: unknown) => z.number().int().positive().parse(Number(value));
const cents = (n: number) => Math.round(n * 100);

router.get("/restaurants",async(_req,res)=>{
  const result=await pool.query(`SELECT r.id,r.name,r.cuisine,r.rating::float8 AS rating,r.delivery_minutes AS "deliveryMinutes",
    r.delivery_fee::float8 AS "deliveryFee",r.is_open AS "isOpen",r.opening_hours AS "openingHours",r.image,r.featured
    FROM public.restaurants r WHERE r.active AND (r.administrator_id IS NULL OR EXISTS(SELECT 1 FROM public.users u WHERE u.id=r.administrator_id AND u.active AND u.role='administrador_negocio')) ORDER BY r.id`);
  res.json(ListRestaurantsResponse.parse(result.rows.map(r=>({...r,isOpen:isBusinessOpen(r.isOpen,r.openingHours)}))));
});
router.get("/restaurants/:restaurantId/products",async(req,res)=>{
  const restaurantId=validId(req.params.restaurantId);
  const result=await pool.query(`SELECT p.id,p.restaurant_id AS "restaurantId",p.name,p.description,p.category,p.price::float8 AS price,p.image,p.popular
    FROM public.products p JOIN public.restaurants r ON r.id=p.restaurant_id
    WHERE r.id=$1 AND r.active AND p.active AND p.stock>0
    AND EXISTS(SELECT 1 FROM public.categories c WHERE c.restaurant_id=r.id AND c.name=p.category AND c.active)
    ORDER BY p.id`,[restaurantId]);
  res.json(ListRestaurantProductsResponse.parse(result.rows));
});
router.get("/orders",async(req,res)=>{
  const user=requireUser(req);
  res.json(ListOrdersResponse.parse(await visibleOrders(user)));
});
router.post("/orders",async(req,res)=>{
  const user=requireUser(req,["cliente"]);
  const data=CreateOrderBody.parse(req.body);
  if((!data.deliveryLocation&&!data.deliveryAddress?.trim()) || !data.items.length || data.items.length>100) throw new AppError(400,"Selecciona el punto de entrega y agrega productos al carrito.");
  const quantities=new Map<number,number>();
  for(const item of data.items) {
    if(!Number.isSafeInteger(item.id)||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>1000) throw new AppError(400,"Cantidad de producto inválida.");
    quantities.set(item.id,(quantities.get(item.id)||0)+item.quantity);
  }
  const client=await pool.connect();
  let orderId:number;
  try {
    await client.query("BEGIN");
    const result=await client.query(`SELECT p.*,r.name AS restaurant_name,r.delivery_fee,r.is_open,r.opening_hours,r.active AS restaurant_active,
      (r.administrator_id IS NULL OR EXISTS(SELECT 1 FROM public.users u WHERE u.id=r.administrator_id AND u.active AND u.role='administrador_negocio')) AS owner_active,
      EXISTS(SELECT 1 FROM public.categories c WHERE c.restaurant_id=r.id AND c.name=p.category AND c.active) AS category_active
      FROM public.products p JOIN public.restaurants r ON r.id=p.restaurant_id WHERE p.id=ANY($1::int[]) ORDER BY p.id FOR UPDATE OF p,r`,[[...quantities.keys()]]);
    if(result.rowCount!==quantities.size) throw new AppError(409,"Un producto ya no está disponible. Actualiza el carrito.");
    const restaurant=result.rows[0];
    let subtotal=0;
    const items=result.rows.map(p=>{
      const quantity=quantities.get(p.id)!;
      if(p.restaurant_id!==restaurant.restaurant_id) throw new AppError(400,"Cada pedido debe pertenecer a un solo negocio.");
      if(!p.active||!isBusinessOpen(p.is_open,p.opening_hours)||!p.restaurant_active||!p.owner_active||!p.category_active||p.stock<quantity) throw new AppError(409,`${p.name}: producto sin stock o negocio cerrado o no disponible.`);
      subtotal+=cents(Number(p.price))*quantity;
      return {id:p.id,name:p.name,price:Number(p.price),quantity};
    });
    const setting=await client.query("SELECT value FROM public.settings WHERE key='minimumOrder'");
    const minimum=Number(setting.rows[0]?.value||0);
    if(subtotal<cents(minimum)) throw new AppError(400,`El pedido mínimo de productos es S/ ${minimum.toFixed(2)}.`);
    const fee=cents(Number(restaurant.delivery_fee));
    if(cents(data.total)!==subtotal+fee) throw new AppError(409,"Los precios o el costo de delivery cambiaron. Actualiza el carrito antes de confirmar.");
    const deliveryAddress=data.deliveryLocation
      ? `Ubicación de entrega: ${data.deliveryLocation.latitude.toFixed(6)}, ${data.deliveryLocation.longitude.toFixed(6)}`
      : data.deliveryAddress.trim();
    const created=await client.query(`INSERT INTO public.orders(restaurant_id,restaurant_name,customer_id,customer_name,total,status,payment_method,delivery_address,items,delivery_fee,delivery_location)
      VALUES($1,$2,$3,$4,$5,'received',$6,$7,$8,$9,$10) RETURNING id`,
      [restaurant.restaurant_id,restaurant.restaurant_name,Number(user.id),user.firstName,(subtotal+fee)/100,data.paymentMethod,deliveryAddress,JSON.stringify(items),fee/100,data.deliveryLocation?JSON.stringify(data.deliveryLocation):null]);
    orderId=created.rows[0].id;
    for(const item of items) await client.query("UPDATE public.products SET stock=stock-$1,updated_at=now() WHERE id=$2",[item.quantity,item.id]);
    await ensureOrderVouchers(Number(user.id),orderId,true,client);
    await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  res.status(201).json(CreateOrderResponse.parse(toOrder(await visibleOrder(user,orderId),user.role)));
  void processVoucherEmails(orderId);
});
router.post("/orders/:orderId/claim",async(req,res)=>{
  const user=requireUser(req,["repartidor"]);
  const id=validId(req.params.orderId);
  const result=await pool.query(`UPDATE public.orders SET delivery_partner_id=$1,updated_at=now()
    WHERE id=$2 AND status='ready' AND (delivery_partner_id IS NULL OR delivery_partner_id=$1) RETURNING id`,[Number(user.id),id]);
  if(!result.rowCount) throw new AppError(409,"Otro repartidor tomó este pedido o aún no está listo para recoger.");
  res.json(GetOrderResponse.parse(toOrder(await visibleOrder(user,id),user.role)));
});
router.put("/orders/:orderId/assignment",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema"]);
  const id=validId(req.params.orderId);
  const {courierId}=z.object({courierId:z.number().int().positive().nullable()}).parse(req.body);
  if(courierId) {
    const courier=await pool.query("SELECT id FROM public.users WHERE id=$1 AND active AND role='repartidor'",[courierId]);
    if(!courier.rowCount) throw new AppError(400,"Selecciona un repartidor habilitado.");
  }
  const result=await pool.query("UPDATE public.orders SET delivery_partner_id=$1,current_location=NULL,updated_at=now() WHERE id=$2 AND status='ready' RETURNING id",[courierId,id]);
  if(!result.rowCount) throw new AppError(409,"Solo puedes asignar o reasignar pedidos listos para recoger.");
  res.json(GetOrderResponse.parse(toOrder(await visibleOrder(user,id),user.role)));
});
router.put("/orders/:orderId/location",async(req,res)=>{
  const user=requireUser(req,["repartidor"]);
  const id=validId(req.params.orderId);
  const location=UpdateCourierLocationBody.parse(req.body);
  const updatedAt=new Date().toISOString();
  const result=await pool.query(`UPDATE public.orders SET current_location=$1,updated_at=now()
    WHERE id=$2 AND delivery_partner_id=$3 AND status IN ('ready','on_the_way') RETURNING id`,[JSON.stringify({...location,updatedAt}),id,Number(user.id)]);
  if(!result.rowCount) throw new AppError(404,"Pedido no disponible para este repartidor.");
  res.json({saved:true,updatedAt});
});
router.get("/orders/:orderId/location",async(req,res)=>{
  const user=requireUser(req);
  const row=await visibleOrder(user,validId(req.params.orderId));
  res.setHeader("Cache-Control","private, no-store");
  if(!row.delivery_partner_id||!["ready","on_the_way"].includes(row.status)||!row.current_location||!Number.isFinite(Date.parse(row.current_location.updatedAt))||Date.now()-Date.parse(row.current_location.updatedAt)>120000) throw new AppError(404,"Ubicación todavía no disponible.");
  res.json(GetCourierLocationResponse.parse(row.current_location));
});
router.get("/orders/:orderId",async(req,res)=>{
  const user=requireUser(req);
  res.json(GetOrderResponse.parse(toOrder(await visibleOrder(user,validId(req.params.orderId)),user.role)));
});
router.patch("/orders/:orderId/status",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio","repartidor"]);
  const id=validId(req.params.orderId);
  const {status}=UpdateOrderStatusBody.parse(req.body);
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const result=await client.query("SELECT * FROM public.orders WHERE id=$1 FOR UPDATE",[id]);
    const row=result.rows[0];
    if(!row) throw new AppError(404,"Pedido no encontrado.");
    if(user.role==="administrador_negocio") await ownsBusiness(user,row.restaurant_id);
    if(user.role==="repartidor" && row.delivery_partner_id!==Number(user.id)) throw new AppError(403,"Este pedido no está asignado a tu cuenta.");
    const transitions:Record<string,string[]>={received:["preparing","cancelled"],preparing:["ready","cancelled"],ready:["on_the_way","cancelled"],on_the_way:[],delivered:[],cancelled:[]};
    if(!transitions[row.status]?.includes(status)) throw new AppError(409,"Ese cambio de estado no está permitido.");
    if(user.role==="repartidor" && status!=="on_the_way") throw new AppError(403,"El repartidor solo puede iniciar el reparto y confirmar la entrega con una foto.");
    if(user.role==="administrador_negocio" && status==="on_the_way") throw new AppError(403,"El repartidor debe iniciar el reparto con su ubicación.");
    if(status==="on_the_way" && (!row.delivery_partner_id || !row.current_location || Date.now()-Date.parse(row.current_location.updatedAt)>60000)) throw new AppError(409,"El repartidor debe compartir su ubicación precisa antes de iniciar el reparto.");
    await client.query("UPDATE public.orders SET status=$1,updated_at=now(),current_location=CASE WHEN $1='cancelled' THEN NULL ELSE current_location END WHERE id=$2",[status,id]);
    if(status==="cancelled") for(const item of row.items) await client.query("UPDATE public.products SET stock=stock+$1,updated_at=now() WHERE id=$2",[item.quantity,item.id]);
    await client.query("COMMIT");
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
  res.json(GetOrderResponse.parse(toOrder(await visibleOrder(user,id),user.role)));
});
router.put("/orders/:orderId/rating",async(req,res)=>{
  const user=requireUser(req,["cliente"]);
  const id=validId(req.params.orderId);
  const {rating}=z.object({rating:z.number().int().min(1).max(5)}).parse(req.body);
  const result=await pool.query("UPDATE public.orders SET rating=$1,updated_at=now() WHERE id=$2 AND customer_id=$3 AND status='delivered' RETURNING id",[rating,id,Number(user.id)]);
  if(!result.rowCount) throw new AppError(409,"Solo puedes calificar tus pedidos entregados.");
  res.json(GetOrderResponse.parse(toOrder(await visibleOrder(user,id),user.role)));
});
router.get("/dashboard/summary",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema"]);
  const {buildSalesReport,limaToday}=await import("../lib/sales");
  const [day,week,counts]=await Promise.all([
    buildSalesReport(user,{period:"day",date:limaToday()}),
    buildSalesReport(user,{period:"week",date:limaToday()}),
    pool.query(`SELECT (SELECT count(*)::int FROM public.orders WHERE status NOT IN ('delivered','cancelled')) AS active,
      (SELECT count(*)::int FROM public.restaurants WHERE active) AS restaurants,
      (SELECT count(*)::int FROM public.users WHERE role='repartidor' AND active) AS couriers`),
  ]);
  const daily=await pool.query(`SELECT to_char(delivered_at AT TIME ZONE 'America/Lima','YYYY-MM-DD') AS day,
    SUM(total-delivery_fee)::float8 AS total FROM public.orders WHERE status='delivered' AND delivered_at >= $1 AND delivered_at < $2 GROUP BY day`,[week.start,week.end]);
  const days=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const start=new Date(week.start);
  res.json({todaySales:day.totals.productSales,activeOrders:counts.rows[0].active,restaurants:counts.rows[0].restaurants,deliveryPartners:counts.rows[0].couriers,
    weeklySales:days.map((label,i)=>{const date=new Date(start.getTime()+i*86400000).toISOString().slice(0,10);return{day:label,total:daily.rows.find(d=>d.day===date)?.total||0};})});
});
export default router;
