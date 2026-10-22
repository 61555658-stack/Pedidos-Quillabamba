import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { z } from "zod";
import { GetOperationsStateResponse } from "@workspace/api-zod";
import { AppError, requireUser, ownsBusiness, visibleOrders, businessSelect, productSelect, categorySelect } from "../lib/operations-data";
import { createPasswordHash } from "../lib/password";

const router: IRouter = Router();
const roles = ["cliente", "repartidor", "administrador_negocio", "administrador_sistema"] as const;
const text = z.string().trim().max(250);
const name = text.min(1);
const id = z.number().int().positive();
const image = z.string().max(2000).refine(v => v === "" || /^https?:\/\//.test(v) || /^\/api\/files\/[a-zA-Z0-9.-]+$/.test(v), "Usa una URL de imagen o un archivo subido.");
const userSchema = z.object({ name, email: text.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).transform(v => v.toLowerCase()), role: z.enum(roles), password: z.string().min(8).max(128), active: z.boolean(), phone: text, address: text }).strict();
const businessSchema = z.object({name, ruc: z.string().regex(/^(\d{11})?$/), address:text,phone:text,administratorId:id.nullable(),isOpen:z.boolean(),active:z.boolean(),cuisine:text,deliveryFee:z.number().finite().min(0).max(10000),image}).strict();
const productSchema = z.object({restaurantId:id,name,description:z.string().max(2000),category:name,price:z.number().finite().min(0).max(100000),stock:z.number().int().min(0).max(1000000),active:z.boolean(),image,popular:z.boolean()}).strict();
const categorySchema = z.object({restaurantId:id,name,active:z.boolean()}).strict();

router.get("/operations/state", async (req,res) => {
  const user = requireUser(req, ["administrador_sistema","administrador_negocio"]);
  const admin = user.role === "administrador_sistema";
  const args = admin ? [] : [Number(user.id)];
  const [users,businesses,products,categories,orders,settings] = await Promise.all([
    admin ? pool.query("SELECT id,name,email,role,active,COALESCE(phone,'') AS phone,COALESCE(address,'') AS address FROM public.users ORDER BY id") : Promise.resolve({rows:[]}),
    pool.query(`${businessSelect} ${admin ? "" : "WHERE r.administrator_id=$1 AND r.active"} ORDER BY r.id`,args),
    pool.query(`${productSelect} JOIN public.restaurants r ON r.id=p.restaurant_id ${admin ? "" : "WHERE r.administrator_id=$1 AND r.active"} ORDER BY p.id`,args),
    pool.query(`${categorySelect} JOIN public.restaurants r ON r.id=c.restaurant_id ${admin ? "" : "WHERE r.administrator_id=$1 AND r.active"} ORDER BY c.id`,args),
    visibleOrders(user),
    pool.query("SELECT key,value FROM public.settings WHERE key IN ('platformName','minimumOrder')"),
  ]);
  res.json(GetOperationsStateResponse.parse({users:users.rows,businesses:businesses.rows,products:products.rows,categories:categories.rows,orders,
    settings:{platformName:"QUILLAYAA",minimumOrder:"0",...Object.fromEntries(settings.rows.map(r=>[r.key,r.value]))}}));
});

router.patch("/operations/settings", async (req,res) => {
  requireUser(req, ["administrador_sistema"]);
  const data = z.object({platformName:name,minimumOrder:z.string().refine(v=>v.trim()!=="" && Number.isFinite(Number(v)) && Number(v)>=0 && Number(v)<=100000)}).strict().parse(req.body);
  await pool.query("INSERT INTO public.settings(key,value) VALUES ('platformName',$1),('minimumOrder',$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()",[data.platformName,data.minimumOrder]);
  res.json({success:true});
});

