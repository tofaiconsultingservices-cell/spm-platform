/**
 * Seed script — Catálogo inicial MotoCruz (Proveedor 1004)
 *
 * Fuente: Nota de Venta #239, 21/04/2026
 *         Rosa Isela Velez Yerbes · García, N.L. · motocruz417@gmail.com
 *         Total factura: $28,101.88 MXN
 *
 * Uso:
 *   npx tsx scripts/seed-motocruz.ts
 *
 * Requiere FIREBASE_SERVICE_ACCOUNT_KEY en .env.local
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { salePriceFromCost } from "../lib/pricing";

// ── Firebase Admin init ──────────────────────────────────────────────────────

if (getApps().length === 0) {
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not set in .env.local");
  initializeApp({ credential: cert(JSON.parse(key)) });
}

const db = getFirestore();

// ── Tipos locales ────────────────────────────────────────────────────────────

type ProductCategory =
  | "motor" | "transmision" | "suspension" | "frenos" | "electrico"
  | "neumaticos" | "lubricantes" | "carroceria" | "encendido"
  | "herramientas" | "accesorios" | "otro";

type ProductUnit = "PZA" | "LT" | "KIT" | "PAR" | "JGO" | "MT";

interface SeedProduct {
  name: string;
  shortName: string;
  category: ProductCategory;
  unit: ProductUnit;
  compatibleModels: string[];
  costPrice: number;
  stock: number;
}

// ── Lógica de precios ─────────────────────────────────────────────────────────

/** Precio de venta al cliente: costo del proveedor + 20% fijo. */
function salePrice(cost: number): number {
  return salePriceFromCost(cost);
}

/** Stock mínimo para alerta de reorden según rango de precio. */
function minStock(cost: number): number {
  if (cost < 50)  return 5;
  if (cost < 200) return 3;
  return 1;
}

// ── Catálogo MotoCruz — Nota de Venta #239 ───────────────────────────────────

