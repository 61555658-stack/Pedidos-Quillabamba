import { Router, type IRouter } from "express";
import { GetSalesReportResponse } from "@workspace/api-zod";
import { requireUser } from "../lib/operations-data";
import { buildSalesReport } from "../lib/sales";
import { createSalesPdf } from "../lib/sales-pdf";

const router:IRouter=Router();
router.get("/reports/sales",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  res.json(GetSalesReportResponse.parse(await buildSalesReport(user,req.query)));
});
router.get("/reports/sales.pdf",async(req,res)=>{
  const user=requireUser(req,["administrador_sistema","administrador_negocio"]);
  const report=await buildSalesReport(user,req.query);
  const buffer=await createSalesPdf(report);
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`attachment; filename="ventas-${report.period}-${report.date}.pdf"`);
  res.setHeader("Cache-Control","private, no-store");
  res.send(buffer);
});
export default router;
