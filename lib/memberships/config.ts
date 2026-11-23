/**
 * Membresías de mantenimiento — configuración de precios y cálculo.
 *
 * Cada servicio tiene [costo de refacción con proveedor (MXN), horas de mano de obra]
 * por clase 1–5. El precio al cliente se calcula así:
 *   refacción  = costo de proveedor × (1 + partsMarkup)          → +70%
 *   mano de obra = horas × tarifa de mercado por hora × (1 + laborMarkup) → +15%
 * La tarifa de mercado es la de talleres de motos independientes del área
 * metropolitana de Monterrey (San Pedro, Monterrey, San Nicolás, Guadalupe,
 * Apodaca, Santa Catarina, Escobedo; radio de 25–32 km), por clase:
 *   1 = chica (≤150 cc) · 2 = mediana (150–400) · 3 = media-alta (400–700)
 *   4 = grande (700–1000) · 5 = superbike / turbo / premium grande
 *
 * Edita aquí precios, descuentos y frecuencias recomendadas.
 */

export type VehicleTypeId = "scooter" | "trabajo" | "deportiva" | "premium" | "dirt" | "atv" | "utv";
export type UsageId = "trabajo" | "recreativo" | "competencia";
export type BillingId = "weekly" | "monthly" | "annual";
export type ServiceId =
  | "aceite" | "afinacion" | "cvt" | "cadena" | "final" | "frenos" | "refrigerante" | "valvulas"
  | "suspension" | "diferencial" | "engrase" | "topend" | "llantas" | "bateria" | "diagnostico" | "lavado";
export type PerkId = "express" | "ruta" | "remolque" | "parada" | "prerodada" | "refa";
type Cls = 1 | 2 | 3 | 4 | 5;
type Freq3 = [number, number, number];

export interface VehicleRange { label: string; note?: string; cls: Cls; maxCc: number }
export interface VehicleType {
  id: VehicleTypeId; icon: string; name: string; ex: string; wheels: 2 | 4;
  mult: { p: number; l: number }; ranges: VehicleRange[]; items: ServiceId[];
}
/** p: por clase 1–5, [costo de refacción con proveedor en MXN, horas de mano de obra] */
export interface ServiceDef { name: string; name4?: string; desc: string; p: [number, number][]; def: Freq3 }
export interface PerkDef { id: PerkId; name: string; base: number; desc: string; types: "all" | VehicleTypeId[] }

export const MEMBERSHIP_CONFIG = {
  whatsapp: "528133880010",
  memberLaborOff: 0.2,
  memberPartsOff: 0.1,
  weeklyOff: 0.08,
  annualOff: 0.15,          // descuento por pagar el año completo por adelantado
  /** Tarifa de mercado por hora (MXN) en talleres de motos del área metro de Monterrey, por clase. */
  laborRate: { 1: 280, 2: 300, 3: 340, 4: 400, 5: 460 } as Record<Cls, number>,
  laborMarkup: 0.15,        // +15% sobre la tarifa de mercado
  partsMarkup: 0.7,         // +70% sobre el costo de proveedor
  fleet: [{ min: 5, off: 0.1 }, { min: 3, off: 0.05 }],
  perkMult: { 1: 1, 2: 1.1, 3: 1.3, 4: 1.6, 5: 2 } as Record<Cls, number>,
};

