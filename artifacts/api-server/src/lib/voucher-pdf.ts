import PDFDocument from "pdfkit";
import type { OrderVoucher } from "@workspace/api-zod";

export const voucherPaymentLabels = { cash: "Efectivo", yape: "Yape", card: "Tarjeta" };
const amount = (n: number) => `S/ ${n.toFixed(2)}`;
export const voucherDate = (iso: string) => new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" });

export async function createVoucherPdf(v: OrderVoucher): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [300, 760], margin: 22, bufferPages: true,
    info: { Title: `QUILLAYAA - ${v.number}`, Author: "QUILLAYAA", Subject: "Constancia de pedido; no acredita pago" },
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const text = (value: string, bold = false, center = false, size = 10) => {
    doc.font(bold ? "Courier-Bold" : "Courier").fontSize(size).fillColor("#111111")
      .text(value, { width: 256, align: center ? "center" : "left", lineGap: 3 });
  };
  const rule = () => { doc.moveDown(0.5); text("------------------------------------------", false, true); doc.moveDown(0.3); };
  text("QUILLAYAA", true, true, 19);
  text("VOUCHER DE PEDIDO", true, true, 12);
  text("Quillabamba - Cusco", false, true, 9);
  rule();
  text(v.number, true, true, 12);
  doc.moveDown(0.6);
  text(`Fecha: ${voucherDate(v.issuedAt)}`);
  text(`Pedido: #${v.orderId}`);
  text(`Negocio: ${v.restaurantName}`);
  text(`Cliente: ${v.customerName}`);
  text(`Correo: ${v.customerEmail}`, false, false, 9);
  text(`Metodo declarado: ${voucherPaymentLabels[v.paymentMethod]}`);
  rule();
  text("DETALLE DE LA COMPRA", true, true);
  doc.moveDown(0.5);
  for (const item of v.items) {
    text(`${item.quantity} x ${item.name}`, true);
    text(`${amount(item.price)} c/u    ${amount(Math.round(item.price * item.quantity * 100) / 100)}`);
    doc.moveDown(0.5);
  }
  rule();
  text(`Productos: ${amount(v.subtotal)}`);
  text(`Delivery:  ${amount(v.deliveryFee)}`);
  doc.moveDown(0.5);
  text(`TOTAL: ${amount(v.total)}`, true, false, 15);
  rule();
  text("PEDIDO CONFIRMADO", true, true, 11);
  text("PAGO NO VERIFICADO", true, true, 10);
  doc.moveDown(0.7);
  text("Esta constancia confirma el pedido. No acredita pago ni es un comprobante fiscal.", false, true, 9);
  doc.moveDown(0.7);
  text("Gracias por comprar en QUILLAYAA", false, true, 9);
  doc.end();
  return completed;
}