router.post("/operations/users", async (req,res) => {
  requireUser(req, ["administrador_sistema"]);
  const data = userSchema.partial({active:true,phone:true,address:true}).parse(req.body);
  const inserted = await pool.query("INSERT INTO public.users(name,email,password_hash,role,active,phone,address) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [data.name,data.email,createPasswordHash(data.password),data.role,data.active ?? true,data.phone || "",data.address || ""]);
  res.status(201).json(inserted.rows[0]);
});
router.patch("/operations/users/:id", async (req,res) => {
  const actor = requireUser(req, ["administrador_sistema"]);
  const userId = id.parse(Number(req.params.id));
  const data = userSchema.partial().parse(req.body);
  if (actor.id === String(userId) && (data.active === false || data.role && data.role !== "administrador_sistema")) throw new AppError(409,"No puedes bloquear ni quitar los permisos de tu propia cuenta.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT id,role FROM public.users WHERE id=$1 FOR UPDATE",[userId]);
    if(!found.rowCount) throw new AppError(404,"Usuario no encontrado.");
    if(data.role && data.role !== "administrador_negocio") {
      const assigned = await client.query("SELECT id FROM public.restaurants WHERE administrator_id=$1",[userId]);
      if(assigned.rowCount) throw new AppError(409,"Reasigna los negocios antes de cambiar el rol de su administrador.");
    }
    if(data.role && data.role !== "repartidor" || data.active === false) {
      const deliveries = await client.query("SELECT id FROM public.orders WHERE delivery_partner_id=$1 AND status NOT IN ('delivered','cancelled')",[userId]);
      if(deliveries.rowCount) throw new AppError(409,"Reasigna los pedidos activos antes de deshabilitar al repartidor o cambiar su rol.");
    }
    const cols: Record<string,string>={name:"name",email:"email",role:"role",active:"active",phone:"phone",address:"address",password:"password_hash"};
    const fields=Object.entries(data);
    if(!fields.length) throw new AppError(400,"No hay cambios para guardar.");
    await client.query(`UPDATE public.users SET ${fields.map(([k],i)=>`${cols[k]}=$${i+1}`).join(",")},updated_at=now() WHERE id=$${fields.length+1}`,[...fields.map(([k,v])=>k==="password"?createPasswordHash(String(v)):v),userId]);
    if(data.password || data.role || data.active === false) await client.query("DELETE FROM public.sessions WHERE user_id=$1",[userId]);
    await client.query("COMMIT");
    res.json({success:true});
  } catch(e) {await client.query("ROLLBACK"); throw e;} finally{client.release();}
});

router.post("/operations/businesses", async(req,res)=>{
  requireUser(req,["administrador_sistema"]);
  const d=businessSchema.partial({ruc:true,address:true,phone:true,administratorId:true,isOpen:true,active:true,cuisine:true,deliveryFee:true,image:true}).parse(req.body);
  if(d.administratorId) await assertBusinessAdmin(d.administratorId);
  const result=await pool.query("INSERT INTO public.restaurants(name,ruc,address,phone,administrator_id,is_open,active,cuisine,delivery_fee,image,rating,delivery_minutes,featured) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,30,false) RETURNING id",[d.name,d.ruc||"",d.address||"",d.phone||"",d.administratorId??null,d.isOpen??true,d.active??true,d.cuisine||"",d.deliveryFee??0,d.image||""]);
  res.status(201).json(result.rows[0]);
});
async function assertBusinessAdmin(userId:number) {
  const result=await pool.query("SELECT id FROM public.users WHERE id=$1 AND role='administrador_negocio' AND active",[userId]);
  if(!result.rowCount) throw new AppError(400,"Selecciona un administrador de negocio aprobado y habilitado.");
}
router.patch("/operations/businesses/:id", async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const businessId=id.parse(Number(req.params.id));
  await ownsBusiness(user,businessId);
  const d=businessSchema.partial().parse(req.body);
  if(user.role!=="administrador_sistema" && ("administratorId" in d || "active" in d)) throw new AppError(403,"Solo el administrador del sistema asigna o habilita negocios.");
  if(d.administratorId) await assertBusinessAdmin(d.administratorId);
  const cols:Record<string,string>={name:"name",ruc:"ruc",address:"address",phone:"phone",administratorId:"administrator_id",isOpen:"is_open",active:"active",cuisine:"cuisine",deliveryFee:"delivery_fee",image:"image"};
  const fields=Object.entries(d);
  if(!fields.length) throw new AppError(400,"No hay cambios para guardar.");
  await pool.query(`UPDATE public.restaurants SET ${fields.map(([k],i)=>`${cols[k]}=$${i+1}`).join(",")} WHERE id=$${fields.length+1}`,[...fields.map(([,v])=>v),businessId]);
  res.json({success:true});
});