export const VEHICLE_TYPES: VehicleType[] = [
  { id: "scooter", icon: "🛵", name: "Motoneta / Scooter", ex: "Italika D150, Yamaha NMax, Honda PCX, Vespa", wheels: 2,
    mult: { p: 1, l: 1 },
    ranges: [{ label: "50–125 cc", cls: 1, maxCc: 125 }, { label: "126–200 cc", cls: 2, maxCc: 200 }, { label: "201–400 cc", note: "Maxi scooter", cls: 3, maxCc: 400 }],
    items: ["aceite", "afinacion", "cvt", "frenos", "refrigerante", "llantas", "bateria", "diagnostico", "lavado"] },
  { id: "trabajo", icon: "📦", name: "Moto de trabajo / urbana", ex: "Italika FT150, Honda Cargo, Pulsar NS200, Vento", wheels: 2,
    mult: { p: 1, l: 1 },
    ranges: [{ label: "110–150 cc", cls: 1, maxCc: 150 }, { label: "151–250 cc", cls: 2, maxCc: 250 }, { label: "251–400 cc", cls: 3, maxCc: 400 }],
    items: ["aceite", "afinacion", "cadena", "frenos", "suspension", "valvulas", "refrigerante", "llantas", "bateria", "lavado"] },
  { id: "deportiva", icon: "🏍️", name: "Deportiva / Naked", ex: "Yamaha R6/R1/MT, Kawasaki Ninja/Z, Suzuki GSX-R/GSX-S, Honda CBR", wheels: 2,
    mult: { p: 1, l: 1 },
    ranges: [{ label: "250–400 cc", cls: 2, maxCc: 400 }, { label: "401–700 cc", cls: 3, maxCc: 700 }, { label: "701–1000 cc", cls: 4, maxCc: 1000 }, { label: "Más de 1000 cc", cls: 5, maxCc: 99999 }],
    items: ["aceite", "afinacion", "cadena", "frenos", "refrigerante", "valvulas", "suspension", "llantas", "bateria", "diagnostico", "lavado"] },
  { id: "premium", icon: "💎", name: "Premium europea / americana", ex: "BMW S1000RR, GS, RT · Ducati · KTM · Triumph · Harley-Davidson", wheels: 2,
    mult: { p: 1.3, l: 1.25 },
    ranges: [{ label: "300–500 cc", cls: 2, maxCc: 500 }, { label: "501–900 cc", cls: 3, maxCc: 900 }, { label: "901–1100 cc", cls: 4, maxCc: 1100 }, { label: "Más de 1100 cc", cls: 5, maxCc: 99999 }],
    items: ["aceite", "afinacion", "cadena", "final", "frenos", "refrigerante", "valvulas", "suspension", "llantas", "bateria", "diagnostico", "lavado"] },
  { id: "dirt", icon: "⛰️", name: "Dirt bike / Motocross / Enduro", ex: "Honda CRF, Yamaha YZ, KTM SX/EXC, Kawasaki KX", wheels: 2,
    mult: { p: 1, l: 1 },
    ranges: [{ label: "50–110 cc", note: "Infantil", cls: 1, maxCc: 110 }, { label: "125–250 cc", cls: 2, maxCc: 250 }, { label: "251–450 cc", cls: 3, maxCc: 450 }, { label: "Más de 450 cc", cls: 4, maxCc: 99999 }],
    items: ["aceite", "afinacion", "cadena", "frenos", "refrigerante", "valvulas", "suspension", "topend", "llantas", "lavado"] },
  { id: "atv", icon: "🛞", name: "Cuatrimoto / ATV", ex: "Polaris Sportsman, Can-Am Outlander, Honda FourTrax, Yamaha Raptor", wheels: 4,
    mult: { p: 1, l: 1.05 },
    ranges: [{ label: "50–150 cc", cls: 1, maxCc: 150 }, { label: "151–400 cc", cls: 2, maxCc: 400 }, { label: "401–700 cc", cls: 3, maxCc: 700 }, { label: "701–1000 cc", cls: 4, maxCc: 1000 }],
    items: ["aceite", "afinacion", "cvt", "cadena", "frenos", "refrigerante", "valvulas", "suspension", "diferencial", "engrase", "llantas", "bateria", "lavado"] },
  { id: "utv", icon: "🏜️", name: "Side by Side / UTV / RZR", ex: "Polaris RZR y Ranger, Can-Am Maverick, Honda Talon", wheels: 4,
    mult: { p: 1.1, l: 1.15 },
    ranges: [{ label: "200 cc", note: "Juvenil", cls: 2, maxCc: 250 }, { label: "500–900 cc", cls: 3, maxCc: 900 }, { label: "901–1000 cc", cls: 4, maxCc: 1000 }, { label: "Turbo / Pro R", cls: 5, maxCc: 99999 }],
    items: ["aceite", "afinacion", "cvt", "frenos", "refrigerante", "valvulas", "suspension", "diferencial", "engrase", "llantas", "bateria", "diagnostico", "lavado"] },
];

