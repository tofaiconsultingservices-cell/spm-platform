"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  VEHICLE_TYPES, USAGES, SERVICES, MEMBERSHIP_CONFIG,
  getType, getRange, serviceName, unitPrice, defaultFreq, recommendedFreq, rangeIndexForCc,
  availablePerks, perkPrice, calcMembership, fmtMXN,
  type BuilderState, type ServiceId, type PerkId, type VehicleTypeId, type UsageId, type MembershipQuote,
} from "@/lib/memberships/config";
import { createMembership, subscribeMyMemberships, type Membership } from "@/lib/firestore/memberships";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import VehicleForm from "@/components/portal/VehicleForm";
import type { Motorcycle } from "@/types";
import { ArrowLeft, Loader2, Minus, Plus, Check, MessageCircle, BadgeCheck, Clock, Bike } from "lucide-react";

const INITIAL: BuilderState = {
  type: "trabajo", range: 0, usage: "trabajo", freq: recommendedFreq("trabajo", "trabajo"),
  perks: [], parts: true, units: 1, billing: "weekly", model: "",
};

function summaryText(s: BuilderState, q: MembershipQuote, name: string, id?: string): string {
  const t = getType(s.type);
  const w = s.billing === "weekly";
  const out = [
    `Hola San Pedro Moto Care, solicité mi membresía${id ? ` (folio ${id.slice(0, 6).toUpperCase()})` : ""}:`,
    `• Cliente: ${name}`,
    `• Vehículo: ${t.name}, ${getRange(s).label}${s.model ? ` (${s.model})` : ""}`,
    `• Uso: ${USAGES.find(u => u.id === s.usage)?.name}`,
    `• Unidades: ${s.units}`,
    `• Refacciones: ${s.parts ? "incluidas" : "solo mano de obra"}`,
    "• Servicios al año:",
    ...q.lines.map(l => `   - ${l.name} ×${l.n}`),
  ];
  if (q.perks.length) out.push(`• Beneficios: ${q.perks.map(p => p.name).join(", ")}`);
  out.push(`• Pago: ${w ? `semanal, ${fmtMXN(q.weekly)} por semana (52 pagos)` : `mensual, ${fmtMXN(q.monthly)} por mes (12 pagos)`}`);
  out.push(`• Total 12 meses: ${fmtMXN(w ? q.yearWeekly : q.year)}`);
  return out.join("\n");
}

