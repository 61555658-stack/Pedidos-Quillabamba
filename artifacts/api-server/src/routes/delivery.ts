import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, ordersTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
const deliveryOnly = requireAuth(["repartidor"]);

router.get("/delivery/orders", deliveryOnly, async (req, res) => {
  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.deliveryPartnerId, req.user!.id))
    .orderBy(desc(ordersTable.createdAt));
  res.json(orders.map((order) => ({ ...order, total: Number(order.total) })));
});

router.patch("/delivery/orders/:id/status", deliveryOnly, async (req, res): Promise<void> => {
  const allowedStatuses = ["on_the_way", "delivered", "cancelled"];
  const status = req.body?.status;
  if (!allowedStatuses.includes(status)) {
    res.status(400).json({ error: "Estado no válido para un repartidor." });
    return;
  }
  const [currentOrder] = await db.select().from(ordersTable)
    .where(eq(ordersTable.id, Number(req.params.id))).limit(1);
  if (!currentOrder || currentOrder.deliveryPartnerId !== req.user!.id) {
    res.status(403).json({ error: "Este pedido no está asignado a tu cuenta." });
    return;
  }
  const [order] = await db.update(ordersTable).set({ status, updatedAt: new Date() })
    .where(eq(ordersTable.id, Number(req.params.id))).returning();
  res.json({ ...order, total: Number(order.total) });
});

export default router;