export const USAGES: { id: UsageId; name: string; note: string }[] = [
  { id: "trabajo", name: "Trabajo diario", note: "Reparto, mensajería, rancho, obra" },
  { id: "recreativo", name: "Recreativo", note: "Paseo, rodadas, fines de semana" },
  { id: "competencia", name: "Pista / Competencia", note: "Track days, motocross, dunas" },
];

export const SERVICES: Record<ServiceId, ServiceDef> = {
  aceite:       { name: "Cambio de aceite y filtro", desc: "Aceite semisintético o sintético según tu motor, filtro de aceite y revisión de niveles.",
                  p: [[170, 0.5], [270, 0.6], [490, 0.75], [840, 0.9], [1240, 1]], def: [12, 3, 8] },
  afinacion:    { name: "Afinación", desc: "Bujía(s), filtro de aire, limpieza de inyección o carburador y ajuste de ralentí.",
                  p: [[160, 1], [290, 1.25], [580, 1.75], [1170, 2.5], [1690, 3]], def: [3, 1, 2] },
  cvt:          { name: "Banda CVT y clutch", desc: "Banda nueva, revisión de rodillos o variador y limpieza del clutch.",
                  p: [[290, 1], [520, 1.25], [1040, 1.5], [1880, 2], [2470, 2.5]], def: [2, 1, 2] },
  cadena:       { name: "Kit de arrastre", desc: "Cadena, catarina y piñón nuevos, instalados y tensados.",
                  p: [[460, 0.75], [840, 1], [1560, 1], [2920, 1.25], [6180, 1.5]], def: [2, 1, 2] },
  final:        { name: "Cardán / transmisión final", desc: "Aceite del cardán (BMW boxer, GS, RT) o revisión de banda (Harley).",
                  p: [[130, 0.75], [200, 0.75], [290, 1], [390, 1], [520, 1.25]], def: [1, 1, 1] },
  frenos:       { name: "Frenos completos", desc: "Balatas delanteras y traseras, purga y líquido de frenos DOT 4.",
                  p: [[200, 0.75], [320, 1], [580, 1], [1040, 1.25], [1690, 1.5]], def: [3, 1, 3] },
  refrigerante: { name: "Sistema de enfriamiento", desc: "Refrigerante nuevo, purga y revisión de radiador y mangueras. Solo motores enfriados por líquido.",
                  p: [[130, 0.5], [160, 0.75], [230, 0.75], [320, 1], [460, 1]], def: [1, 1, 2] },
  valvulas:     { name: "Ajuste de válvulas", desc: "Revisión de holguras y ajuste con calzas o tornillo. Incluye empaque de tapa.",
                  p: [[0, 1.5], [100, 2.5], [200, 4], [390, 5.5], [580, 7]], def: [0, 0, 2] },
  suspension:   { name: "Suspensión", desc: "Aceite de barras y retenes nuevos; revisión de amortiguadores y bujes.",
                  p: [[230, 1.5], [360, 2], [520, 2.5], [780, 3], [1170, 4]], def: [0, 1, 2] },
  diferencial:  { name: "Diferenciales y transmisión", desc: "Aceite de diferencial delantero, trasero y caja de cambios.",
                  p: [[200, 0.75], [260, 1], [460, 1.25], [650, 1.5], [910, 2]], def: [2, 1, 2] },
  engrase:      { name: "Engrase de chasis y crucetas", desc: "Engrase de rótulas, crucetas y juntas homocinéticas; revisión de botas.",
                  p: [[40, 0.5], [50, 0.75], [80, 1], [100, 1], [130, 1.25]], def: [6, 3, 6] },
  topend:       { name: "Top end (pistón y anillos)", desc: "Pistón, anillos, perno y empaques. Clave en 2 tiempos y motocross.",
                  p: [[580, 3.5], [1430, 5], [2280, 7], [3120, 8], [3900, 9]], def: [0, 0, 1] },
  llantas:      { name: "Par de llantas", name4: "Juego de 4 llantas", desc: "Llantas de rango medio con montaje, balanceo y válvulas.",
                  p: [[910, 1], [1430, 1], [2920, 1.25], [4880, 1.25], [6180, 1.5]], def: [0, 0, 1] },
  bateria:      { name: "Batería", desc: "Batería nueva de gel o AGM, instalada y con prueba de carga.",
                  p: [[390, 0.25], [580, 0.25], [910, 0.3], [1430, 0.4], [2080, 0.5]], def: [0, 0, 0] },
  diagnostico:  { name: "Diagnóstico por escáner", desc: "Lectura de códigos y sensores; reinicio del indicador de servicio.",
                  p: [[0, 0.5], [0, 0.75], [0, 1], [0, 1], [0, 1.25]], def: [2, 1, 2] },
  lavado:       { name: "Lavado y detallado", desc: "Lavado a presión, desengrase de motor y cadena, encerado.",
                  p: [[20, 0.4], [30, 0.5], [50, 0.6], [60, 0.75], [80, 1]], def: [0, 2, 4] },
};