const STATUS_UI: Record<Membership["status"], { label: string; cls: string }> = {
  pendiente: { label: "Pendiente de activar", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  activa:    { label: "Activa",               cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelada: { label: "Cancelada",            cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

export default function MembresiasPage() {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();

  const [s, setS] = useState<BuilderState>(INITIAL);
  const [mine, setMine] = useState<Membership[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [building, setBuilding] = useState(true);
  const [motos, setMotos] = useState<Motorcycle[]>([]);
  const [motosLoaded, setMotosLoaded] = useState(false);
  const [motoId, setMotoId] = useState<string | null>(null);
  const [addingMoto, setAddingMoto] = useState(false);

  /** Al elegir un vehículo registrado se llenan tipo, cilindrada, uso y modelo. */
  function selectMoto(m: Motorcycle) {
    setMotoId(m.id);
    setS(p => {
      const type = m.vehicleType ?? p.type;
      const usage = m.usage ?? p.usage;
      return {
        ...p, type, usage,
        range: m.vehicleType ? rangeIndexForCc(type, m.cilindrada) : p.range,
        freq: recommendedFreq(type, usage),
        model: `${m.brand} ${m.model} ${m.year}`.trim(),
        perks: p.perks.filter(id => availablePerks(type).some(x => x.id === id)),
      };
    });
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/login?modo=registro&from=/portal/membresias");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    let first = true;
    return subscribeMyMemberships(user.uid, list => {
      setMine(list);
      // Solo en la primera carga: si ya tiene membresía, mostrarla en vez del armador
      if (first && list.some(m => m.status !== "cancelada")) setBuilding(false);
      first = false;
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let first = true;
    const qy = query(collection(getDb(), "motorcycles"), where("clientId", "==", user.uid));
    return onSnapshot(qy, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Motorcycle);
      setMotos(list);
      setMotosLoaded(true);
      if (first && list.length) selectMoto(list[0]);
      first = false;
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = useMemo(() => calcMembership(s), [s]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--color-spm-red)]" />
      </div>
    );
  }

  const t = getType(s.type);
  const w = s.billing === "weekly";
  const pay = w ? q.weekly : q.monthly;

  const card = `rounded-2xl border ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`;
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const strong = isDark ? "text-white" : "text-slate-900";
  const opt = (on: boolean) =>
    `rounded-xl border px-3 py-3 text-sm font-semibold text-center transition-all ${
      on
        ? "bg-[var(--color-spm-red)] border-[var(--color-spm-red)] text-white"
        : isDark ? "bg-slate-900 border-white/10 text-slate-200 hover:border-[var(--color-spm-red-light)]"
                 : "bg-white border-gray-200 text-slate-700 hover:border-[var(--color-spm-red-light)]"
    }`;

  const setType = (type: VehicleTypeId) =>
    setS(p => ({ ...p, type, range: 0, freq: recommendedFreq(type, p.usage),
      perks: p.perks.filter(id => availablePerks(type).some(x => x.id === id)) }));
  const setUsage = (usage: UsageId) => setS(p => ({ ...p, usage, freq: recommendedFreq(p.type, usage) }));
  const bump = (id: ServiceId, d: number) =>
    setS(p => ({ ...p, freq: { ...p.freq, [id]: Math.min(24, Math.max(0, (p.freq[id] ?? 0) + d)) } }));
  const togglePerk = (id: PerkId) =>
    setS(p => ({ ...p, perks: p.perks.includes(id) ? p.perks.filter(x => x !== id) : [...p.perks, id] }));

  async function handleSubmit() {
    if (!user || !q.lines.length) return;
    if (!motoId) { setError("Elige o registra tu vehículo primero."); return; }
    setError("");
    setSaving(true);
    try {
      const id = await createMembership({
        uid: user.uid,
        motorcycleId: motoId,
        clientEmail: user.email,
        clientName: user.displayName,
        termMonths: 12,
        vehicle: { type: s.type, typeName: t.name, range: getRange(s).label, model: s.model, usage: s.usage },
        selection: s,
        services: q.lines.map(l => ({ id: l.id, name: l.name, timesPerYear: l.n })),
        perks: q.perks.map(p => ({ id: p.id, name: p.name, monthly: p.price })),
        billing: s.billing,
        paymentAmount: Math.round(pay),
        totalYear: Math.round(w ? q.yearWeekly : q.year),
      });
      setSavedId(id);
    } catch (err) {
      console.error("[Membresías] createMembership failed:", err);
      setError("No pudimos guardar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.");
    } finally {
      setSaving(false);
    }
  }

  const waUrl = `https://wa.me/${MEMBERSHIP_CONFIG.whatsapp}?text=${encodeURIComponent(summaryText(s, q, user.displayName, savedId ?? undefined))}`;

  const Step = ({ n, title, hint }: { n: number; title: string; hint?: string }) => (
    <div className="flex items-center gap-3 mt-8 mb-3">
      <div className="w-8 h-8 rounded-lg bg-[var(--color-spm-red)] text-white font-display font-bold grid place-items-center shrink-0">{n}</div>
      <div>
        <h2 className={`font-display font-bold text-lg ${strong}`}>{title}</h2>
        {hint && <p className={`text-sm ${muted}`}>{hint}</p>}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen pb-32 ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      <header className={`sticky top-0 z-30 border-b px-4 py-3 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-200"}`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/portal" className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className={`font-display font-bold text-lg ${strong}`}>Mi membresía</h1>
            <p className={`text-xs ${muted}`}>Mantenimiento a 12 meses · pago semanal o mensual</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {/* Membresías existentes */}
        {mine.length > 0 && (
          <section className="space-y-3 mb-6">
            {mine.map(m => (
              <div key={m.id} className={`${card} p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between`}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <BadgeCheck size={18} className="text-[var(--color-spm-orange)]" />
                    <span className={`font-semibold ${strong}`}>{m.vehicle.typeName} · {m.vehicle.range}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_UI[m.status].cls}`}>{STATUS_UI[m.status].label}</span>
                  </div>
                  <p className={`text-sm mt-1 ${muted}`}>
                    {m.vehicle.model ? `${m.vehicle.model} · ` : ""}{m.services.length} servicios · folio {m.id.slice(0, 6).toUpperCase()}
                  </p>
                  {m.status === "pendiente" && (
                    <p className={`text-xs mt-2 flex items-center gap-1.5 ${muted}`}>
                      <Clock size={12} /> Te contactaremos para revisar tu vehículo y activar tu plan.{" "}
                      <a className="text-[var(--color-spm-red-light)] hover:underline" target="_blank" rel="noopener noreferrer"
                         href={`https://wa.me/${MEMBERSHIP_CONFIG.whatsapp}?text=${encodeURIComponent(`Hola, quiero activar mi membresía folio ${m.id.slice(0, 6).toUpperCase()}.`)}`}>
                        Escríbenos por WhatsApp
                      </a>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className={`font-display font-bold text-2xl ${strong}`}>{fmtMXN(m.paymentAmount)}<span className={`text-sm font-medium ${muted}`}>/{m.billing === "weekly" ? "semana" : "mes"}</span></div>
                  <div className={`text-xs ${muted}`}>Total 12 meses {fmtMXN(m.totalYear)}</div>
                </div>
              </div>
            ))}
            {!building && (
              <button onClick={() => { setBuilding(true); setSavedId(null); }} className="text-sm font-semibold text-[var(--color-spm-red-light)] hover:underline">
                + Armar membresía para otro vehículo
              </button>
            )}
          </section>
        )}

        {building && (savedId ? (
          <section className={`${card} p-8 text-center max-w-xl mx-auto`}>
            <div className="w-14 h-14 rounded-full bg-[var(--color-spm-orange)]/15 grid place-items-center mx-auto mb-4">
              <Check size={28} className="text-[var(--color-spm-orange)]" />
            </div>
            <h2 className={`font-display font-bold text-2xl ${strong}`}>¡Solicitud enviada!</h2>
            <p className={`mt-2 ${muted}`}>Folio <b className={strong}>{savedId.slice(0, 6).toUpperCase()}</b>. Confirma por WhatsApp para agendar la revisión de tu vehículo y activar tu plan.</p>
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
               className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white font-semibold rounded-xl transition-all hover:scale-105">
              <MessageCircle size={18} /> Confirmar por WhatsApp
            </a>
            <p className={`text-xs mt-3 ${muted}`}>WhatsApp: 81 3388-0010</p>
          </section>
        ) : !motosLoaded ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[var(--color-spm-red)]" /></div>
        ) : (motos.length === 0 || addingMoto) ? (
          <section className={`${card} p-5 max-w-2xl mx-auto`}>
            <h2 className={`font-display font-bold text-xl ${strong}`}>
              {motos.length === 0 ? "Primero, registra tu vehículo" : "Agregar otro vehículo"}
            </h2>
            <p className={`text-sm mt-1 mb-5 ${muted}`}>
              Marca, modelo, año, VIN, 4 fotos y cómo lo usas. Con esto armamos tu membresía y nuestros mecánicos llegan preparados.
            </p>
            <VehicleForm
              onSaved={m => { selectMoto(m); setAddingMoto(false); }}
              onCancel={motos.length ? () => setAddingMoto(false) : undefined}
              submitLabel="Guardar y armar mi membresía"
            />
          </section>
        ) : (
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
            <section>
              <Step n={1} title="Tu vehículo" hint="Elige para cuál vehículo es la membresía." />
              <div className="grid sm:grid-cols-2 gap-3">
                {motos.map(m => (
                  <button key={m.id} onClick={() => selectMoto(m)}
                    className={`flex items-center gap-3 text-left rounded-2xl border p-3 transition-all ${motoId === m.id
                      ? "border-[var(--color-spm-red-light)] ring-1 ring-[var(--color-spm-red-light)] " + (isDark ? "bg-slate-800" : "bg-blue-50")
                      : isDark ? "bg-slate-900 border-white/10 hover:border-[var(--color-spm-red-light)]" : "bg-white border-gray-200 hover:border-[var(--color-spm-red-light)]"}`}>
                    {m.photoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.photoUrl} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
                      : <span className="w-16 h-12 rounded-lg bg-[var(--color-spm-red)]/10 grid place-items-center flex-shrink-0"><Bike size={18} className="text-[var(--color-spm-red)]" /></span>}
                    <span className="min-w-0">
                      <span className={`block font-semibold text-sm truncate ${strong}`}>{m.brand} {m.model}</span>
                      <span className={`block text-xs ${muted}`}>{m.year}{m.cilindrada ? ` · ${m.cilindrada} cc` : ""}{m.vin ? ` · VIN …${m.vin.slice(-6)}` : ""}</span>
                    </span>
                  </button>
                ))}
                <button onClick={() => setAddingMoto(true)}
                  className={`rounded-2xl border border-dashed p-3 text-sm font-semibold text-[var(--color-spm-red-light)] ${isDark ? "border-white/15" : "border-gray-300"}`}>
                  + Agregar otro vehículo
                </button>
              </div>

              <Step n={2} title="Tipo de vehículo" hint="Lo tomamos de tu registro; cámbialo si no coincide." />
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {VEHICLE_TYPES.map(x => (
                  <button key={x.id} onClick={() => setType(x.id)}
                    className={`text-left rounded-2xl border p-4 transition-all ${s.type === x.id
                      ? "border-[var(--color-spm-red-light)] ring-1 ring-[var(--color-spm-red-light)] " + (isDark ? "bg-slate-800" : "bg-blue-50")
                      : isDark ? "bg-slate-900 border-white/10 hover:border-[var(--color-spm-red-light)]" : "bg-white border-gray-200 hover:border-[var(--color-spm-red-light)]"}`}>
                    <span className="text-2xl">{x.icon}</span>
                    <span className={`block font-display font-bold text-sm mt-2 ${strong}`}>{x.name}</span>
                    <span className={`block text-xs mt-1 ${muted}`}>{x.ex}</span>
                  </button>
                ))}
              </div>

              <Step n={3} title="Cilindrada" hint={t.mult.p > 1 ? "Las refacciones y la mano de obra especializada cuestan más en esta categoría." : undefined} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {t.ranges.map((r, i) => (
                  <button key={r.label} onClick={() => setS(p => ({ ...p, range: i }))} className={opt(s.range === i)}>
                    {r.label}{r.note && <span className="block text-xs font-medium opacity-80">{r.note}</span>}
                  </button>
                ))}
              </div>
              <input value={s.model} maxLength={60} onChange={e => setS(p => ({ ...p, model: e.target.value }))}
                placeholder="Marca, modelo y año (ej. BMW S 1000 RR 2022)"
                className={`mt-3 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[var(--color-spm-red-light)] ${isDark ? "bg-slate-900 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900"}`} />

              <Step n={4} title="¿Cómo la usas?" hint="Con esto te recomendamos cuántas veces al año hacer cada servicio." />
              <div className="grid sm:grid-cols-3 gap-2">
                {USAGES.map(u => (
                  <button key={u.id} onClick={() => setUsage(u.id)} className={opt(s.usage === u.id)}>
                    {u.name}<span className="block text-xs font-medium opacity-80">{u.note}</span>
                  </button>
                ))}
              </div>

              <Step n={5} title="Elige tus servicios" hint="Ajusta cuántas veces al año quieres cada uno. En 0 no se incluye." />
              <div className="grid sm:grid-cols-2 gap-2 mb-3">
                <button onClick={() => setS(p => ({ ...p, parts: true }))} className={opt(s.parts)}>
                  Refacciones + mano de obra<span className="block text-xs font-medium opacity-80">Nosotros ponemos todo</span>
                </button>
                <button onClick={() => setS(p => ({ ...p, parts: false }))} className={opt(!s.parts)}>
                  Solo mano de obra<span className="block text-xs font-medium opacity-80">Tú traes las piezas</span>
                </button>
              </div>
              <div className="space-y-2">
                {t.items.map(id => {
                  const u = unitPrice(id, s), n = s.freq[id] ?? 0, rec = defaultFreq(id, s.type, s.usage);
                  const visit = (s.parts ? u.p : 0) + u.l;
                  return (
                    <div key={id} className={`rounded-2xl border p-4 grid sm:grid-cols-[1fr_auto] gap-3 items-center transition-all ${
                      n ? (isDark ? "bg-slate-800 border-[var(--color-spm-red-light)]/50" : "bg-blue-50/60 border-[var(--color-spm-red-light)]/50")
                        : (isDark ? "bg-slate-900 border-white/10" : "bg-white border-gray-200")}`}>
                      <div>
                        <div className={`font-semibold ${strong}`}>
                          {serviceName(id, s.type)}
                          {rec > 0 && <span className="ml-2 text-xs font-medium text-green-500">Recomendado: {rec}× al año</span>}
                        </div>
                        <p className={`text-sm ${muted}`}>{SERVICES[id].desc}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                          {u.p > 0 && <span className={`px-2 py-0.5 rounded-md border ${isDark ? "border-white/10" : "border-gray-200"} ${s.parts ? "" : "line-through opacity-40"}`}>Refacción <b>{fmtMXN(u.p)}</b></span>}
                          <span className={`px-2 py-0.5 rounded-md border ${isDark ? "border-white/10" : "border-gray-200"}`}>Mano de obra <b>{fmtMXN(u.l)}</b></span>
                          <span className={`px-2 py-0.5 rounded-md border ${isDark ? "border-white/10" : "border-gray-200"}`}>Por servicio <b>{fmtMXN(visit)}</b></span>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5">
                        <div className={`flex items-center gap-1 rounded-xl border p-1 ${isDark ? "border-white/10 bg-slate-950" : "border-gray-200 bg-slate-50"}`}>
                          <button aria-label="Menos" onClick={() => bump(id, -1)} className={`w-8 h-8 rounded-lg grid place-items-center ${isDark ? "bg-slate-800 hover:bg-[var(--color-spm-red)]" : "bg-white hover:bg-blue-100"}`}><Minus size={14} /></button>
                          <span className={`w-8 text-center font-display font-bold ${strong}`}>{n}</span>
                          <button aria-label="Más" onClick={() => bump(id, 1)} className={`w-8 h-8 rounded-lg grid place-items-center ${isDark ? "bg-slate-800 hover:bg-[var(--color-spm-red)]" : "bg-white hover:bg-blue-100"}`}><Plus size={14} /></button>
                        </div>
                        <span className={`text-xs ${muted}`}>veces al año</span>
                        <span className="text-sm font-semibold text-[var(--color-spm-red-light)]">{n ? `${fmtMXN(visit * n)}/año` : "No incluido"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setS(p => ({ ...p, freq: recommendedFreq(p.type, p.usage) }))} className="mt-2 text-sm font-semibold text-[var(--color-spm-red-light)] hover:underline">
                Volver a la recomendación
              </button>

              <Step n={6} title="Beneficios de membresía" hint="Opcionales, con precio fijo al mes." />
              <div className="grid sm:grid-cols-2 gap-2">
                {availablePerks(s.type).map(p => {
                  const on = s.perks.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => togglePerk(p.id)}
                      className={`text-left rounded-2xl border p-4 transition-all ${on
                        ? (isDark ? "bg-slate-800 border-[var(--color-spm-red-light)]" : "bg-blue-50 border-[var(--color-spm-red-light)]")
                        : (isDark ? "bg-slate-900 border-white/10" : "bg-white border-gray-200")}`}>
                      <div className="flex justify-between gap-2">
                        <span className={`font-semibold flex items-center gap-2 ${strong}`}>
                          <span className={`w-5 h-5 rounded-md border-2 grid place-items-center ${on ? "bg-[var(--color-spm-red)] border-[var(--color-spm-red)]" : "border-slate-500"}`}>{on && <Check size={12} className="text-white" />}</span>
                          {p.name}
                        </span>
                        <span className="text-sm font-semibold text-[var(--color-spm-red-light)] whitespace-nowrap">+{fmtMXN(perkPrice(p, s))}/mes</span>
                      </div>
                      <p className={`text-sm mt-1 ${muted}`}>{p.desc}</p>
                    </button>
                  );
                })}
              </div>

              <Step n={7} title="¿Cuántas unidades?" hint="Flotillas: 3–4 unidades −5% · 5 o más −10%." />
              <div className={`inline-flex items-center gap-3 rounded-xl border p-2 ${isDark ? "border-white/10 bg-slate-900" : "border-gray-200 bg-white"}`}>
                <button aria-label="Menos unidades" onClick={() => setS(p => ({ ...p, units: Math.max(1, p.units - 1) }))} className={`w-10 h-10 rounded-lg grid place-items-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}><Minus size={16} /></button>
                <span className={`w-8 text-center font-display font-bold text-lg ${strong}`}>{s.units}</span>
                <button aria-label="Más unidades" onClick={() => setS(p => ({ ...p, units: Math.min(50, p.units + 1) }))} className={`w-10 h-10 rounded-lg grid place-items-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}><Plus size={16} /></button>
              </div>

              <Step n={8} title="¿Cómo quieres pagar?" hint="Plazo de 12 meses." />
              <div className="grid sm:grid-cols-2 gap-2">
                <button onClick={() => setS(p => ({ ...p, billing: "weekly" }))} className={opt(w)}>
                  Semanal On the Go
                  <span className="block text-xs font-medium opacity-80">52 pagos · −{Math.round(MEMBERSHIP_CONFIG.weeklyOff * 100)}% · ahorras {fmtMXN(q.year - q.yearWeekly)} al año</span>
                </button>
                <button onClick={() => setS(p => ({ ...p, billing: "monthly" }))} className={opt(!w)}>
                  Mensual<span className="block text-xs font-medium opacity-80">12 pagos</span>
                </button>
              </div>
            </section>

            {/* Resumen */}
            <aside className={`${card} p-5 lg:sticky lg:top-20`}>
              <h3 className={`font-display font-bold ${strong}`}>Tu membresía</h3>
              <p className={`text-sm mb-3 ${muted}`}>{t.icon} {t.name} · {getRange(s).label}{s.model ? ` · ${s.model}` : ""}</p>
              <div className={`font-display font-extrabold text-4xl ${strong}`}>
                {fmtMXN(pay)} <span className={`text-sm font-medium ${muted}`}>/{w ? "semana" : "mes"}</span>
              </div>
              <p className={`text-sm mt-1 mb-4 ${muted}`}>
                {w ? `Equivale a ${fmtMXN(q.yearWeekly / 12)} al mes · 52 pagos` : `12 pagos · semanal quedaría en ${fmtMXN(q.weekly)}/semana`}
              </p>

              {q.lines.length ? (
                <ul className={`text-sm space-y-1 mb-4 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  {q.lines.map(l => <li key={l.id} className="flex justify-between gap-2"><span>{l.name}</span><span className={muted}>×{l.n}</span></li>)}
                  {q.perks.map(p => <li key={p.id} className="flex justify-between gap-2"><span>{p.name}</span><span className={muted}>incluido</span></li>)}
                </ul>
              ) : <p className={`text-sm mb-4 ${muted}`}>Agrega al menos un servicio para ver tu precio.</p>}

              <div className={`border-t pt-3 text-sm space-y-1.5 ${isDark ? "border-white/10" : "border-gray-200"}`}>
                {s.parts && <Row label="Refacciones al año" value={fmtMXN(q.partsYr)} muted={muted} />}
                <Row label="Mano de obra al año" value={fmtMXN(q.laborYr)} muted={muted} />
                <Row label="Precio normal" value={<span className={`line-through ${muted}`}>{fmtMXN(q.list)}</span>} />
                {q.memberSave > 0 && <Row label="Ahorro de membresía" value={`−${fmtMXN(q.memberSave)}`} green />}
                {q.perksYr > 0 && <Row label="Beneficios (12 meses)" value={`+${fmtMXN(q.perksYr)}`} />}
                {q.fleetSave > 0 && <Row label={`Flotilla −${q.fleetOff * 100}%`} value={`−${fmtMXN(q.fleetSave)}`} green />}
                {w && q.year > 0 && <Row label="Pago semanal −8%" value={`−${fmtMXN(q.year - q.yearWeekly)}`} green />}
                <div className={`flex justify-between pt-2 mt-1 border-t font-bold ${strong} ${isDark ? "border-white/10" : "border-gray-200"}`}>
                  <span>Total 12 meses</span><span>{fmtMXN(w ? q.yearWeekly : q.year)}</span>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
              <button onClick={handleSubmit} disabled={saving || !q.lines.length}
                className="mt-4 w-full py-3.5 bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white font-semibold rounded-xl transition-all hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />} Solicitar mi membresía
              </button>
              <p className={`text-xs mt-3 ${muted}`}>
                Plazo de 12 meses. Precios de referencia con refacciones de rango medio; el precio final se confirma al revisar tu vehículo. Los servicios no usados no se acumulan.
              </p>
            </aside>
          </div>
        ))}
      </main>

      {/* Barra fija en móvil */}
      {building && !savedId && (
        <div className={`lg:hidden fixed bottom-0 inset-x-0 z-30 border-t px-4 py-3 flex items-center justify-between gap-3 ${isDark ? "bg-slate-950/95 border-white/10" : "bg-white/95 border-gray-200"}`}>
          <div className={`font-display font-extrabold text-xl ${strong}`}>{fmtMXN(pay)} <span className={`text-xs font-medium ${muted}`}>/{w ? "sem" : "mes"}</span></div>
          <button onClick={handleSubmit} disabled={saving || !q.lines.length}
            className="px-5 py-3 bg-[var(--color-spm-red)] text-white font-semibold rounded-xl text-sm disabled:opacity-50">
            Solicitar
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted, green }: { label: string; value: React.ReactNode; muted?: string; green?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${green ? "text-green-500 font-semibold" : muted ?? ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
