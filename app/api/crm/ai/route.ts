import { NextRequest, NextResponse } from "next/server";
import { Mistral } from "@mistralai/mistralai";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { customerUnitPrice } from "@/lib/pricing";
import { createRateLimiter } from "@/lib/rate-limit";

const rateLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

const STAFF_ROLES = new Set(["admin", "manager", "operador", "mecanico"]);

// ── Auth ──────────────────────────────────────────────────────────────────────

async function verifyStaff(
  req: NextRequest
): Promise<{ uid: string; name: string; role: string } | null> {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    const db = getAdminDb();
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return null;
    const data = userSnap.data()!;
    const role = (data.role as string) ?? "";
    if (!STAFF_ROLES.has(role)) return null;
    return { uid, name: (data.displayName as string) ?? decoded.email ?? uid, role };
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Doc = Record<string, unknown>;

function ts(val: unknown): string {
  const d = (val as { toDate?: () => Date } | undefined)?.toDate?.();
  return d ? d.toLocaleString("es-MX") : "—";
}

function mxn(n: unknown): string {
  return `$${Number(n ?? 0).toLocaleString("es-MX")} MXN`;
}

// ── Intent detection ─────────────────────────────────────────────────────────

function detectIntents(msg: string) {
  const m = msg.toLowerCase();
  return {
    tickets:        /ticket|spm-|orden de servicio|servicio/i.test(msg),
    mechanics:      /mecánico|mecanico|técnico|tecnico|asignado|disponible/i.test(msg),
    clients:        /clientes?|cliente|comprador|usuario/i.test(msg),
    inventory:      /inventario|stock|existencia|producto|catálogo|catalogo|refacción|refaccion|pieza|parte/i.test(msg),
    lowStock:       /stock bajo|sin stock|agotado|reponer|reorden|mínimo|minimo/i.test(msg),
    specificProduct:/prd-\d+/i.test(msg),
    vendors:        /proveedor|proveedores|motocruz|compra|vendor/i.test(msg),
    purchaseOrders: /orden de compra|oc-\d+|recepción|recepcio|compra a proveedor/i.test(msg),
    payments:       /pago|cobro|factura|ingreso|revenue|cobrado|facturado/i.test(msg),
    store:          /tienda|marketplace|venta en línea|ecommerce/i.test(msg),
    summary:        /resumen|reporte|dashboard|panorama|status|estado general/i.test(msg),
  };
}

// ── Context builders ─────────────────────────────────────────────────────────

async function buildTicketsContext(db: ReturnType<typeof getAdminDb>, msg: string) {
  const snap = await db.collection("service_tickets").orderBy("createdAt", "desc").limit(80).get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Doc);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const active = all.filter(t => !["pagado", "cancelado"].includes(t.status as string));
  const completedToday = all.filter(t => {
    if (!["pagado", "completado"].includes(t.status as string)) return false;
    const d = (t.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.();
    return d !== undefined && d >= todayStart;
  });

  const revenueToday = completedToday.reduce((s, t) => s + ((t.finalCost as number) ?? 0), 0);

  const byStatus: Record<string, number> = {};
  for (const t of active) { const s = t.status as string; byStatus[s] = (byStatus[s] ?? 0) + 1; }

  const ticketLines = active.slice(0, 30).map(t =>
    `  • ${t.ticketId} [${t.status}] ${t.serviceType} | ${t.clientName ?? "sin nombre"} | 🔧 ${t.mechanicName ?? "SIN ASIGNAR"} | ${mxn(t.finalCost ?? t.estimatedCost)}`
  ).join("\n");

  // Full detail for specific ticket
  let detail = "";
  const match = msg.match(/SPM-(\d+)/i);
  if (match) {
    const tid = `SPM-${match[1].padStart(4, "0")}`;
    const found = all.find(t => (t.ticketId as string)?.toUpperCase() === tid.toUpperCase());
    if (found) {
      detail = `\nDETALLE ${tid}:\n${JSON.stringify({
        ticketId: found.ticketId, status: found.status, serviceType: found.serviceType,
        serviceDescription: found.serviceDescription, clientName: found.clientName,
        clientPhone: found.clientPhone, mechanicName: found.mechanicName,
        serviceAddress: found.serviceAddress, estimatedCost: found.estimatedCost,
        finalCost: found.finalCost, diagnosis: found.diagnosis, workDone: found.workDone,
        parts: found.parts, totalPaid: found.totalPaid, payments: found.payments,
        createdAt: ts(found.createdAt), updatedAt: ts(found.updatedAt),
      }, null, 2)}`;
    }
  }

  const statusSummary = Object.entries(byStatus).map(([k, v]) => `${k}: ${v}`).join(", ");

  return `TICKETS (${now.toLocaleString("es-MX")}):
  • Activos: ${active.length} (${statusSummary || "ninguno"})
  • Completados hoy: ${completedToday.length}  |  Ingresos del día: ${mxn(revenueToday)}
  • Sin mecánico: ${active.filter(t => !t.mechanicId).length}

TICKETS ACTIVOS (últimos 30):
${ticketLines || "  (ninguno)"}${detail}`;
}

async function buildMechanicsContext(db: ReturnType<typeof getAdminDb>) {
  const snap = await db.collection("mechanics").orderBy("name").get();
  const mechanics = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Doc);
  const available = mechanics.filter(m => m.status === "disponible").length;
  const lines = mechanics.map(m => {
    const skills = Array.isArray(m.skills) ? (m.skills as string[]).slice(0, 3).join(", ") : "-";
    const zonas = Array.isArray(m.zona) ? (m.zona as string[]).join(", ") : (m.zona as string) ?? "-";
    const rating = m.averageRating ? ` | ⭐${Number(m.averageRating).toFixed(1)}` : "";
    return `  • ${m.name} [${m.status}] | Zona: ${zonas} | Skills: ${skills}${rating} | Servicios completados: ${m.totalServicesCompleted ?? 0}`;
  }).join("\n");
  return `MECÁNICOS (${available}/${mechanics.length} disponibles):\n${lines || "  (sin mecánicos)"}`;
}

