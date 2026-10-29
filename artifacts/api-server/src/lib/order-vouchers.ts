import { pool } from "@workspace/db";
import { AppError } from "./operations-data";
import { GetMyVoucherResponse } from "@workspace/api-zod";

// Copy authoritative purchase data once. Old orders get vouchers without unsolicited emails.
export async function ensureOrderVouchers(customerId: number, orderId?: number, queueEmail = false, client: Pick<typeof pool, "query"> = pool) {
  await client.query(
    `INSERT INTO public.order_vouchers(order_id,customer_id,number,issued_at,snapshot,email_status,next_email_attempt_at,last_email_requested_at)
     SELECT o.id,o.customer_id,'QY-'||to_char(o.created_at AT TIME ZONE 'America/Lima','YYYY')||'-'||lpad(o.id::text,GREATEST(6,length(o.id::text)),'0'),
       o.created_at,jsonb_build_object('customerName',o.customer_name,'customerEmail',u.email,
         'restaurantName',o.restaurant_name,'items',o.items,'subtotal',round((o.total-o.delivery_fee)::numeric,2),
         'deliveryFee',o.delivery_fee,'total',o.total,'paymentMethod',o.payment_method),
       CASE WHEN $3 THEN 'pending' ELSE 'not_requested' END,
       CASE WHEN $3 THEN now() ELSE NULL END,CASE WHEN $3 THEN now() ELSE NULL END
     FROM public.orders o JOIN public.users u ON u.id=o.customer_id
     WHERE o.customer_id=$1 AND ($2::integer IS NULL OR o.id=$2)
     ON CONFLICT(order_id) DO NOTHING`,
    [customerId, orderId ?? null, queueEmail],
  );
}

export function toVoucher(row: Record<string, any>) {
  return GetMyVoucherResponse.parse({
    ...row.snapshot, orderId: row.order_id, number: row.number,
    issuedAt: new Date(row.issued_at).toISOString(),
    subtotal: Number(row.snapshot.subtotal), deliveryFee: Number(row.snapshot.deliveryFee), total: Number(row.snapshot.total),
    emailStatus: row.email_status, pdfUrl: `/api/vouchers/${row.order_id}/pdf`,
  });
}

export async function ownVoucher(customerId: number, orderId: number) {
  await ensureOrderVouchers(customerId, orderId);
  const result = await pool.query("SELECT * FROM public.order_vouchers WHERE order_id=$1 AND customer_id=$2", [orderId, customerId]);
  if (!result.rows[0]) throw new AppError(404, "Voucher no encontrado.");
  return result.rows[0];
}
