import { Router, type IRouter } from "express";
import { VerifyCourierSoatBody, VerifyCourierSoatResponse } from "@workspace/api-zod";
import { courierSoat, SoatError } from "../lib/courier-soat";

const router: IRouter = Router();
router.post("/auth/courier-soat", async (req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = VerifyCourierSoatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Ingresa un correo y una placa válidos para consultar el SOAT." }); return; }
  try {
    res.json(VerifyCourierSoatResponse.parse(await courierSoat.lookup(parsed.data.email, parsed.data.plate, req.ip || "unknown")));
  } catch (error) {
    if (error instanceof SoatError) { res.status(error.status).json({ error: error.message }); return; }
    req.log.error("Courier SOAT verification failed");
    res.status(503).json({ error: "No se pudo verificar el SOAT. Inténtalo más tarde." });
  }
});
export default router;