async function buildClientsContext(db: ReturnType<typeof getAdminDb>) {
  const snap = await db.collection("clients").orderBy("createdAt", "desc").limit(20).get();
  const lines = snap.docs.map(d => {
    const c = d.data();
    return `  • ${c.name} ${c.lastName ?? ""} | Tel: ${c.phone} | Tickets: ${c.totalTickets ?? 0} | Pagado total: ${mxn(c.totalPaid)}`;
  }).join("\n");
  return `CLIENTES RECIENTES (20):\n${lines || "  (ninguno)"}`;
}

async function buildInventoryContext(db: ReturnType<typeof getAdminDb>, msg: string) {
  const snap = await db.collection("products").orderBy("createdAt", "desc").get();
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Doc);

  const active = products.filter(p => p.isActive);
  const lowStock = active.filter(p => (p.stock as number) <= (p.minStock as number));
  const outOfStock = active.filter(p => (p.stock as number) === 0);
  const totalCostValue = active.reduce((s, p) => s + (p.stock as number) * (p.costPrice as number), 0);
  const totalSaleValue = active.reduce((s, p) => s + (p.stock as number) * customerUnitPrice({ costPrice: p.costPrice as number, salePrice: p.salePrice as number }), 0);
  const totalUnits = active.reduce((s, p) => s + (p.stock as number), 0);

  // Low stock alert list
  const lowStockLines = lowStock.slice(0, 15).map(p =>
    `  ⚠ ${p.sku} · ${p.name} | Stock: ${p.stock}/${p.minStock} | ${mxn(customerUnitPrice({ costPrice: p.costPrice as number, salePrice: p.salePrice as number }))}`
  ).join("\n");

  // Full product list (condensed)
  const allLines = active.slice(0, 50).map(p => {
    const models = Array.isArray(p.compatibleModels) ? (p.compatibleModels as string[]).join("/") : "";
    const sale = customerUnitPrice({ costPrice: p.costPrice as number, salePrice: p.salePrice as number });
    return `  • ${p.sku} · ${p.shortName ?? p.name} | Cat: ${p.category} | Stock: ${p.stock} ${p.unit} | Venta: ${mxn(sale)} | Costo: ${mxn(p.costPrice)}${models ? ` | Modelos: ${models}` : ""}`;
  }).join("\n");

  // Detail for specific product (PRD-XXXXX)
  let productDetail = "";
  const pMatch = msg.match(/PRD-\d+/i);
  if (pMatch) {
    const found = products.find(p => (p.sku as string)?.toUpperCase() === pMatch[0].toUpperCase());
    if (found) {
      productDetail = `\nDETALLE ${pMatch[0].toUpperCase()}:\n${JSON.stringify({
        sku: found.sku, name: found.name, category: found.category,
        unit: found.unit, stock: found.stock, minStock: found.minStock,
        costPrice: found.costPrice,
        salePrice: customerUnitPrice({ costPrice: found.costPrice as number, salePrice: found.salePrice as number }),
        compatibleModels: found.compatibleModels, vendorId: found.vendorId,
        isActive: found.isActive, isFeatured: found.isFeatured, tags: found.tags,
        updatedAt: ts(found.updatedAt),
      }, null, 2)}`;
    }
  }

  return `INVENTARIO — ${active.length} productos activos | ${totalUnits} unidades totales:
  • Valor inventario (costo): ${mxn(totalCostValue)}
  • Valor inventario (venta): ${mxn(totalSaleValue)}
  • Con stock bajo: ${lowStock.length}  |  Sin stock: ${outOfStock.length}

${lowStock.length > 0 ? `ALERTAS STOCK BAJO (${lowStock.length}):\n${lowStockLines}\n` : "✅ Sin alertas de stock bajo\n"}
CATÁLOGO COMPLETO (${active.length} productos):
${allLines || "  (sin productos)"}${productDetail}`;
}

