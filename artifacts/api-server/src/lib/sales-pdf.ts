import PDFDocument from "pdfkit";
import type { buildSalesReport } from "./sales";

type SalesReport = Awaited<ReturnType<typeof buildSalesReport>>;
type Cell = { text: string; width: number; align?: "left" | "right" };
const palette = { ink: "#30213E", muted: "#756C7D", purple: "#54258A", gold: "#E5AA40", light: "#F5F2F8", rule: "#E3DDE8" };
const money = (amount: number) => `S/ ${amount.toFixed(2)}`;
const date = (value: string) => new Date(value).toLocaleDateString("es-PE", {
  timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric",
});

/** Presentation only: amounts and the delivered-order criteria come from the shared report. */
export async function createSalesPdf(report: SalesReport): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4", margin: 44, bufferPages: true,
    info: { Title: "QUILLAYAA | Informe de ventas", Author: "QUILLAYAA", Subject: "Reporte operativo de pedidos entregados" },
  });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const left = 44;
  const width = doc.page.width - left * 2;
  const bottom = 752;
  let y = 0;
  const text = (value: string, x: number, top: number, size = 10, options: { width?: number; align?: "left" | "right"; bold?: boolean; color?: string } = {}) => {
    doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor(options.color ?? palette.ink);
    doc.text(value, x, top, { width: options.width ?? width, align: options.align ?? "left", lineGap: 2 });
  };
  const rule = (top: number, color = palette.rule) => {
    doc.moveTo(left, top).lineTo(left + width, top).lineWidth(0.6).strokeColor(color).stroke();
  };
  const height = (value: string, size: number, cellWidth: number, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    return doc.heightOfString(value, { width: cellWidth, lineGap: 2 });
  };
  const masthead = (continuation = false) => {
    text("QUILLAYAA", left, 40, 18, { bold: true, color: palette.purple });
    text("REPORTE OPERATIVO", left + width - 190, 45, 8, { width: 190, align: "right", color: palette.muted });
    rule(71, palette.gold);
    y = 94;
    if (continuation) {
      text("INFORME DE VENTAS · Continuación", left, y, 10, { bold: true });
      y += 29;
    }
  };
  const nextPage = () => { doc.addPage(); masthead(true); };
  const ensure = (needed: number) => { if (y + needed > bottom) nextPage(); };
  const section = (number: string, title: string, after = 0) => {
    ensure(32 + after);
    text(number, left, y + 1, 9, { bold: true, color: palette.purple, width: 25 });
    text(title, left + 28, y, 12, { bold: true, width: width - 28 });
    y += 30;
  };
  const table = (headers: Cell[], rows: string[][], total?: string[]) => {
    const header = () => {
      doc.rect(left, y, width, 27).fill(palette.purple);
      let x = left;
      for (const cell of headers) {
        text(cell.text, x + 8, y + 8, 8, { width: cell.width - 16, align: cell.align, bold: true, color: "#FFFFFF" });
        x += cell.width;
      }
      y += 27;
    };
    const rowHeight = (values: string[], bold: boolean) => Math.max(29, ...values.map((value, i) => height(value, 9, headers[i].width - 16, bold) + 16));
    ensure(27 + (rows.length ? rowHeight(rows[0], false) : 29) + (rows.length === 1 && total ? rowHeight(total, true) : 0));
    header();
    const renderRow = (values: string[], index: number, bold = false) => {
      const h = rowHeight(values, bold);
      // Repeat column labels on every continuation page.
      if (y + h > bottom) { nextPage(); header(); }
      if (bold || index % 2 === 0) doc.rect(left, y, width, h).fill(palette.light);
      let x = left;
      values.forEach((value, i) => {
        text(value, x + 8, y + 8, 9, { width: headers[i].width - 16, align: headers[i].align, bold });
        x += headers[i].width;
      });
      y += h;
      rule(y);
    };
    rows.forEach((values, index) => renderRow(values, index));
    if (total) renderRow(total, rows.length, true);
    y += 14;
  };

  masthead();
  text("INFORME DE VENTAS", left, y, 23, { bold: true });
  y += 33;
  const periodLabel = { day: "Diario", week: "Semanal", month: "Mensual" }[report.period];
  text(`${periodLabel} · Pedidos entregados`, left, y, 11, { color: palette.muted });
  y += 29;
  const lastDate = date(new Date(Date.parse(report.end) - 1).toISOString());
  text("PERIODO DEL INFORME", left, y, 8, { bold: true, color: palette.muted, width: 265 });
  text("FECHA DE EMISIÓN", left + 287, y, 8, { bold: true, color: palette.muted, width: width - 287 });
  y += 16;
  text(`${date(report.start)} al ${lastDate}`, left, y, 10, { width: 265 });
  const issued = new Date().toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short", hour12: false });
  text(`${issued} · Perú`, left + 287, y, 9, { width: width - 287 });
  y += 32;
  rule(y);
  y += 16;
  section("01", "Resumen general");
  const cardWidth = (width - 24) / 3;
  [
    ["VENTAS DE PRODUCTOS", report.totals.productSales],
    ["TARIFAS DE DELIVERY", report.totals.deliveryFees],
    ["IMPORTE TOTAL", report.totals.total],
  ].forEach(([label, amount], i) => {
    const x = left + i * (cardWidth + 12);
    doc.rect(x, y, cardWidth, 65).fill(i === 2 ? palette.purple : palette.light);
    const color = i === 2 ? "#FFFFFF" : palette.ink;
    text(String(label), x + 12, y + 12, 7.5, { width: cardWidth - 24, color });
    text(money(Number(amount)), x + 12, y + 31, 18, { width: cardWidth - 24, bold: true, color });
  });
  y += 75;
  text(`Pedidos entregados: ${report.totals.orders}     Unidades vendidas: ${report.totals.units}     Negocios incluidos: ${report.businesses.length}`, left, y, 9, { color: palette.muted });
  y += 28;

  const summaryColumns: Cell[] = [
    { text: "Negocio", width: width - 310 },
    { text: "Pedidos", width: 50, align: "right" },
    { text: "Productos", width: 90, align: "right" },
    { text: "Delivery", width: 80, align: "right" },
    { text: "Total", width: 90, align: "right" },
  ];
  section("02", "Resumen por negocio", 85);
  table(summaryColumns, report.businesses.map(b => [b.businessName, String(b.orders), money(b.productSales), money(b.deliveryFees), money(b.total)]),
    ["TOTAL GENERAL", String(report.totals.orders), money(report.totals.productSales), money(report.totals.deliveryFees), money(report.totals.total)]);

  if (report.businesses.length) {
    section("03", "Detalle de productos vendidos", 130);
    for (const business of report.businesses) {
      const titleHeight = height(business.businessName, 11, width, true);
      ensure(titleHeight + 125);
      text(business.businessName, left, y, 11, { bold: true });
      y += titleHeight + 6;
      text(`${business.orders} ${business.orders === 1 ? "pedido entregado" : "pedidos entregados"} · ${business.units} ${business.units === 1 ? "unidad vendida" : "unidades vendidas"}`, left, y, 9, { color: palette.muted });
      y += 24;
      if (!business.items.length) {
        text("Sin ventas de productos entregados en este periodo.", left, y, 10, { color: palette.muted });
        y += 35;
        continue;
      }
      table([
        { text: "Producto", width: width - 180 },
        { text: "Cantidad", width: 75, align: "right" },
        { text: "Importe", width: 105, align: "right" },
      ], business.items.map(item => [item.name, String(item.quantity), money(item.subtotal)]),
      ["TOTAL DE PRODUCTOS", String(business.units), money(business.productSales)]);
    }
  }

  const note = "Incluye únicamente pedidos entregados, según su fecha de entrega en la zona horaria America/Lima (Perú). Los pedidos cancelados y pendientes quedan excluidos. Las tarifas de delivery se presentan por separado de las ventas de productos.";
  const disclaimer = "Documento de control operativo. No constituye un comprobante de pago ni acredita transferencias o cobros bancarios verificados.";
  ensure(27 + height(note, 8.5, width) + height(disclaimer, 8.5, width) + 18);
  rule(y);
  y += 14;
  text("ALCANCE Y CONSIDERACIONES", left, y, 8, { bold: true, color: palette.purple });
  y += 19;
  text(note, left, y, 8.5, { color: palette.muted });
  y += height(note, 8.5, width) + 8;
  text(disclaimer, left, y, 8.5, { color: palette.muted });

  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    rule(776);
    doc.font("Helvetica").fontSize(8).fillColor(palette.muted);
    doc.text("QUILLAYAA · Informe de ventas", left, 788, { width: width - 110, lineBreak: false });
    doc.text(`Página ${i + 1} de ${pages.count}`, left + width - 110, 788, { width: 110, align: "right", lineBreak: false });
  }
  doc.end();
  return complete;
}
