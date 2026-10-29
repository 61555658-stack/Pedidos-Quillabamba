import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { toVoucher } from "./order-vouchers";
import { createVoucherPdf, voucherDate, voucherPaymentLabels } from "./voucher-pdf";

let working = false;

/** Durable outbox, bounded retries and leases; mail/PDF failures never undo a purchase. */
export async function processVoucherEmails(orderId?: number, db: Pick<typeof pool, "query"> = pool) {
  if (working) return;
  working = true;
  try {
    const token = randomUUID();
    await db.query(
      `UPDATE public.order_vouchers SET email_status='failed',email_lease_until=NULL,email_lease_token=NULL
       WHERE email_status='sending' AND email_lease_until<now() AND email_attempts>=5
       AND ($1::integer IS NULL OR order_id=$1)`, [orderId ?? null],
    );
    const claimed = await db.query(
      `WITH jobs AS (
        SELECT order_id FROM public.order_vouchers
        WHERE ($2::integer IS NULL OR order_id=$2) AND email_attempts<5 AND (
          (email_status IN ('pending','failed') AND next_email_attempt_at<=now())
          OR (email_status='sending' AND email_lease_until<now()))
        ORDER BY issued_at FOR UPDATE SKIP LOCKED LIMIT 5
       )
       UPDATE public.order_vouchers v SET email_status='sending',email_attempts=email_attempts+1,
         email_lease_until=now()+interval '5 minutes',email_lease_token=$1
       FROM jobs WHERE v.order_id=jobs.order_id RETURNING v.*`, [token, orderId ?? null],
    );
    for (const row of claimed.rows) {
      try {
        const key = process.env.SENDGRID_API_KEY;
        const from = process.env.SENDGRID_FROM_EMAIL;
        if (!key || !from) throw new Error("Voucher mail configuration unavailable");
        const v = toVoucher(row);
        const pdf = await createVoucherPdf(v);
        const lines = v.items.map(i => `${i.quantity} x ${i.name} - S/ ${(i.price * i.quantity).toFixed(2)}`).join("\n");
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST", signal: AbortSignal.timeout(20_000),
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: v.customerEmail }] }],
            from: { email: from, name: "QUILLAYAA" }, subject: `Tu voucher ${v.number} - QUILLAYAA`,
            content: [{ type: "text/plain", value:
              `QUILLAYAA\nVOUCHER DE PEDIDO ${v.number}\nFecha: ${voucherDate(v.issuedAt)}\nNegocio: ${v.restaurantName}\nCliente: ${v.customerName}\n\n${lines}\n\nProductos: S/ ${v.subtotal.toFixed(2)}\nDelivery: S/ ${v.deliveryFee.toFixed(2)}\nTOTAL: S/ ${v.total.toFixed(2)}\nMetodo declarado: ${voucherPaymentLabels[v.paymentMethod]}\n\nPEDIDO CONFIRMADO - PAGO NO VERIFICADO\nEsta constancia no acredita pago ni es un comprobante fiscal.\nAdjuntamos tu voucher en PDF. Tambien puedes consultarlo en Mis vouchers dentro de QUILLAYAA.` }],
            attachments: [{ content: pdf.toString("base64"), type: "application/pdf", filename: `${v.number}.pdf`, disposition: "attachment" }],
          }),
        });
        if (!response.ok) throw new Error(`Voucher email provider returned HTTP ${response.status}`);
        await db.query(
          `UPDATE public.order_vouchers SET email_status='sent',email_sent_at=now(),
           next_email_attempt_at=NULL,email_lease_until=NULL,email_lease_token=NULL
           WHERE order_id=$1 AND email_lease_token=$2`, [row.order_id, token],
        );
      } catch {
        // Do not log customer details, provider bodies or credentials.
        logger.warn({ orderId: row.order_id }, "Voucher email attempt failed; PDF remains available");
        await db.query(
          `UPDATE public.order_vouchers SET email_status='failed',
           next_email_attempt_at=now()+make_interval(secs=>LEAST(3600,60*power(3,email_attempts-1)::int)),
           email_lease_until=NULL,email_lease_token=NULL WHERE order_id=$1 AND email_lease_token=$2`,
          [row.order_id, token],
        );
      }
    }
  } catch {
    logger.error("Voucher email worker failed; pending jobs remain in the database");
  } finally { working = false; }
}

export function startVoucherEmailWorker() {
  void processVoucherEmails();
  const timer = setInterval(() => { void processVoucherEmails(); }, 30_000);
  timer.unref();
}