/** Frecuencias recomendadas distintas por tipo: [trabajo, recreativo, competencia] */
const OVERRIDES: Partial<Record<VehicleTypeId, Partial<Record<ServiceId, Freq3>>>> = {
  scooter:   { aceite: [6, 3, 6] },
  deportiva: { aceite: [4, 2, 6], cadena: [1, 1, 2] },
  premium:   { aceite: [3, 2, 6], cadena: [1, 0, 2], valvulas: [0, 0, 1] },
  dirt:      { aceite: [6, 4, 10], afinacion: [4, 2, 6], cadena: [2, 1, 3], valvulas: [1, 1, 2], topend: [0, 0, 1], llantas: [1, 1, 2] },
  atv:       { aceite: [4, 2, 6], cadena: [0, 0, 1], llantas: [0, 0, 1] },
  utv:       { aceite: [4, 2, 6], cvt: [2, 1, 3], llantas: [0, 0, 1] },
};

export const PERKS: PerkDef[] = [
  { id: "express", name: "Express prioritario", base: 69, desc: "Pasas primero. Cambio de aceite en 60 min o el siguiente es gratis.", types: "all" },
  { id: "ruta", name: "Asistencia en ruta", base: 149, desc: "Ponchadura, paso de corriente o gasolina en la zona metro.", types: ["scooter", "trabajo", "deportiva", "premium"] },
  { id: "remolque", name: "Recolección con remolque", base: 249, desc: "Pasamos por tu vehículo y te lo regresamos listo. 2 viajes al mes en zona metro.", types: ["deportiva", "premium", "dirt", "atv", "utv"] },
  { id: "parada", name: "Protección Moto Parada", base: 129, desc: "Te pagamos $300 por cada día en taller después de 24 h.", types: ["scooter", "trabajo"] },
  { id: "prerodada", name: "Revisión pre-rodada ilimitada", base: 99, desc: "Revisión de 21 puntos antes de cada rodada, viaje o carrera.", types: ["deportiva", "premium", "dirt", "atv", "utv"] },
  { id: "refa", name: "15% en refacciones extra", base: 59, desc: "Descuento en piezas y accesorios fuera de tu paquete.", types: "all" },
];

/* ───────────────────────── cálculo ───────────────────────── */

export interface BuilderState {
  type: VehicleTypeId;
  range: number;
  usage: UsageId;
  freq: Partial<Record<ServiceId, number>>;
  perks: PerkId[];
  parts: boolean;
  units: number;
  billing: BillingId;
  model: string;
}

const r10 = (n: number) => Math.round(n / 10) * 10;

export const getType = (id: VehicleTypeId) => VEHICLE_TYPES.find(t => t.id === id) ?? VEHICLE_TYPES[0];
export const getRange = (s: Pick<BuilderState, "type" | "range">) => {
  const t = getType(s.type);
  return t.ranges[s.range] ?? t.ranges[0];
};

/** Índice de cilindrada que corresponde a los cc del vehículo. */
export function rangeIndexForCc(type: VehicleTypeId, cc?: number): number {
  const ranges = getType(type).ranges;
  if (!cc) return 0;
  const i = ranges.findIndex(r => cc <= r.maxCc);
  return i === -1 ? ranges.length - 1 : i;
}

export function serviceName(id: ServiceId, type: VehicleTypeId): string {
  const sv = SERVICES[id];
  return id === "llantas" && getType(type).wheels === 4 && sv.name4 ? sv.name4 : sv.name;
}

