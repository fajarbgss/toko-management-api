const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "32kb" }));

// Demo storage: contents reset when the service restarts or redeploys.
const products = [];
const orders = [];

app.get("/", (_req, res) => {
  res.json({
    message: "API Toko aktif",
    endpoints: [
      "GET /api/products",
      "GET /api/products/:id",
      "POST /api/products",
      "PUT /api/products/:id",
      "DELETE /api/products/:id",
      "GET /api/orders",
      "POST /api/orders",
      "GET /api/summary"
    ]
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/products", (_req, res) => res.json(products));

app.get("/api/products/:id", (req, res) => {
  const product = products.find((item) => item.id === req.params.id);
  if (!product) return res.status(404).json({ message: "Produk tidak ditemukan" });
  res.json(product);
});

app.post("/api/products", (req, res) => {
  const { name, price, stock, category = "Umum" } = req.body ?? {};
  const parsedPrice = Number(price);
  const parsedStock = Number(stock);

  if (typeof name !== "string" || !name.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ message: "Isi name, price (angka >= 0), dan stock (bilangan bulat >= 0) dengan benar" });
  }

  const product = {
    id: randomUUID(),
    name: name.trim(),
    price: parsedPrice,
    stock: parsedStock,
    category: typeof category === "string" && category.trim() ? category.trim() : "Umum"
  };
  products.push(product);
  res.status(201).json(product);
});

app.put("/api/products/:id", (req, res) => {
  const product = products.find((item) => item.id === req.params.id);
  if (!product) return res.status(404).json({ message: "Produk tidak ditemukan" });

  const { name, price, stock, category } = req.body ?? {};
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ message: "name harus berupa teks yang tidak kosong" });
  }
  if (price !== undefined && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
    return res.status(400).json({ message: "price harus berupa angka >= 0" });
  }
  if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
    return res.status(400).json({ message: "stock harus berupa bilangan bulat >= 0" });
  }
  if (category !== undefined && typeof category !== "string") {
    return res.status(400).json({ message: "category harus berupa teks" });
  }

  if (name !== undefined) product.name = name.trim();
  if (price !== undefined) product.price = Number(price);
  if (stock !== undefined) product.stock = Number(stock);
  if (category !== undefined) product.category = category.trim() || "Umum";
  res.json(product);
});

app.delete("/api/products/:id", (req, res) => {
  const index = products.findIndex((item) => item.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: "Produk tidak ditemukan" });
  products.splice(index, 1);
  res.json({ message: "Produk berhasil dihapus" });
});

app.get("/api/orders", (_req, res) => res.json(orders));

app.post("/api/orders", (req, res) => {
  const { customerName, items } = req.body ?? {};
  if (typeof customerName !== "string" || !customerName.trim() || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "customerName dan items yang tidak kosong wajib diisi" });
  }

  const requested = new Map();
  for (const item of items) {
    if (!item || typeof item.productId !== "string" || !Number.isInteger(item.qty) || item.qty <= 0) {
      return res.status(400).json({ message: "Setiap item harus memiliki productId dan qty bilangan bulat positif" });
    }
    requested.set(item.productId, (requested.get(item.productId) || 0) + item.qty);
  }

  const orderItems = [];
  for (const [productId, qty] of requested) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) return res.status(404).json({ message: `Produk ${productId} tidak ditemukan` });
    if (product.stock < qty) return res.status(400).json({ message: `Stok ${product.name} tidak cukup` });
    orderItems.push({ product, qty });
  }

  let total = 0;
  const snapshot = orderItems.map(({ product, qty }) => {
    product.stock -= qty;
    const subtotal = product.price * qty;
    total += subtotal;
    return { productId: product.id, name: product.name, qty, price: product.price, subtotal };
  });

  const order = {
    id: randomUUID(),
    customerName: customerName.trim(),
    items: snapshot,
    total,
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  res.status(201).json(order);
});

app.get("/api/summary", (_req, res) => {
  res.json({
    totalProducts: products.length,
    totalStock: products.reduce((sum, product) => sum + product.stock, 0),
    totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
    totalOrders: orders.length
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Terjadi kesalahan pada server" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API Toko berjalan pada port ${PORT}`);
});
