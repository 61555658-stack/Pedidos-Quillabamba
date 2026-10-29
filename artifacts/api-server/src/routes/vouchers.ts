import { Router, type IRouter } from "express";
import { z } from "zod";
import { pool } from "@workspace/db";
import { ListMyVouchersResponse } from "@workspace/api-zod";
import { AppError, requireUser } from "../lib/operations-data";
import { ensureOrderVouchers, ownVoucher, toVoucher } from "../lib/order-vouchers";
import { createVoucherPdf } from "../lib/voucher-pdf";
import { processVoucherEmails } from "../lib/voucher-email";

const router: IRouter = Router();
const id = (value: unknown) => z.coerce.number().int().positive().parse(value);
router.use("/vouchers", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
router.get("/vouchers", async (req, res) => {
  const user = requireUser(req, ["cliente"]);
  await ensureOrderVouchers(Number(user.id));
  const result = await pool.query("SELECT * FROM public.order_vouchers WHERE customer_id=$1 ORDER BY issued_at DESC,order_id DESC", [Number(user.id)]);
  res.json(ListMyVouchersResponse.parse(result.rows.map(toVoucher)));
});
router.get("/vouchers/:orderId", async (req, res) => {
  const user = requireUser(req, ["cliente"]);
  res.json(toVoucher(await ownVoucher(Number(user.id), id(req.params.orderId))));
});
router.get("/vouchers/:orderId/pdf", async (req, res) => {
  const user = requireUser(req, ["cliente"]);
  const voucher = toVoucher(await ownVoucher(Number(user.id), id(req.params.orderId)));
  const pdf = await createVoucherPdf(voucher);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${voucher.number}.pdf"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(pdf);
});
router.post("/vouchers/:orderId/email", async (req, res) => {
  const user = requireUser(req, ["cliente"]);
  const orderId = id(req.params.orderId);
  await ownVoucher(Number(user.id), orderId);
  const result = await pool.query(
    `UPDATE public.order_vouchers SET email_status='pending',email_attempts=0,next_email_attempt_at=now(),last_email_requested_at=now()
     WHERE order_id=$1 AND customer_id=$2 AND email_status<>'sending'
       AND (last_email_requested_at IS NULL OR last_email_requested_at<now()-interval '60 seconds') RETURNING *`,
    [orderId, Number(user.id)],
  );
  if (!result.rows[0]) throw new AppError(429, "Espera un minuto antes de solicitar otro envío.");
  res.json(toVoucher(result.rows[0]));
  void processVoucherEmails(orderId);
});
export default router;