router.post("/operations/products",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const d=productSchema.partial({description:true,image:true,popular:true,active:true}).parse(req.body);
  await ownsBusiness(user,d.restaurantId);
  await assertCategory(d.restaurantId,d.category);
  const result=await pool.query("INSERT INTO public.products(restaurant_id,name,description,category,price,stock,active,image,popular) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",[d.restaurantId,d.name,d.description||"",d.category,d.price,d.stock,d.active??true,d.image||"",d.popular??false]);
  res.status(201).json(result.rows[0]);
});
async function assertCategory(restaurantId:number,category:string){
  const result=await pool.query("SELECT id FROM public.categories WHERE restaurant_id=$1 AND name=$2 AND active",[restaurantId,category]);
  if(!result.rowCount) throw new AppError(400,"Selecciona una categoría activa de este negocio.");
}
router.patch("/operations/products/:id",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const productId=id.parse(Number(req.params.id));
  const d=productSchema.partial().parse(req.body);
  const found=await pool.query("SELECT restaurant_id,category FROM public.products WHERE id=$1",[productId]);
  if(!found.rowCount) throw new AppError(404,"Producto no encontrado.");
  const restaurantId=found.rows[0].restaurant_id;
  await ownsBusiness(user,restaurantId);
  if(d.restaurantId && d.restaurantId!==restaurantId) throw new AppError(400,"No se puede trasladar un producto a otro negocio.");
  if(d.category || d.active===true) await assertCategory(restaurantId,d.category||found.rows[0].category);
  const cols:Record<string,string>={restaurantId:"restaurant_id",name:"name",description:"description",category:"category",price:"price",stock:"stock",active:"active",image:"image",popular:"popular"};
  const fields=Object.entries(d);
  if(!fields.length) throw new AppError(400,"No hay cambios para guardar.");
  await pool.query(`UPDATE public.products SET ${fields.map(([k],i)=>`${cols[k]}=$${i+1}`).join(",")},updated_at=now() WHERE id=$${fields.length+1}`,[...fields.map(([,v])=>v),productId]);
  res.json({success:true});
});
router.delete("/operations/products/:id",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const productId=id.parse(Number(req.params.id));
  const result=await pool.query("SELECT restaurant_id FROM public.products WHERE id=$1",[productId]);
  if(!result.rowCount) throw new AppError(404,"Producto no encontrado.");
  await ownsBusiness(user,result.rows[0].restaurant_id);
  await pool.query("DELETE FROM public.products WHERE id=$1",[productId]);
  res.json({success:true});
});
router.post("/operations/categories",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const d=categorySchema.partial({active:true}).parse(req.body);
  await ownsBusiness(user,d.restaurantId);
  const result=await pool.query("INSERT INTO public.categories(name,restaurant_id,active) VALUES($1,$2,$3) RETURNING id",[d.name,d.restaurantId,d.active??true]);
  res.status(201).json(result.rows[0]);
});
router.patch("/operations/categories/:id",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const categoryId=id.parse(Number(req.params.id));
  const d=categorySchema.partial().parse(req.body);
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const result=await client.query("SELECT restaurant_id,name FROM public.categories WHERE id=$1 FOR UPDATE",[categoryId]);
    if(!result.rowCount) throw new AppError(404,"Categoría no encontrada.");
    const c=result.rows[0]; await ownsBusiness(user,c.restaurant_id);
    if(d.restaurantId && d.restaurantId!==c.restaurant_id) throw new AppError(400,"No puedes mover categorías entre negocios.");
    await client.query("UPDATE public.categories SET name=$1,active=COALESCE($2,active) WHERE id=$3",[d.name??c.name,d.active??null,categoryId]);
    if(d.name) await client.query("UPDATE public.products SET category=$1 WHERE restaurant_id=$2 AND category=$3",[d.name,c.restaurant_id,c.name]);
    await client.query("COMMIT");res.json({success:true});
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
});
router.delete("/operations/categories/:id",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const categoryId=id.parse(Number(req.params.id));
  const c=await pool.query("SELECT restaurant_id,name FROM public.categories WHERE id=$1",[categoryId]);
  if(!c.rowCount) throw new AppError(404,"Categoría no encontrada.");
  await ownsBusiness(user,c.rows[0].restaurant_id);
  const used=await pool.query("SELECT id FROM public.products WHERE restaurant_id=$1 AND category=$2",[c.rows[0].restaurant_id,c.rows[0].name]);
  if(used.rowCount) throw new AppError(409,"No se puede eliminar una categoría con productos.");
  await pool.query("DELETE FROM public.categories WHERE id=$1",[categoryId]);res.json({success:true});
});

export default router;