async function buildVendorsContext(db: ReturnType<typeof getAdminDb>) {
  const snap = await db.collection("vendors").orderBy("name").get();
  const lines = snap.docs.map(d => {
    const v = d.data();
    return `  • ${v.vendorId} · ${v.name} | RFC: ${v.rfc ?? "—"} | Tel: ${v.phone ?? "—"} | Email: ${v.email ?? "—"}`;
  }).join("\n");
  return `PROVEEDORES:\n${lines || "  (ninguno)"}`;
}

async function buildPurchaseOrdersContext(db: ReturnType<typeof getAdminDb>) {
  const snap = await db.collection("purchase_orders").orderBy("createdAt", "desc").limit(20).get();
  const lines = snap.docs.map(d => {
    const o = d.data();
    const items = Array.isArray(o.items) ? (o.items as Doc[]).length : 0;
    return `  • ${o.orderId} | ${o.vendorName} | ${o.status} | ${items} productos | Total: ${mxn(o.total)} | ${ts(o.createdAt)}`;
  }).join("\n");
  return `ÓRDENES DE COMPRA (últimas 20):\n${lines || "  (ninguna)"}`;
}

async function buildPaymentsContext(db: ReturnType<typeof getAdminDb>) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const snap = await db.collection("service_tickets")
    .where("status", "==", "pagado")
    .orderBy("paidAt", "desc")
    .limit(50)
    .get();

  const paid = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Doc);

  const todayRevenue = paid.filter(t => {
    const d = (t.paidAt as { toDate?: () => Date } | undefined)?.toDate?.();
    return d !== undefined && d >= todayStart;
  }).reduce((s, t) => s + ((t.finalCost as number) ?? 0), 0);

  const monthRevenue = paid.filter(t => {
    const d = (t.paidAt as { toDate?: () => Date } | undefined)?.toDate?.();
    return d !== undefined && d >= monthStart;
  }).reduce((s, t) => s + ((t.finalCost as number) ?? 0), 0);

  const totalRevenue = paid.reduce((s, t) => s + ((t.finalCost as number) ?? 0), 0);

  const byMethod: Record<string, number> = {};
  for (const t of paid) {
    const m = (t.paymentMethod as string) ?? "desconocido";
    byMethod[m] = (byMethod[m] ?? 0) + ((t.finalCost as number) ?? 0);
  }

  const recentLines = paid.slice(0, 15).map(t =>
    `  • ${t.ticketId} | ${t.clientName ?? "—"} | ${mxn(t.finalCost)} | ${t.paymentMethod ?? "—"} | ${ts(t.paidAt)}`
  ).join("\n");

  const methodLines = Object.entries(byMethod).map(([k, v]) => `  • ${k}: ${mxn(v)}`).join("\n");

  return `PAGOS Y FACTURACIÓN:
  • Ingresos hoy: ${mxn(todayRevenue)}
  • Ingresos este mes: ${mxn(monthRevenue)}
  • Ingresos totales (últimos 50 pagados): ${mxn(totalRevenue)}

Por método de pago:
${methodLines || "  (sin datos)"}

Últimos 15 servicios pagados:
${recentLines || "  (ninguno)"}`;
}

