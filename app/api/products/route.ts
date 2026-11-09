import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSessionUser, hasMinimumRole } from "@/lib/auth-server";
import { FieldValue } from "firebase-admin/firestore";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import type { ProductCategory, ProductUnit } from "@/types";
import { salePriceFromCost } from "@/lib/pricing";

const VALID_CATEGORIES: ProductCategory[] = [
  "motor", "transmision", "suspension", "frenos", "electrico",
  "neumaticos", "lubricantes", "carroceria", "encendido",
  "herramientas", "accesorios", "otro",
];
const VALID_UNITS: ProductUnit[] = ["PZA", "LT", "KIT", "PAR", "JGO", "MT"];

const readLimiter  = createRateLimiter({ limit: 60, windowMs: 60_000 });
const writeLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

function salePriceFromStored(costPrice: unknown, salePrice: unknown): number {
  const cost = Number(costPrice);
  if (Number.isFinite(cost) && cost >= 0) return salePriceFromCost(cost);
  const sale = Number(salePrice);
  return Number.isFinite(sale) && sale >= 0 ? sale : 0;
}

// ── GET /api/products ─────────────────────────────────────────────────────────
// Public. Optional query params: category, vendorId, inStock, featured, limit
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!readLimiter(ip).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const category   = searchParams.get("category") as ProductCategory | null;
  const vendorId   = searchParams.get("vendorId");
  const inStock    = searchParams.get("inStock") === "true";
  const featured   = searchParams.get("featured") === "true";
  const pageLimit  = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  // Managers+ see costPrice; public sees only salePrice
  const user = await getSessionUser(req);
  const isManager = user ? hasMinimumRole(user.role, "manager") : false;

  try {
    const db = getAdminDb();
    let q = db.collection("products").where("isActive", "==", true);

    if (category && VALID_CATEGORIES.includes(category)) q = q.where("category", "==", category);
    if (vendorId)  q = q.where("vendorId", "==", vendorId.slice(0, 50));
    if (featured)  q = q.where("isFeatured", "==", true);

    const snap = await q.orderBy("createdAt", "desc").limit(pageLimit).get();

    const products = snap.docs.map((d) => {
      const data = d.data();
      if (inStock && data.stock <= 0) return null;
      const base = {
        id: d.id,
        sku: data.sku,
        name: data.name,
        shortName: data.shortName ?? null,
        category: data.category,
        unit: data.unit,
        compatibleModels: data.compatibleModels ?? [],
        vendorId: data.vendorId ?? null,
        salePrice: salePriceFromStored(data.costPrice, data.salePrice),
        stock: data.stock,
        minStock: data.minStock,
        imageUrls: data.imageUrls ?? [],
        isActive: data.isActive,
        isFeatured: data.isFeatured ?? false,
        tags: data.tags ?? [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
      return isManager ? { ...base, costPrice: data.costPrice } : base;
    }).filter(Boolean);

    return NextResponse.json({ products, total: products.length });
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST /api/products ────────────────────────────────────────────────────────
// Requires manager+
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!writeLimiter(ip).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await getSessionUser(req);
  if (!user || !hasMinimumRole(user.role, "manager")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const name      = String(body.name ?? "").trim().slice(0, 300);
  const category  = body.category as ProductCategory;
  const unit      = (body.unit ?? "PZA") as ProductUnit;
  const costPrice = Number(body.costPrice);
  const stock     = Number(body.stock ?? 0);
  const minStock  = Number(body.minStock ?? 2);
  const customSku = String(body.sku ?? "").trim().slice(0, 40);

  if (!name)                                  return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!VALID_CATEGORIES.includes(category))   return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (!VALID_UNITS.includes(unit))            return NextResponse.json({ error: "Invalid unit" }, { status: 400 });
  if (isNaN(costPrice) || costPrice < 0)      return NextResponse.json({ error: "Invalid costPrice" }, { status: 400 });
  if (isNaN(stock) || stock < 0)              return NextResponse.json({ error: "Invalid stock" }, { status: 400 });

  const salePrice = salePriceFromCost(costPrice);

  try {
    const db = getAdminDb();
    const counterRef = db.collection("_counters").doc("products");

    let sku = customSku;
    if (!sku) {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const count = (snap.data()?.count ?? 0) + 1;
        sku = `PRD-${String(count).padStart(5, "0")}`;
        tx.set(counterRef, { count }, { merge: true });
      });
    }

    const compatibleModels = Array.isArray(body.compatibleModels)
      ? (body.compatibleModels as unknown[]).map(String).slice(0, 30)
      : [];
    const tags = Array.isArray(body.tags)
      ? (body.tags as unknown[]).map(String).slice(0, 20)
      : [];

    const ref = await db.collection("products").add({
      sku,
      name,
      shortName: body.shortName ? String(body.shortName).slice(0, 100) : null,
      category,
      unit,
      compatibleModels,
      vendorId: body.vendorId ? String(body.vendorId).slice(0, 50) : null,
      vendorSku: body.vendorSku ? String(body.vendorSku).slice(0, 50) : null,
      supplierName: body.supplierName ? String(body.supplierName).trim().slice(0, 120) : null,
      costPrice,
      salePrice,
      stock,
      minStock,
      imageUrls: [],
      isActive: true,
      isFeatured: Boolean(body.isFeatured ?? false),
      tags,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, id: ref.id, sku }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/products]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
