import { Router, type IRouter } from "express";
import PDFDocument from "pdfkit";
import { GetSalesReportResponse } from "@workspace/api-zod";
import { requireUser } from "../lib/operations-data";
import { buildSalesReport } from "../lib/sales";

const router:IRouter=Router();
router.get("/reports/sales",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  res.json(GetSalesReportResponse.parse(await buildSalesReport(user,req.query)));
});
router.get("/reports/sales.pdf",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const report=await buildSalesReport(user,req.query);
  const doc=new PDFDocument({size:"A4",margin:45,bufferPages:true});
  const chunks:Buffer[]=[];
  const complete=new Promise<Buffer>((resolve,reject)=>{doc.on("data",chunk=>chunks.push(chunk));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  const money=(n:number)=>`S/ ${n.toFixed(2)}`;
  const line=(text:string,size=10)=>{
    doc.fontSize(size);
    if(doc.y+doc.heightOfString(text,{width:505})>765)doc.addPage();
    doc.text(text,{width:505}).moveDown(0.45);
  };
  line("QUILLAYAA - Informe de ventas",20);
  line(`Periodo: ${{day:"Día",week:"Semana",month:"Mes"}[report.period]} | Fecha de referencia: ${report.date}`);
  const format=(value:string)=>new Date(value).toLocaleDateString("es-PE",{timeZone:"America/Lima"});
  line(`Desde ${format(report.start)} hasta ${format(new Date(Date.parse(report.end)-1).toISOString())}. Zona horaria: America/Lima.`);
  line("Solo pedidos entregados, según fecha de entrega. Cancelados y pendientes no incluidos.");
  line(`Ventas de productos: ${money(report.totals.productSales)} | Delivery: ${money(report.totals.deliveryFees)}`,12);
  line(`Total de pedidos: ${money(report.totals.total)} | Pedidos: ${report.totals.orders} | Unidades: ${report.totals.units}`,12);
  line("Este informe acredita pedidos entregados; no verifica transferencias ni cobros bancarios.");
  for(const b of report.businesses){
    doc.moveDown();line(b.businessName,15);
    line(`Pedidos: ${b.orders} | Productos: ${money(b.productSales)} | Delivery: ${money(b.deliveryFees)} | Total: ${money(b.total)}`);
    if(!b.items.length)line("Sin ventas entregadas en este periodo.");
    for(const i of b.items)line(`${i.name} | Cantidad: ${i.quantity} | Importe: ${money(i.subtotal)}`);
  }
  const pages=doc.bufferedPageRange();
  for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.fontSize(8).text(`QUILLAYAA | ${i+1} / ${pages.count}`,45,790,{lineBreak:false});}
  doc.end();
  const buffer=await complete;
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`attachment; filename="ventas-${report.period}-${report.date}.pdf"`);
  res.setHeader("Cache-Control","private, no-store");
  res.send(buffer);
});
export default router;