const PRODUCTS: SeedProduct[] = [
  // ── MOTOR ──────────────────────────────────────────────────────────────────
  {
    name: "ÁRBOL DE LEVAS 250Z/200Z/250SZ/TC250/FT250/FT250TS",
    shortName: "Árbol de Levas 250Z",
    category: "motor", unit: "PZA",
    compatibleModels: ["250Z", "200Z", "250SZ", "TC250", "FT250", "FT250TS"],
    costPrice: 153.75, stock: 3,
  },
  {
    name: "ÁRBOL DE LEVAS (DIMORA) FT125/FT150/125Z/150Z/DM200/DM250/RC150",
    shortName: "Árbol de Levas DIMORA largo",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT125", "FT150", "125Z", "150Z", "DM200", "DM250", "RC150"],
    costPrice: 343.75, stock: 2,
  },
  {
    name: "ÁRBOL DE LEVAS (DIMORA) FT125/FT150/150Z/DM200",
    shortName: "Árbol de Levas DIMORA",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT125", "FT150", "150Z", "DM200"],
    costPrice: 144.00, stock: 6,
  },
  {
    name: "BALANCÍN INFERIOR FT125/FT150/125Z/FT200/DM200/RYDER190",
    shortName: "Balancín Inferior",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT125", "FT150", "125Z", "FT200", "DM200", "RYDER190"],
    costPrice: 70.00, stock: 3,
  },
  {
    name: "BALANCÍN 250Z/200Z/RT250/170Z",
    shortName: "Balancín 250Z",
    category: "motor", unit: "PZA",
    compatibleModels: ["250Z", "200Z", "RT250", "170Z"],
    costPrice: 74.85, stock: 3,
  },
  {
    name: "BALANCÍN INFERIOR (DIMORA) FT125/FT150/125Z/TC250/FT250/DM200",
    shortName: "Balancín Inferior DIMORA",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT125", "FT150", "125Z", "TC250", "FT250", "DM200"],
    costPrice: 83.75, stock: 1,
  },
  {
    name: "BALANCÍN (DIMORA) CARGO150/GL150",
    shortName: "Balancín DIMORA Cargo",
    category: "motor", unit: "PZA",
    compatibleModels: ["CARGO150", "GL150"],
    costPrice: 170.00, stock: 1,
  },
  {
    name: "BALERO DE MOTOR DM500",
    shortName: "Balero Motor DM500",
    category: "motor", unit: "PZA",
    compatibleModels: ["DM500"],
    costPrice: 49.46, stock: 10,
  },
  {
    name: "BALERO DE MOTOR FT180/DM200/DT200/FT250TS/DM250",
    shortName: "Balero Motor (múltiple)",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT180", "DM200", "DT200", "FT250TS", "DM250"],
    costPrice: 212.50, stock: 3,
  },
  {
    name: "CENTRIFUGO FILTRO ACEITE FT125/FT150/DM200",
    shortName: "Centrífugo Filtro Aceite",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT125", "FT150", "DM200"],
    costPrice: 38.75, stock: 5,
  },
  {
    name: "CENTRIFUGO FILTRO ACEITE (DIMORA) FT125",
    shortName: "Centrífugo Filtro Aceite DIMORA",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT125"],
    costPrice: 38.00, stock: 5,
  },
  {
    name: "VÁLVULA ADMISIÓN/ESCAPE FT150/RC150/150Z/DM150/RT180",
    shortName: "Válvula Adm/Esc DIMORA 150",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT150", "RC150", "150Z", "DM150", "RT180"],
    costPrice: 167.59, stock: 3,
  },
  {
    name: "VÁLVULA ADMISIÓN/ESCAPE 170Z/250Z GRARITO/150Z/200Z",
    shortName: "Válvula Adm/Esc Grarito",
    category: "motor", unit: "PZA",
    compatibleModels: ["170Z", "250Z", "150Z", "200Z"],
    costPrice: 36.80, stock: 5,
  },
  {
    name: "EMPAQUE DE MOTOR (DIMORA) FT150/150Z/DM150/CARGO150",
    shortName: "Empaque Motor DIMORA 150 A",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT150", "150Z", "DM150", "CARGO150"],
    costPrice: 43.75, stock: 10,
  },
  {
    name: "EMPAQUE DE MOTOR (DIMORA) FT150/150Z/DM150/RYDER150/CROSSMAX150",
    shortName: "Empaque Motor DIMORA 150 B",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT150", "150Z", "DM150", "RYDER150", "CROSSMAX150"],
    costPrice: 33.00, stock: 5,
  },
  {
    name: "EMPAQUE DE MOTOR 170Z/200Z/250Z GRARITO",
    shortName: "Empaque Motor Grarito 250Z",
    category: "motor", unit: "PZA",
    compatibleModels: ["170Z", "200Z", "250Z"],
    costPrice: 40.00, stock: 10,
  },
  {
    name: "EMPAQUE DE MOTOR DM250/CROSSMAX200/DM200",
    shortName: "Empaque Motor DM250",
    category: "motor", unit: "PZA",
    compatibleModels: ["DM250", "CROSSMAX200", "DM200"],
    costPrice: 42.50, stock: 10,
  },
  {
    name: "EMPAQUE DE ESCAPE/GALLETA FT150",
    shortName: "Empaque Escape FT150",
    category: "motor", unit: "PZA",
    compatibleModels: ["FT150"],
    costPrice: 2.00, stock: 20,
  },
  {
    name: "ESCAPE LARGO UNIVERSAL",
    shortName: "Escape Largo Universal",
    category: "motor", unit: "PZA",
    compatibleModels: [],
    costPrice: 26.52, stock: 10,
  },
  // ── TRANSMISIÓN ────────────────────────────────────────────────────────────
  {
    name: "BIRLO DE SPROCKET CARGO150",
    shortName: "Birlo Sprocket Cargo150",
    category: "transmision", unit: "PZA",
    compatibleModels: ["CARGO150"],
    costPrice: 24.34, stock: 5,
  },
  {
    name: "BIRLO DE SPROCKET (DIMORA) FT150/DM200",
    shortName: "Birlo Sprocket DIMORA",
    category: "transmision", unit: "PZA",
    compatibleModels: ["FT150", "DM200"],
    costPrice: 13.30, stock: 10,
  },
  {
    name: "CADENA 428H-136 REFORZADA",
    shortName: "Cadena 428H-136 Reforzada",
    category: "transmision", unit: "PZA",
    compatibleModels: [],
    costPrice: 99.18, stock: 5,
  },
  {
    name: "CANDADO CADENA 428H",
    shortName: "Candado Cadena 428H",
    category: "transmision", unit: "PZA",
    compatibleModels: [],
    costPrice: 46.16, stock: 30,
  },
  {
    name: "CABLE DE EMBRAGUE FT150TS/FT150 GRARITO",
    shortName: "Cable Embrague FT150",
    category: "transmision", unit: "PZA",
    compatibleModels: ["FT150TS", "FT150"],
    costPrice: 22.10, stock: 10,
  },
  {
    name: "CABLE DE EMBRAGUE GRANDE (DIMORA)",
    shortName: "Cable Embrague Grande DIMORA",
    category: "transmision", unit: "PZA",
    compatibleModels: [],
    costPrice: 8.50, stock: 50,
  },
  {
    name: "PASTA DE EMBRAGUE FT125/FT150/150Z/DM200/CARGO150",
    shortName: "Pasta Embrague",
    category: "transmision", unit: "PZA",
    compatibleModels: ["FT125", "FT150", "150Z", "DM200", "CARGO150"],
    costPrice: 93.85, stock: 5,
  },
  {
    name: "PASTA DE EMBRAGUE (DIMORA) FT125/FT150/150Z/DM200",
    shortName: "Pasta Embrague DIMORA",
    category: "transmision", unit: "PZA",
    compatibleModels: ["FT125", "FT150", "150Z", "DM200"],
    costPrice: 46.64, stock: 10,
  },
  {
    name: "MANIJA IZQUIERDA EMBRAGUE (DIMORA) COMPLETA CON BASE UNIVERSAL",
    shortName: "Manija Embrague Universal DIMORA",
    category: "transmision", unit: "PZA",
    compatibleModels: [],
    costPrice: 4.00, stock: 30,
  },
  // Baleros (Rodamientos)
  { name: "BALERO 6003", shortName: "Balero 6003", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 39.57, stock: 10 },
  { name: "BALERO 6004", shortName: "Balero 6004", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 13.63, stock: 10 },
  { name: "BALERO 6005", shortName: "Balero 6005", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 15.00, stock: 10 },
  { name: "BALERO 6202", shortName: "Balero 6202", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 22.11, stock: 10 },
  { name: "BALERO 6203", shortName: "Balero 6203", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 15.00, stock: 10 },
  { name: "BALERO 6204", shortName: "Balero 6204", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 12.82, stock: 10 },
  { name: "BALERO 6205", shortName: "Balero 6205", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 25.00, stock: 10 },
  { name: "BALERO 6300", shortName: "Balero 6300", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 28.35, stock: 10 },
  { name: "BALERO 6301", shortName: "Balero 6301", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 18.75, stock: 10 },
  { name: "BALERO 6302", shortName: "Balero 6302", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 16.50, stock: 10 },
  { name: "BALERO 6303", shortName: "Balero 6303", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 16.50, stock: 10 },
  { name: "BALERO 6304", shortName: "Balero 6304", category: "transmision", unit: "PZA", compatibleModels: [], costPrice: 206.25, stock: 2 },
  // ── SUSPENSIÓN ─────────────────────────────────────────────────────────────
  {
    name: "BUJE DE RIN 4 PZ ECONÓMICO FT150/DM200",
    shortName: "Buje de Rin Económico",
    category: "suspension", unit: "PZA",
    compatibleModels: ["FT150", "DM200"],
    costPrice: 28.24, stock: 5,
  },
  {
    name: "BUJE DE RIN 4 PZ METAL FT150/DM200",
    shortName: "Buje de Rin Metal",
    category: "suspension", unit: "PZA",
    compatibleModels: ["FT150", "DM200"],
    costPrice: 35.53, stock: 5,
  },
  {
    name: "BUJE DE RIN 4 PZ NAYLÓN FT150/DM200",
    shortName: "Buje de Rin Naylón",
    category: "suspension", unit: "PZA",
    compatibleModels: ["FT150", "DM200"],
    costPrice: 34.31, stock: 5,
  },
  {
    name: "PARADOR LATERAL FT125/GL150",
    shortName: "Parador Lateral",
    category: "suspension", unit: "PZA",
    compatibleModels: ["FT125", "GL150"],
    costPrice: 45.37, stock: 10,
  },
  {
    name: "ACEITE BARRA SUSPENSIÓN 250ML",
    shortName: "Aceite Suspensión 250ml",
    category: "suspension", unit: "PZA",
    compatibleModels: [],
    costPrice: 53.16, stock: 6,
  },
  // ── FRENOS ─────────────────────────────────────────────────────────────────
  {
    name: "BALATA (DISCO DIMORA) DELANTERA DM200/DM150/DM250",
    shortName: "Balata Disco Del. DIMORA DM",
    category: "frenos", unit: "PZA",
    compatibleModels: ["DM200", "DM150", "DM250"],
    costPrice: 21.10, stock: 10,
  },
  {
    name: "BALATA (DISCO) DELANTERA DM200/BT200/TORNADO",
    shortName: "Balata Disco Del. DM200/Tornado",
    category: "frenos", unit: "PZA",
    compatibleModels: ["DM200", "BT200", "TORNADO"],
    costPrice: 29.38, stock: 10,
  },
  {
    name: "BALATA (DISCO DIMORA) DELANTERA CB160/AT110",
    shortName: "Balata Disco Del. CB160/AT110",
    category: "frenos", unit: "PZA",
    compatibleModels: ["CB160", "AT110"],
    costPrice: 21.34, stock: 10,
  },
  {
    name: "BALATA (DISCO) DELANTERA PULSAR200/FZ16/FZ2.0/PULSAN160",
    shortName: "Balata Disco Del. Pulsar/FZ",
    category: "frenos", unit: "PZA",
    compatibleModels: ["PULSAR200", "FZ16", "FZ2.0", "PULSAN160"],
    costPrice: 20.69, stock: 10,
  },
  {
    name: "BALATA (DISCO DIMORA) DELANTERA TC200",
    shortName: "Balata Disco Del. TC200",
    category: "frenos", unit: "PZA",
    compatibleModels: ["TC200"],
    costPrice: 26.25, stock: 5,
  },
  {
    name: "BALATA (DISCO DIMORA) DELANTERA GN125",
    shortName: "Balata Disco Del. GN125",
    category: "frenos", unit: "PZA",
    compatibleModels: ["GN125"],
    costPrice: 26.99, stock: 5,
  },
  {
    name: "BALATA (TAMBO DIMORA) FT150TS/DS150/FT125/RC150/RC200",
    shortName: "Balata Tambor FT150TS/RC",
    category: "frenos", unit: "PZA",
    compatibleModels: ["FT150TS", "DS150", "FT125", "RC150", "RC200"],
    costPrice: 40.50, stock: 5,
  },
  {
    name: "BALATA (TAMBO DIMORA) FT150TS/CARGO150/RYDER150 ROJA TRASERA",
    shortName: "Balata Tambor Trasera Roja",
    category: "frenos", unit: "PZA",
    compatibleModels: ["FT150TS", "CARGO150", "RYDER150"],
    costPrice: 40.50, stock: 5,
  },
  {
    name: "BALATA (TAMBO) FT115GTS/FT150GC/FT180",
    shortName: "Balata Tambor FT180",
    category: "frenos", unit: "PZA",
    compatibleModels: ["FT115GTS", "FT150GC", "FT180"],
    costPrice: 39.57, stock: 10,
  },
  {
    name: "LEVA (DIMORA) DE FRENO UNIVERSAL",
    shortName: "Leva Freno Universal",
    category: "frenos", unit: "PZA",
    compatibleModels: [],
    costPrice: 26.52, stock: 5,
  },
  // ── SISTEMA ELÉCTRICO ──────────────────────────────────────────────────────
  {
    name: "BOBINA (DIMORA) FT150/FT125/125Z/DM200",
    shortName: "Bobina DIMORA FT",
    category: "electrico", unit: "PZA",
    compatibleModels: ["FT150", "FT125", "125Z", "DM200"],
    costPrice: 45.90, stock: 5,
  },
  {
    name: "BOBINA FT150/DM200/CROSSMAX200/RYDER150",
    shortName: "Bobina FT150/Crossmax",
    category: "electrico", unit: "PZA",
    compatibleModels: ["FT150", "DM200", "CROSSMAX200", "RYDER150"],
    costPrice: 47.54, stock: 5,
  },
  {
    name: "FOCO (DIMORA) H4 LED DOBLE",
    shortName: "Foco H4 LED Doble DIMORA",
    category: "electrico", unit: "PZA",
    compatibleModels: [],
    costPrice: 93.30, stock: 5,
  },
  {
    name: "FOCO (DIMORA) H4 LED",
    shortName: "Foco H4 LED DIMORA",
    category: "electrico", unit: "PZA",
    compatibleModels: [],
    costPrice: 35.70, stock: 10,
  },
  {
    name: "CDI DS125/DS150",
    shortName: "CDI DS125/DS150",
    category: "electrico", unit: "PZA",
    compatibleModels: ["DS125", "DS150"],
    costPrice: 64.00, stock: 5,
  },
  {
    name: "CDI DS125/DS150/DM200/DM250X/MOTONETA",
    shortName: "CDI DM200/DM250X",
    category: "electrico", unit: "PZA",
    compatibleModels: ["DS125", "DS150", "DM200", "DM250X"],
    costPrice: 45.00, stock: 5,
  },
  {
    name: "CDI DS125/DM250X",
    shortName: "CDI DS125/DM250X",
    category: "electrico", unit: "PZA",
    compatibleModels: ["DS125", "DM250X"],
    costPrice: 48.00, stock: 4,
  },
  {
    name: "CARGADOR (DIMORA) USB",
    shortName: "Cargador USB DIMORA",
    category: "electrico", unit: "PZA",
    compatibleModels: [],
    costPrice: 60.00, stock: 10,
  },
  // ── NEUMÁTICOS ─────────────────────────────────────────────────────────────
  {
    name: "CAMARA 120/80-18 Y 4.10-18",
    shortName: "Cámara 120/80-18",
    category: "neumaticos", unit: "PZA",
    compatibleModels: [],
    costPrice: 50.96, stock: 10,
  },
  {
    name: "CAMARA 130/70-17 Y 4.50-17",
    shortName: "Cámara 130/70-17",
    category: "neumaticos", unit: "PZA",
    compatibleModels: [],
    costPrice: 47.15, stock: 20,
  },
  {
    name: "CAMARA 3.00/2.75-17",
    shortName: "Cámara 3.00/2.75-17",
    category: "neumaticos", unit: "PZA",
    compatibleModels: [],
    costPrice: 31.99, stock: 20,
  },
  {
    name: "CAMARA 3.00/2.75-18",
    shortName: "Cámara 3.00/2.75-18",
    category: "neumaticos", unit: "PZA",
    compatibleModels: [],
    costPrice: 31.99, stock: 10,
  },
  // ── LUBRICANTES ────────────────────────────────────────────────────────────
  {
    name: "ACEITE MOTUL 3000 MINERAL 20W-50 4T",
    shortName: "Aceite Motul 3000 Mineral",
    category: "lubricantes", unit: "LT",
    compatibleModels: [],
    costPrice: 155.00, stock: 10,
  },
  {
    name: "ACEITE MOTUL 5000 SEMISINTÉTICO 20W-50 4T",
    shortName: "Aceite Motul 5000 Semisintético",
    category: "lubricantes", unit: "LT",
    compatibleModels: [],
    costPrice: 155.00, stock: 9,
  },
  {
    name: "ACEITE AKRON MINERAL 20W-50 4T",
    shortName: "Aceite Akron Mineral",
    category: "lubricantes", unit: "LT",
    compatibleModels: [],
    costPrice: 86.99, stock: 25,
  },
  // ── CARROCERÍA ─────────────────────────────────────────────────────────────
  {
    name: "GOMA DE IMPACTO GEL CARGO150/GL150/80XER150/CB160",
    shortName: "Goma Impacto Gel",
    category: "carroceria", unit: "PZA",
    compatibleModels: ["CARGO150", "GL150", "80XER150", "CB160"],
    costPrice: 59.20, stock: 5,
  },
  {
    name: "GOMA TAPA UNIVERSAL",
    shortName: "Goma Tapa",
    category: "carroceria", unit: "PZA",
    compatibleModels: [],
    costPrice: 3.11, stock: 30,
  },
  // ── ENCENDIDO ──────────────────────────────────────────────────────────────
  {
    name: "BUJÍA C7 NCK",
    shortName: "Bujía C7 NCK",
    category: "encendido", unit: "PZA",
    compatibleModels: [],
    costPrice: 32.50, stock: 10,
  },
  // ── ACCESORIOS ─────────────────────────────────────────────────────────────
  {
    name: "PORTA EQUIPE CUADRADO 60L PLATIADA",
    shortName: "Portaequipaje 60L Platiado",
    category: "accesorios", unit: "PZA",
    compatibleModels: [],
    costPrice: 1255.55, stock: 1,
  },
  // ── HERRAMIENTAS ───────────────────────────────────────────────────────────
  {
    name: "ESPATULA - PALANCA CON MANGO (DIMORA)",
    shortName: "Espátula Palanca DIMORA",
    category: "herramientas", unit: "PZA",
    compatibleModels: [],
    costPrice: 35.00, stock: 2,
  },
  {
    name: "KIT REPARACIÓN SELLOMÁTICA (DIMORA)",
    shortName: "Kit Reparación Sellomática",
    category: "herramientas", unit: "PZA",
    compatibleModels: [],
    costPrice: 45.00, stock: 4,
  },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function getOrCreateCounter(name: string): Promise<number> {
  const ref = db.collection("_counters").doc(name);
  const snap = await ref.get();
  return snap.exists ? (snap.data()?.count ?? 0) : 0;
}

async function seed() {
  console.log("🏍️  SPM Seed — MotoCruz (Nota de Venta #239)");
  console.log("=".repeat(50));

  // ── 1. Crear proveedor MotoCruz ─────────────────────────────────────────────
  console.log("\n[1/3] Creando proveedor MotoCruz...");

  const vendorQuery = await db.collection("vendors")
    .where("rfc", "==", "VEYR0104013G5").limit(1).get();

  let vendorId: string;
  let vendorFirestoreId: string;

  if (!vendorQuery.empty) {
    const existing = vendorQuery.docs[0];
    vendorFirestoreId = existing.id;
    vendorId = existing.data().vendorId;
    console.log(`   ✓ Ya existe: ${vendorId} (${vendorFirestoreId})`);
  } else {
    const counterRef = db.collection("_counters").doc("vendors");
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const count = (snap.data()?.count ?? 0) + 1;
      vendorId = `PROV-${String(count).padStart(4, "0")}`;
      tx.set(counterRef, { count }, { merge: true });
    });

    const ref = await db.collection("vendors").add({
      vendorId: vendorId!,
      name: "MotoCruz",
      rfc: "VEYR0104013G5",
      contactName: "Rosa Isela Velez Yerbes",
      phone: "8136340082",
      email: "motocruz417@gmail.com",
      address: {
        street: "Heriberto Castillo 480",
        colonia: "Centro",
        city: "García",
        state: "Nuevo León",
        zip: "66000",
      },
      notes: "Proveedor principal mayorista. Número de proveedor interno: 1004.",
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    vendorFirestoreId = ref.id;
    console.log(`   ✓ Creado: ${vendorId!} (${vendorFirestoreId})`);
  }

  // ── 2. Crear productos ──────────────────────────────────────────────────────
  console.log(`\n[2/3] Importando ${PRODUCTS.length} productos...`);

  let productCount = await getOrCreateCounter("products");
  const productIds: string[] = [];
  let created = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    // Verificar si ya existe por nombre exacto
    const exists = await db.collection("products")
      .where("name", "==", p.name).limit(1).get();

    if (!exists.empty) {
      console.log(`   ~ Ya existe: ${p.shortName}`);
      productIds.push(exists.docs[0].id);
      skipped++;
      continue;
    }

    productCount++;
    const sku = `PRD-${String(productCount).padStart(5, "0")}`;

    const ref = await db.collection("products").add({
      sku,
      name: p.name,
      shortName: p.shortName,
      category: p.category,
      unit: p.unit,
      compatibleModels: p.compatibleModels,
      vendorId: vendorFirestoreId,
      vendorSku: null,
      costPrice: p.costPrice,
      salePrice: salePrice(p.costPrice),
      stock: p.stock,
      minStock: minStock(p.costPrice),
      imageUrls: [],
      isActive: true,
      isFeatured: false,
      tags: [p.category],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Actualizar contador
    await db.collection("_counters").doc("products").set(
      { count: productCount }, { merge: true }
    );

    productIds.push(ref.id);
    console.log(`   + ${sku} · ${p.shortName} · costo $${p.costPrice} · venta $${salePrice(p.costPrice)}`);
    created++;
  }

  console.log(`   Resumen: ${created} creados, ${skipped} ya existían.`);

  // ── 3. Crear orden de compra inicial ────────────────────────────────────────
  console.log("\n[3/3] Registrando Orden de Compra inicial (Nota de Venta #239)...");

  const ocExists = await db.collection("purchase_orders")
    .where("invoiceRef", "==", "NV-239-MOTOCRUZ-20260421").limit(1).get();

  if (!ocExists.empty) {
    console.log(`   ~ Orden de compra ya existe: ${ocExists.docs[0].data().orderId}`);
  } else {
    const counterRef = db.collection("_counters").doc("purchase_orders");
    let orderId = "";
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const count = (snap.data()?.count ?? 0) + 1;
      orderId = `OC-2026-${String(count).padStart(4, "0")}`;
      tx.set(counterRef, { count }, { merge: true });
    });

    // Construir items de la OC a partir de los productos
    const productSnaps = productIds.length > 0
      ? await Promise.all(productIds.map((id) => db.collection("products").doc(id).get()))
      : [];

    const ocItems = PRODUCTS.map((p, i) => {
      const snap = productSnaps[i];
      return {
        productId: snap?.id ?? null,
        productName: p.name,
        sku: snap?.data()?.sku ?? null,
        unit: p.unit,
        qty: p.stock,
        unitCost: p.costPrice,
        total: Math.round(p.stock * p.costPrice * 100) / 100,
        receivedQty: p.stock,
      };
    });

    const totalAmount = ocItems.reduce((sum, item) => sum + item.total, 0);

    await db.collection("purchase_orders").add({
      orderId,
      vendorId: vendorFirestoreId,
      vendorName: "MotoCruz",
      items: ocItems,
      subtotal: Math.round(totalAmount * 100) / 100,
      total: Math.round(totalAmount * 100) / 100,
      status: "recibida-completa",
      invoiceRef: "NV-239-MOTOCRUZ-20260421",
      notes: "Nota de Venta #239 del 21/04/2026. Inventario inicial importado por seed script.",
      receivedAt: Timestamp.fromDate(new Date("2026-04-21")),
      createdBy: "seed-script",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`   ✓ Creada: ${orderId} · Total: $${Math.round(totalAmount * 100) / 100} MXN`);
  }

  // ── Movimientos de inventario inicial ───────────────────────────────────────
  if (created > 0) {
    console.log("\n   Registrando movimientos de inventario inicial...");
    let movCount = 0;
    for (let i = 0; i < PRODUCTS.length; i++) {
      const p = PRODUCTS[i];
      if (p.stock <= 0) continue;
      const productDocId = productIds[i];
      if (!productDocId) continue;

      const productSnap = await db.collection("products").doc(productDocId).get();
      if (!productSnap.exists) continue;

      await db.collection("inventory_movements").add({
        productId: productDocId,
        productName: p.name,
        type: "compra",
        qty: p.stock,
        stockBefore: 0,
        stockAfter: p.stock,
        unitCost: p.costPrice,
        reference: "NV-239-MOTOCRUZ-20260421",
        note: "Stock inicial — Nota de Venta #239 MotoCruz 21/04/2026",
        createdBy: "seed-script",
        createdAt: FieldValue.serverTimestamp(),
      });
      movCount++;
    }
    console.log(`   ✓ ${movCount} movimientos de entrada registrados.`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Seed completado exitosamente.");
  console.log(`   Proveedor : MotoCruz (${vendorId!})`);
  console.log(`   Productos : ${created} nuevos / ${skipped} ya existían`);
  console.log(`   Inventario: ${PRODUCTS.reduce((s, p) => s + p.stock, 0)} unidades totales`);
  console.log("=".repeat(50));
}

seed().catch((err) => {
  console.error("❌ Seed falló:", err);
  process.exit(1);
});
