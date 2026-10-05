import { db, categoriesTable, productsTable, restaurantsTable, settingsTable } from "@workspace/db";

const restaurantSeed = [
  {
    name: "Sazón de la Plaza",
    cuisine: "Criolla & selvática",
    rating: "4.80",
    deliveryMinutes: 28,
    deliveryFee: "3.50",
    isOpen: true,
    image: "/restaurant-selva.jpg",
    featured: true,
  },
  {
    name: "Cevichería La Ribera",
    cuisine: "Marina / ceviches",
    rating: "4.70",
    deliveryMinutes: 22,
    deliveryFee: "4.00",
    isOpen: true,
    image: "/restaurant-cebicheria.jpg",
    featured: true,
  },
  {
    name: "El Fogón de Tere",
    cuisine: "Pollos & brasas",
    rating: "4.60",
    deliveryMinutes: 31,
    deliveryFee: "3.00",
    isOpen: true,
    image: "/restaurant-brasa.jpg",
    featured: false,
  },
  {
    name: "Café Pangoa",
    cuisine: "Café & desayunos",
    rating: "4.50",
    deliveryMinutes: 18,
    deliveryFee: "2.50",
    isOpen: false,
    image: "/restaurant-cebicheria.jpg",
    featured: false,
  },
];

const productSeed = [
  { restaurantId: 1, name: "Tacacho con cecina", description: "Plátano asado, cecina ahumada y salsa de cocona.", price: "26", category: "Favoritos", image: "/restaurant-selva.jpg", popular: true, stock: 24 },
  { restaurantId: 1, name: "Juane de la casa", description: "Arroz sazonado, gallina y huevo envuelto en bijao.", price: "22", category: "Favoritos", image: "/restaurant-selva.jpg", popular: true, stock: 18 },
  { restaurantId: 1, name: "Chapo de plátano", description: "Bebida tibia de plátano maduro con canela.", price: "9", category: "Bebidas", image: "/restaurant-selva.jpg", popular: false, stock: 30 },
  { restaurantId: 2, name: "Ceviche clásico", description: "Pesca del día, leche de tigre, cancha y camote.", price: "29", category: "Más pedidos", image: "/restaurant-cebicheria.jpg", popular: true, stock: 16 },
  { restaurantId: 2, name: "Chicharrón de pota", description: "Crujiente, fresco y con salsa tártara de la casa.", price: "24", category: "Más pedidos", image: "/restaurant-cebicheria.jpg", popular: true, stock: 12 },
  { restaurantId: 2, name: "Limonada hierbaluisa", description: "Limón recién exprimido y hierbaluisa local.", price: "8", category: "Bebidas", image: "/restaurant-cebicheria.jpg", popular: false, stock: 40 },
  { restaurantId: 3, name: "Pollo a la brasa entero", description: "Pollo dorado, papas y ensalada fresca.", price: "48", category: "Más pedidos", image: "/restaurant-brasa.jpg", popular: true, stock: 10 },
];

export async function seedDatabase(): Promise<void> {
  const restaurants = await db.select({ id: restaurantsTable.id }).from(restaurantsTable).limit(1);
  if (restaurants.length === 0) {
    await db.insert(restaurantsTable).values(restaurantSeed);
  }
  const categories = await db.select({ id: categoriesTable.id }).from(categoriesTable).limit(1);
  if (categories.length === 0) {
    await db.insert(categoriesTable).values([
      { name: "Favoritos" },
      { name: "Más pedidos" },
      { name: "Platos fuertes" },
      { name: "Sopas" },
      { name: "Bebidas" },
    ]);
  }
  const products = await db.select({ id: productsTable.id }).from(productsTable).limit(1);
  if (products.length === 0) {
    await db.insert(productsTable).values(productSeed);
  }
  await db.insert(settingsTable).values([
    { key: "platformName", value: "QUILLAYAA" },
    { key: "minimumOrder", value: "15" },
  ]).onConflictDoNothing();
}