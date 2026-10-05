import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, ordersTable, productsTable, restaurantsTable, usersTable } from "@workspace/db";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetDashboardSummaryResponse,
  GetOrderParams,
  GetOrderResponse,
  ListOrdersResponse,
  ListRestaurantProductsParams,
  ListRestaurantProductsResponse,
  ListRestaurantsResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
  UpdateOrderStatusResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/restaurants", async (_req, res) => {
  const restaurants = await db.select().from(restaurantsTable);
  res.json(ListRestaurantsResponse.parse(restaurants.map((restaurant) => ({
    ...restaurant,
    rating: Number(restaurant.rating),
    deliveryFee: Number(restaurant.deliveryFee),
  }))));
});

router.get("/restaurants/:restaurantId/products", async (req, res) => {
  const params = ListRestaurantProductsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const products = await db.select().from(productsTable)
    .where(and(eq(productsTable.restaurantId, params.data.restaurantId), eq(productsTable.active, true)));
  res.json(ListRestaurantProductsResponse.parse(products.map((product) => ({
    ...product,
    price: Number(product.price),
  }))));
});

function toApiOrder(order: typeof ordersTable.$inferSelect) {
  return {
    id: order.id,
    restaurantName: order.restaurantName,
    customerName: order.customerName,
    total: Number(order.total),
    status: order.status,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt.toISOString(),
    deliveryAddress: order.deliveryAddress,
    items: order.items,
  };
}

router.get("/orders", requireAuth(), async (req, res) => {
  const filter = req.user!.role === "cliente"
    ? eq(ordersTable.customerId, req.user!.id)
    : req.user!.role === "repartidor"
      ? eq(ordersTable.deliveryPartnerId, req.user!.id)
      : undefined;
  const orders = await db.select().from(ordersTable).where(filter).orderBy(desc(ordersTable.createdAt));
  res.json(ListOrdersResponse.parse(orders.map(toApiOrder)));
});

router.post("/orders", requireAuth(["cliente"]), async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.insert(ordersTable).values({
    restaurantName: parsed.data.restaurantName,
    customerId: req.user!.id,
    customerName: req.user!.name,
    total: String(parsed.data.total.toFixed(2)),
    status: "received",
    paymentMethod: parsed.data.paymentMethod,
    deliveryAddress: parsed.data.deliveryAddress,
    items: parsed.data.items,
  }).returning();
  res.status(201).json(CreateOrderResponse.parse(toApiOrder(order)));
});

router.get("/orders/:orderId", requireAuth(), async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.orderId)).limit(1);
  if (!order) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  const canRead = req.user!.role === "administrador" || order.customerId === req.user!.id || order.deliveryPartnerId === req.user!.id;
  if (!canRead) {
    res.status(403).json({ error: "No tienes permisos para ver este pedido." });
    return;
  }
  res.json(GetOrderResponse.parse(toApiOrder(order)));
});

router.patch("/orders/:orderId/status", requireAuth(["administrador"]), async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const error = !params.success ? params.error.message : !body.success ? body.error.message : "Solicitud inválida.";
    res.status(400).json({ error });
    return;
  }
  const [order] = await db.update(ordersTable).set({ status: body.data.status, updatedAt: new Date() })
    .where(eq(ordersTable.id, params.data.orderId)).returning();
  if (!order) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  res.json(UpdateOrderStatusResponse.parse(toApiOrder(order)));
});

router.get("/dashboard/summary", requireAuth(["administrador"]), async (_req, res) => {
  const orders = await db.select().from(ordersTable);
  const restaurants = await db.select({ id: restaurantsTable.id }).from(restaurantsTable);
  const deliveryPartners = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.role, "repartidor"));
  const today = new Date();
  const todaySales = orders
    .filter((order) => order.createdAt.toDateString() === today.toDateString() && order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total), 0);
  const summary = {
    todaySales,
    activeOrders: orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
    restaurants: restaurants.length,
    deliveryPartners: deliveryPartners.length,
    weeklySales: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => ({ day, total: 0 })),
  };
  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;