import { Router, type IRouter } from "express";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, categoriesTable, ordersTable, productsTable, settingsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
const adminOnly = requireAuth(["administrador"]);

function productView(product: typeof productsTable.$inferSelect) {
  return {
    ...product,
    price: Number(product.price),
    image: product.image || "",
  };
}

router.get("/admin/products", adminOnly, async (_req, res) => {
  const products = await db.select().from(productsTable).orderBy(asc(productsTable.id));
  res.json(products.map(productView));
});

router.post("/admin/products", adminOnly, async (req, res): Promise<void> => {
  const { name, description = "", category, price, stock, restaurantId = 1, image = "", popular = false, active = true } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || typeof category !== "string" || !Number.isFinite(Number(price)) || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
    res.status(400).json({ error: "Nombre, categoría, precio y stock válidos son obligatorios." });
    return;
  }
  const [product] = await db.insert(productsTable).values({
    name: name.trim(),
    description: String(description),
    category: category.trim(),
    price: String(Number(price).toFixed(2)),
    stock: Number(stock),
    restaurantId: Number(restaurantId),
    image: String(image),
    popular: Boolean(popular),
    active: Boolean(active),
  }).returning();
  res.status(201).json(productView(product));
});

router.patch("/admin/products/:id", adminOnly, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Producto inválido." });
    return;
  }
  const patch = req.body ?? {};
  const updates: Partial<typeof productsTable.$inferInsert> = {};
  if (patch.name !== undefined) updates.name = String(patch.name).trim();
  if (patch.category !== undefined) updates.category = String(patch.category).trim();
  if (patch.price !== undefined && Number.isFinite(Number(patch.price))) updates.price = String(Number(patch.price).toFixed(2));
  if (patch.stock !== undefined && Number.isInteger(Number(patch.stock)) && Number(patch.stock) >= 0) updates.stock = Number(patch.stock);
  if (patch.active !== undefined) updates.active = Boolean(patch.active);
  if (patch.description !== undefined) updates.description = String(patch.description);
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No hay cambios válidos." });
    return;
  }
  updates.updatedAt = new Date();
  const [product] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  if (!product) {
    res.status(404).json({ error: "Producto no encontrado." });
    return;
  }
  res.json(productView(product));
});

router.delete("/admin/products/:id", adminOnly, async (req, res): Promise<void> => {
  const [product] = await db.delete(productsTable).where(eq(productsTable.id, Number(req.params.id))).returning();
  if (!product) {
    res.status(404).json({ error: "Producto no encontrado." });
    return;
  }
  res.status(204).send();
});

router.get("/admin/categories", adminOnly, async (_req, res) => {
  res.json(await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name)));
});

router.post("/admin/categories", adminOnly, async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "El nombre de la categoría es obligatorio." });
    return;
  }
  try {
    const [category] = await db.insert(categoriesTable).values({ name }).returning();
    res.status(201).json(category);
  } catch {
    res.status(409).json({ error: "La categoría ya existe." });
  }
});

router.delete("/admin/categories/:id", adminOnly, async (req, res): Promise<void> => {
  const [category] = await db.delete(categoriesTable).where(eq(categoriesTable.id, Number(req.params.id))).returning();
  if (!category) {
    res.status(404).json({ error: "Categoría no encontrada." });
    return;
  }
  res.status(204).send();
});

router.get("/admin/customers", adminOnly, async (_req, res) => {
  const customers = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    phone: usersTable.phone,
    address: usersTable.address,
    role: usersTable.role,
    orders: sql<number>`count(${ordersTable.id})`,
  }).from(usersTable)
    .leftJoin(ordersTable, eq(ordersTable.customerId, usersTable.id))
    .where(eq(usersTable.role, "cliente"))
    .groupBy(usersTable.id)
    .orderBy(asc(usersTable.name));
  res.json(customers.map((customer) => ({ ...customer, orders: Number(customer.orders) })));
});

router.get("/admin/delivery-partners", adminOnly, async (_req, res) => {
  res.json(await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.role, "repartidor")).orderBy(asc(usersTable.name)));
});

router.get("/admin/orders", adminOnly, async (_req, res) => {
  const orders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
  res.json(orders.map((order) => ({ ...order, total: Number(order.total), items: order.items })));
});

router.patch("/admin/orders/:id/assignment", adminOnly, async (req, res): Promise<void> => {
  const partnerId = req.body?.deliveryPartnerId === null || req.body?.deliveryPartnerId === "" ? null : Number(req.body?.deliveryPartnerId);
  if (partnerId !== null) {
    const [partner] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.id, partnerId), eq(usersTable.role, "repartidor"))).limit(1);
    if (!partner) {
      res.status(400).json({ error: "El repartidor seleccionado no es válido." });
      return;
    }
  }
  const [order] = await db.update(ordersTable).set({ deliveryPartnerId: partnerId, updatedAt: new Date() })
    .where(eq(ordersTable.id, Number(req.params.id))).returning();
  if (!order) {
    res.status(404).json({ error: "Pedido no encontrado." });
    return;
  }
  res.json({ ...order, total: Number(order.total) });
});

router.get("/admin/settings", adminOnly, async (_req, res) => {
  const settings = await db.select().from(settingsTable);
  res.json(Object.fromEntries(settings.map((setting) => [setting.key, setting.value])));
});

router.patch("/admin/settings", adminOnly, async (req, res): Promise<void> => {
  const updates = Object.entries(req.body ?? {}).filter(([key, value]) =>
    ["platformName", "minimumOrder"].includes(key) && typeof value === "string" && value.trim(),
  );
  for (const [key, value] of updates) {
    await db.insert(settingsTable).values({ key, value: String(value), updatedAt: new Date() })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(value), updatedAt: new Date() } });
  }
  const settings = await db.select().from(settingsTable);
  res.json(Object.fromEntries(settings.map((setting) => [setting.key, setting.value])));
});

export default router;