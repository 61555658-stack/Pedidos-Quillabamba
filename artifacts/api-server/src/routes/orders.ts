import { Router, type IRouter } from "express";
import {
  CreateOrderBody,
  CreateOrderResponse,
  ClaimOrderParams,
  ClaimOrderResponse,
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

const router: IRouter = Router();
const maxLocationAccuracyMeters = 250;

// Catálogo inicial que permite probar el producto sin una base de datos vacía.
// En una siguiente etapa estos registros pueden trasladarse a tablas PostgreSQL.
const restaurants = [
  { id: 1, name: "Sabor Quillabamba", cuisine: "Criolla & amazónica", rating: 4.9, deliveryMinutes: 25, deliveryFee: 3.5, isOpen: true, image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80", featured: true },
  { id: 2, name: "La Patarashca", cuisine: "Selva peruana", rating: 4.8, deliveryMinutes: 30, deliveryFee: 4, isOpen: true, image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80", featured: true },
  { id: 3, name: "Café Tunkimayo", cuisine: "Café & desayunos", rating: 4.7, deliveryMinutes: 20, deliveryFee: 2.5, isOpen: true, image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80", featured: false },
  { id: 4, name: "Pizzería Central", cuisine: "Pizzas & pastas", rating: 4.6, deliveryMinutes: 35, deliveryFee: 3.5, isOpen: false, image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=80", featured: false },
];

const products = [
  { id: 1, restaurantId: 1, name: "Juane amazónico", description: "Arroz sazonado, gallina, huevo y aceituna envuelto en hoja de bijao.", price: 18, category: "Platos fuertes", image: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=700&q=80", popular: true },
  { id: 2, restaurantId: 1, name: "Cecina con tacacho", description: "Cecina ahumada, tacacho de plátano y salsa criolla.", price: 24, category: "Platos fuertes", image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=80", popular: true },
  { id: 3, restaurantId: 1, name: "Inchicapi de gallina", description: "Sopa tradicional de maní, maíz y gallina de chacra.", price: 16, category: "Sopas", image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=700&q=80", popular: false },
  { id: 4, restaurantId: 2, name: "Patarashca de doncella", description: "Pescado de río con hierbas amazónicas, cocido en hoja.", price: 28, category: "Especialidades", image: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=700&q=80", popular: true },
  { id: 5, restaurantId: 2, name: "Chaufa amazónico", description: "Arroz salteado con cecina, plátano y ají charapita.", price: 22, category: "Platos fuertes", image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=700&q=80", popular: false },
  { id: 6, restaurantId: 3, name: "Cold brew de altura", description: "Café de especialidad de Quillabamba, extracción en frío.", price: 12, category: "Bebidas", image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=700&q=80", popular: true },
];

// Modelo de respuesta que comparten las rutas de consulta y actualización.
type Order = {
  id: number;
  restaurantName: string;
  customerName: string;
  total: number;
  status: "received" | "preparing" | "ready" | "on_the_way" | "delivered" | "cancelled";
  paymentMethod: "cash" | "yape" | "card";
  createdAt: string;
  deliveryAddress?: string;
  deliveryPartnerEmail?: string;
  deliveryPartnerName?: string;
  customerUserId?: string;
  deliveryPartnerUserId?: string;
  currentLocation?: { latitude: number; longitude: number; accuracy: number; updatedAt: string };
  items: { id: number; name: string; quantity: number; price: number }[];
};

const orders: Order[] = [
  { id: 1048, restaurantName: "Sabor Quillabamba", customerName: "María Fernanda", total: 45.5, status: "on_the_way", paymentMethod: "yape", createdAt: "2026-08-24T13:20:00.000Z", deliveryAddress: "Jr. Junín 245", items: [{ id: 1, name: "Cecina con tacacho", quantity: 1, price: 24 }, { id: 6, name: "Chicha morada", quantity: 1, price: 8 }] },
  { id: 1047, restaurantName: "La Patarashca", customerName: "Luis Alberto", total: 31.5, status: "preparing", paymentMethod: "cash", createdAt: "2026-08-24T13:04:00.000Z", deliveryAddress: "Av. Edgar de la Torre 890", items: [{ id: 4, name: "Patarashca de doncella", quantity: 1, price: 28 }] },
  { id: 1046, restaurantName: "Café Tunkimayo", customerName: "Ana Lucía", total: 26.5, status: "delivered", paymentMethod: "card", createdAt: "2026-08-24T12:40:00.000Z", deliveryAddress: "Jr. Tarapacá 112", items: [{ id: 6, name: "Cold brew de altura", quantity: 2, price: 12 }] },
];

// Devuelve el catálogo para la página de inicio.
router.get("/restaurants", (_req, res) => {
  res.json(ListRestaurantsResponse.parse(restaurants));
});

// Devuelve únicamente los productos del restaurante seleccionado.
router.get("/restaurants/:restaurantId/products", (req, res) => {
  const params = ListRestaurantProductsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(ListRestaurantProductsResponse.parse(products.filter((product) => product.restaurantId === params.data.restaurantId)));
});

// Lista pedidos recientes para el historial y el panel administrativo.
router.get("/orders", (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Inicia sesión." });
  const visible = req.user.role === "administrador_sistema" || req.user.role === "administrador_negocio"
    ? orders
    : req.user.role === "repartidor"
      ? orders.filter((order) => !order.deliveryPartnerUserId || order.deliveryPartnerUserId === req.user.id)
      : orders.filter((order) => order.customerUserId === req.user.id);
  return res.json(ListOrdersResponse.parse(visible));
});

// Valida el checkout, crea el pedido y lo inicia en estado "received".
router.post("/orders", (req, res) => {
  if (!req.isAuthenticated() || req.user.role !== "cliente") return res.status(403).json({ error: "Se requiere una cuenta de cliente." });
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const order: Order = {
    id: Math.max(...orders.map((item) => item.id), 1048) + 1,
    ...parsed.data,
    status: "received",
    createdAt: new Date().toISOString(),
    customerUserId: req.user.id,
  };
  orders.unshift(order);
  return res.status(201).json(CreateOrderResponse.parse(order));
});

// Reclamo atómico: el primer repartidor que llega a esta asignación queda registrado.
router.post("/orders/:orderId/claim", (req, res) => {
  const params = ClaimOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!req.isAuthenticated() || req.user.role !== "repartidor" || !req.user.email) {
    res.status(403).json({ error: "Se requiere una cuenta de repartidor." });
    return;
  }
  const courierEmail = req.user.email.trim().toLowerCase();
  const courierName = [req.user.firstName, req.user.lastName].filter(Boolean).join(" ") || courierEmail;

  const order = orders.find((item) => item.id === params.data.orderId);
  if (!order) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  if (order.status === "delivered" || order.status === "cancelled") {
    res.status(409).json({ error: "Este pedido ya no está disponible." });
    return;
  }
  if (order.deliveryPartnerUserId) {
    if (order.deliveryPartnerUserId === req.user.id) {
      res.json(ClaimOrderResponse.parse(order));
      return;
    }
    res.status(409).json({ error: "Otro repartidor ya tomó este pedido." });
    return;
  }

  // No await between checking and assigning: concurrent requests are serialized by this process.
  order.deliveryPartnerEmail = courierEmail;
  order.deliveryPartnerName = courierName;
  order.deliveryPartnerUserId = req.user.id;
  res.json(ClaimOrderResponse.parse(order));
});

router.put("/orders/:orderId/location", (req, res) => {
  const orderId = Number(req.params.orderId);
  const { latitude, longitude, accuracy } = req.body ?? {};
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy < 0 || accuracy > maxLocationAccuracyMeters) {
    return res.status(400).json({ error: "Ubicación inválida o poco precisa." });
  }
  if (!req.isAuthenticated() || req.user.role !== "repartidor") return res.status(403).json({ error: "Se requiere una cuenta de repartidor." });
  const order = orders.find((item) => item.id === orderId);
  if (!order || order.deliveryPartnerUserId !== req.user.id || ["delivered", "cancelled"].includes(order.status)) {
    return res.status(404).json({ error: "Pedido no disponible para este repartidor." });
  }
  order.currentLocation = { latitude, longitude, accuracy, updatedAt: new Date().toISOString() };
  return res.json({ saved: true, updatedAt: order.currentLocation.updatedAt });
});

router.get("/orders/:orderId/location", (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return res.status(400).json({ error: "Pedido inválido." });
  if (!req.isAuthenticated()) return res.status(401).json({ error: "Inicia sesión." });
  const order = orders.find((item) => item.id === orderId);
  if (!order || (req.user.role !== "administrador_sistema" && order.customerUserId !== req.user.id && order.deliveryPartnerUserId !== req.user.id)) {
    return res.status(404).json({ error: "Ubicación no disponible." });
  }
  if (order.status !== "on_the_way" || !order.currentLocation || Date.now() - Date.parse(order.currentLocation.updatedAt) > 120_000) {
    return res.status(404).json({ error: "Ubicación todavía no disponible." });
  }
  return res.json(order.currentLocation);
});

// Obtiene el detalle que se muestra en el seguimiento del cliente.
router.get("/orders/:orderId", (req, res) => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const order = orders.find((item) => item.id === params.data.orderId);
  if (!order) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  if (!req.isAuthenticated() || (req.user.role !== "administrador_sistema" && req.user.role !== "administrador_negocio" && order.customerUserId !== req.user.id && order.deliveryPartnerUserId !== req.user.id)) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  res.json(GetOrderResponse.parse(order));
});

// Acción operativa para que restaurante/admin/repartidor avance el pedido.
router.patch("/orders/:orderId/status", (req, res) => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  const body = UpdateOrderStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    const error = !params.success
      ? params.error.message
      : body.success
        ? "Solicitud inválida"
        : body.error.message;
    res.status(400).json({ error });
    return;
  }
  const order = orders.find((item) => item.id === params.data.orderId);
  if (!order) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  if (!req.isAuthenticated()
    || (req.user.role === "repartidor" && order.deliveryPartnerUserId !== req.user.id)
    || (req.user.role !== "repartidor" && req.user.role !== "administrador_sistema" && req.user.role !== "administrador_negocio")) {
    return res.status(403).json({ error: "No tienes permiso para actualizar este pedido." });
  }
  if (req.user.role === "repartidor" && body.data.status === "on_the_way"
    && (!order.currentLocation || Date.now() - Date.parse(order.currentLocation.updatedAt) > 60_000)) {
    return res.status(409).json({ error: "Activa la ubicación precisa antes de iniciar el reparto." });
  }
  if (body.data.status === "delivered") {
    return res.status(409).json({ error: "No se puede completar la entrega hasta que el comprobante fotográfico quede guardado." });
  }
  order.status = body.data.status;
  return res.json(UpdateOrderStatusResponse.parse(order));
});

// Métricas agregadas que alimentan el dashboard administrativo.
router.get("/dashboard/summary", (_req, res) => {
  const summary = {
    todaySales: 1842.5,
    activeOrders: orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
    restaurants: restaurants.length,
    deliveryPartners: 12,
    weeklySales: [
      { day: "Lun", total: 980 }, { day: "Mar", total: 1240 }, { day: "Mié", total: 1100 },
      { day: "Jue", total: 1620 }, { day: "Vie", total: 1842 }, { day: "Sáb", total: 2150 }, { day: "Dom", total: 1980 },
    ],
  };
  res.json(GetDashboardSummaryResponse.parse(summary));
});

export default router;