export function unitPrice(id: ServiceId, s: Pick<BuilderState, "type" | "range">) {
  const t = getType(s.type);
  const cls = getRange(s).cls;
  const C = MEMBERSHIP_CONFIG;
  const [cost, hours] = SERVICES[id].p[cls - 1];
  let p = cost * (1 + C.partsMarkup) * t.mult.p;
  let l = hours * C.laborRate[cls] * (1 + C.laborMarkup) * t.mult.l;
  if (id === "llantas" && t.wheels === 4) { p *= 2; l *= 2; }
  return { p: r10(p), l: r10(l) };
}

export function defaultFreq(id: ServiceId, type: VehicleTypeId, usage: UsageId): number {
  const u = USAGES.findIndex(x => x.id === usage);
  const o = OVERRIDES[type]?.[id];
  return (o ?? SERVICES[id].def)[u];
}

export function recommendedFreq(type: VehicleTypeId, usage: UsageId): Partial<Record<ServiceId, number>> {
  const out: Partial<Record<ServiceId, number>> = {};
  getType(type).items.forEach(id => { out[id] = defaultFreq(id, type, usage); });
  return out;
}

export const availablePerks = (type: VehicleTypeId) =>
  PERKS.filter(p => p.types === "all" || p.types.includes(type));

export const perkPrice = (p: PerkDef, s: Pick<BuilderState, "type" | "range">) =>
  r10(p.base * MEMBERSHIP_CONFIG.perkMult[getRange(s).cls]);

export interface MembershipLine { id: ServiceId; name: string; n: number; parts: number; labor: number }
export interface MembershipQuote {
  lines: MembershipLine[];
  partsYr: number; laborYr: number; list: number; member: number; memberSave: number;
  perks: { id: PerkId; name: string; price: number }[]; perksYr: number;
  perUnitYr: number; fleetOff: number; fleetSave: number;
  year: number; monthly: number; weekly: number; yearWeekly: number; annual: number;
}

export function calcMembership(s: BuilderState): MembershipQuote {
  const C = MEMBERSHIP_CONFIG;
  const lines: MembershipLine[] = [];
  let partsYr = 0, laborYr = 0;
  getType(s.type).items.forEach(id => {
    const n = s.freq[id] ?? 0;
    if (!n) return;
    const u = unitPrice(id, s);
    const parts = s.parts ? u.p * n : 0, labor = u.l * n;
    partsYr += parts; laborYr += labor;
    lines.push({ id, name: serviceName(id, s.type), n, parts, labor });
  });
  const list = partsYr + laborYr;
  const member = partsYr * (1 - C.memberPartsOff) + laborYr * (1 - C.memberLaborOff);
  const perks = availablePerks(s.type)
    .filter(p => s.perks.includes(p.id))
    .map(p => ({ id: p.id, name: p.name, price: perkPrice(p, s) }));
  const perksYr = perks.reduce((a, p) => a + p.price * 12, 0);
  const perUnitYr = member + perksYr;
  const fleetOff = (C.fleet.find(f => s.units >= f.min) ?? { off: 0 }).off;
  const year = perUnitYr * s.units * (1 - fleetOff);
  const weekly = (year / 52) * (1 - C.weeklyOff);
  return {
    lines, partsYr, laborYr, list, member, memberSave: list - member, perks, perksYr, perUnitYr,
    fleetOff, fleetSave: perUnitYr * s.units * fleetOff, year, monthly: year / 12, weekly, yearWeekly: weekly * 52,
    annual: year * (1 - C.annualOff),
  };
}

/** Cuánto paga el cliente según la forma de pago elegida. */
export function billingView(q: MembershipQuote, billing: BillingId) {
  if (billing === "weekly") {
    return { pay: q.weekly, total: q.yearWeekly, count: 52, per: "semana", perShort: "sem", label: "semanal" };
  }
  if (billing === "annual") {
    return { pay: q.annual, total: q.annual, count: 1, per: "año", perShort: "año", label: "anual" };
  }
  return { pay: q.monthly, total: q.year, count: 12, per: "mes", perShort: "mes", label: "mensual" };
}

export const periodName = (billing: BillingId) => (billing === "weekly" ? "semana" : billing === "annual" ? "año" : "mes");

export const fmtMXN = (n: number) => "$" + Math.round(n).toLocaleString("es-MX");
