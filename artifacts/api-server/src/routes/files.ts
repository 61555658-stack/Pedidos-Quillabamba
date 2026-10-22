import { Router, type IRouter } from "express";
import multer from "multer";
import { pool } from "@workspace/db";
import { AppError, requireUser, visibleOrder, toOrder } from "../lib/operations-data";
import { storeImage, storageFile } from "../lib/file-storage";
import { GetOrderResponse } from "@workspace/api-zod";

const router:IRouter=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}});
router.post("/files",(req,_res,next)=>{requireUser(req,["administrador_sistema","administrador_negocio"]);next();},upload.single("file"),async(req,res)=>{
  if(!req.file)throw new AppError(400,"Selecciona una imagen.");
  const key=await storeImage(req.file,"products");
  res.status(201).json({path:`/api/files/${key.split("/")[1]}`});
});
router.get("/files/:file",async(req,res)=>{
  const name=String(req.params.file);
  if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name))throw new AppError(404,"Archivo no encontrado.");
  const file=storageFile(`products/${name}`);
  const [exists]=await file.exists();
  if(!exists)throw new AppError(404,"Archivo no encontrado.");
  const [metadata]=await file.getMetadata();
  res.setHeader("Content-Type",metadata.contentType||"application/octet-stream");
  res.setHeader("Cache-Control","public,max-age=3600");
  res.setHeader("X-Content-Type-Options","nosniff");
  file.createReadStream().on("error",e=>{req.log.error({err:e},"Image read failed");res.destroy();}).pipe(res);
});
router.post("/orders/:orderId/proof",(req,_res,next)=>{requireUser(req,["repartidor"]);next();},upload.single("file"),async(req,res)=>{
  const user=requireUser(req,["repartidor"]);
  const id=Number(req.params.orderId);
  if(!Number.isSafeInteger(id)||id<=0)throw new AppError(400,"Pedido inválido.");
  const row=await visibleOrder(user,id);
  if(row.status!=="on_the_way")throw new AppError(409,"El pedido debe estar en camino antes de confirmar la entrega.");
  if(!req.file)throw new AppError(400,"Toma o selecciona una foto de la entrega.");
  const key=await storeImage(req.file,"proofs");
  try {
    const updated=await pool.query(`UPDATE public.orders SET status='delivered',delivered_at=now(),proof_path=$1,current_location=NULL,updated_at=now()
      WHERE id=$2 AND status='on_the_way' AND delivery_partner_id=$3 RETURNING id`,[key,id,Number(user.id)]);
    if(!updated.rowCount)throw new AppError(409,"El pedido ya fue actualizado. Recarga la lista.");
  }catch(e){await storageFile(key).delete().catch(()=>undefined);throw e;}
  res.json(GetOrderResponse.parse(toOrder(await visibleOrder(user,id))));
});
router.get("/orders/:orderId/proof",async(req,res)=>{
  const user=requireUser(req);
  const id=Number(req.params.orderId);
  if(!Number.isSafeInteger(id)||id<=0)throw new AppError(400,"Pedido inválido.");
  const row=await visibleOrder(user,id);
  if(!row.proof_path)throw new AppError(404,"El pedido aún no tiene comprobante.");
  const file=storageFile(row.proof_path);
  const [metadata]=await file.getMetadata();
  res.setHeader("Content-Type",metadata.contentType||"image/jpeg");
  res.setHeader("Cache-Control","private,no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  file.createReadStream().on("error",e=>{req.log.error({err:e},"Proof read failed");res.destroy();}).pipe(res);
});
export default router;