// ── Main context builder ──────────────────────────────────────────────────────

async function buildContext(msg: string): Promise<string> {
  const db = getAdminDb();
  const intent = detectIntents(msg);
  const sections: string[] = [];

  // Always include tickets + mechanics (core ops)
  const [ticketsCtx, mechCtx] = await Promise.all([
    buildTicketsContext(db, msg),
    buildMechanicsContext(db),
  ]);
  sections.push(ticketsCtx, mechCtx);

  // Conditional sections based on intent
  const extras: Promise<string>[] = [];

  if (intent.clients) extras.push(buildClientsContext(db));

  if (intent.inventory || intent.lowStock || intent.specificProduct || intent.store || intent.summary) {
    extras.push(buildInventoryContext(db, msg));
  }

  if (intent.vendors || intent.purchaseOrders) {
    extras.push(buildVendorsContext(db));
    extras.push(buildPurchaseOrdersContext(db));
  } else if (intent.purchaseOrders) {
    extras.push(buildPurchaseOrdersContext(db));
  }

  if (intent.payments || intent.summary) extras.push(buildPaymentsContext(db));

  // For summary/dashboard requests, include everything
  if (intent.summary) {
    if (!intent.clients) extras.push(buildClientsContext(db));
    if (!intent.vendors) extras.push(buildVendorsContext(db));
    if (!intent.purchaseOrders) extras.push(buildPurchaseOrdersContext(db));
  }

  const extraSections = await Promise.all(extras);
  sections.push(...extraSections);

  return sections.join("\n\n");
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const staff = await verifyStaff(req);
  if (!staff) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rl = rateLimiter(staff.uid);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { message, history } = await req.json();
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "IA no configurada" }, { status: 500 });

    const context = await buildContext(message);

    const systemPrompt = `Eres el asistente operativo de SanPedroMotoCare (SPM). Tienes acceso completo y en tiempo real a toda la base de datos del negocio.

Estás hablando con: ${staff.name} (${staff.role})

MÓDULOS A LOS QUE TIENES ACCESO:
1. 🎫 TICKETS DE SERVICIO — estado, mecánico asignado, costos, partes usadas, historial
2. 🔧 MECÁNICOS — disponibilidad, zonas, habilidades, calificaciones
3. 👥 CLIENTES — historial, teléfonos, total gastado
4. 📦 INVENTARIO — catálogo completo, stock en tiempo real, alertas de stock bajo
5. 🏪 TIENDA ONLINE — productos activos, precios, compatibilidad por modelo de moto
6. 🚚 PROVEEDORES — datos de contacto, RFC
7. 📋 ÓRDENES DE COMPRA — estado, items recibidos, totales
8. 💰 PAGOS & FACTURACIÓN — ingresos del día, mes, por método de pago

DATOS EN TIEMPO REAL:
${context}

CAPACIDADES:
- Busca tickets por ID (SPM-XXXX) y da detalles completos
- Busca productos por SKU (PRD-XXXXX) y muestra stock, precio, modelos compatibles
- Identifica productos con stock bajo o agotados y sugiere reorden
- Calcula valor del inventario, márgenes, métricas de venta
- Reporta ingresos del día, semana o mes
- Detecta tickets sin mecánico asignado y recomienda asignación
- Sugiere qué partes necesita un ticket basándose en el diagnóstico
- Identifica qué productos se mueven más / menos

REGLAS DE RESPUESTA:
- Responde siempre en español
- Sé conciso y ejecutivo. Usa bullet points para listas
- Dinero en formato $X,XXX MXN
- Tickets en formato SPM-XXXX · Productos en formato PRD-XXXXX
- Si hay stock bajo o tickets SIN MECÁNICO, mencionalo con urgencia ⚠
- Máximo 5 párrafos o 12 bullet points por respuesta`;

    const client = new Mistral({ apiKey });

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(history ?? []).slice(-8).map((m: { role: string; content: string }) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const result = await client.chat.complete({ model: "mistral-small-latest", messages });
    const reply = result.choices?.[0]?.message?.content ?? "";

    if (!reply) console.error("[crm/ai] Empty reply from Mistral");

    return NextResponse.json({ reply });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[crm/ai] Error:", msg);
    return NextResponse.json(
      { error: "Error al procesar tu solicitud. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
