"use client";

import { useState, useEffect, useMemo } from "react";
import CrmShell from "@/components/crm/CrmShell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  subscribeAllMemberships, confirmMembership, totalPaymentsFor,
  type Membership, type MembershipStatus,
} from "@/lib/firestore/memberships";
import { fmtMXN } from "@/lib/memberships/config";
import type { Motorcycle } from "@/types";
import { Loader2, Check, X, MessageCircle, Bike, CreditCard, Store } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const STATUS: Record<MembershipStatus, { label: string; cls: string }> = {
  pendiente:  { label: "Por revisar",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  por_pagar:  { label: "Esperando pago", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  activa:     { label: "Activa",       cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  atrasada:   { label: "Pago atrasado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  finalizada: { label: "Finalizada",   cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  cancelada:  { label: "Cancelada",    cls: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const TABS: { id: "todas" | MembershipStatus; label: string }[] = [
  { id: "pendiente", label: "Por revisar" },
  { id: "por_pagar", label: "Esperando pago" },
  { id: "activa", label: "Activas" },
  { id: "atrasada", label: "Atrasadas" },
  { id: "todas", label: "Todas" },
];

const fmtDate = (ts: unknown) => {
  const d = (ts as { toDate?: () => Date } | null | undefined)?.toDate?.();
  return d ? d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—";
};

function waLink(phone: string | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const full = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

function MembershipCard({ m, isDark }: { m: Membership; isDark: boolean }) {
  const { user, firebaseUser } = useAuth();
  const [moto, setMoto] = useState<Motorcycle | null>(null);
  const [amount, setAmount] = useState(String(m.confirmedAmount ?? m.paymentAmount ?? ""));
  const [busy, setBusy] = useState(false);
  const period = m.billing === "weekly" ? "semana" : "mes";
  const total = totalPaymentsFor(m.billing);

  useEffect(() => {
    if (!m.motorcycleId) return;
    getDoc(doc(getDb(), "motorcycles", m.motorcycleId))
      .then(s => s.exists() && setMoto({ id: s.id, ...s.data() } as Motorcycle))
      .catch(() => { /* sin acceso o borrada */ });
  }, [m.motorcycleId]);

  async function handleConfirm() {
    const n = Number(amount);
    if (!user || !n || n < 10) return toast.error("Escribe un precio válido");
    setBusy(true);
    try {
      await confirmMembership(m.id, Math.round(n), m.billing, user.uid);
      toast.success("Confirmada: el cliente ya puede pagar");
    } catch {
      toast.error("No se pudo confirmar");
    } finally { setBusy(false); }
  }

  async function handleCancel() {
    if (!firebaseUser || !window.confirm(`¿Cancelar la membresía ${m.id.slice(0, 6).toUpperCase()}? Si paga con tarjeta, se detienen los cobros.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/memberships/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await firebaseUser.getIdToken()}` },
        body: JSON.stringify({ membershipId: m.id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      toast.success("Membresía cancelada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar");
    } finally { setBusy(false); }
  }

  const card = `rounded-2xl border p-5 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`;
  const strong = isDark ? "text-white" : "text-slate-900";
  const muted = isDark ? "text-slate-400" : "text-slate-500";
  const folio = m.id.slice(0, 6).toUpperCase();
  const readyMsg = `Hola ${m.clientName.split(" ")[0]}, ya revisamos tu vehículo y tu membresía ${folio} quedó en ${fmtMXN(Number(amount) || 0)} por ${period}. Entra a sanpedromotocare.com/portal/membresias para pagar con tarjeta u OXXO. — San Pedro Moto Care`;
  const wa = waLink(m.clientPhone, readyMsg);
  const photos = moto?.photos ? [moto.photos.frente, moto.photos.izquierdo, moto.photos.derecho, moto.photos.atras].filter(Boolean) as string[] : [];

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-display font-bold ${strong}`}>{m.clientName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS[m.status].cls}`}>{STATUS[m.status].label}</span>
            <span className={`text-xs font-mono ${muted}`}>#{folio}</span>
          </div>
          <p className={`text-sm ${muted}`}>{m.clientEmail}{m.clientPhone ? ` · ${m.clientPhone}` : ""} · solicitada {fmtDate(m.createdAt)}</p>
        </div>
        <div className="text-right">
          <div className={`font-display font-bold text-xl ${strong}`}>{fmtMXN(m.confirmedAmount ?? m.paymentAmount)}<span className={`text-xs ${muted}`}>/{period}</span></div>
          <div className={`text-xs ${muted}`}>{m.confirmedAmount ? "precio confirmado" : "cotización del cliente"}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div>
          <p className={`text-sm font-semibold ${strong}`}><Bike size={14} className="inline mr-1" />{m.vehicle.typeName} · {m.vehicle.range}</p>
          <p className={`text-sm ${muted}`}>{m.vehicle.model || "Sin modelo"}{moto?.vin ? ` · VIN ${moto.vin}` : ""}</p>
          {moto?.description && <p className={`text-sm mt-1 italic ${muted}`}>&ldquo;{moto.description}&rdquo;</p>}
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {photos.map(src => (
                <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="w-full aspect-[4/3] object-cover rounded-lg" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${muted}`}>Servicios al año</p>
          <ul className={`text-sm space-y-0.5 ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            {m.services.map(s => <li key={s.id}>{s.name} ×{s.timesPerYear}</li>)}
            {m.perks.map(p => <li key={p.id}>{p.name} (beneficio)</li>)}
          </ul>
          {(m.status === "activa" || m.status === "atrasada" || m.status === "finalizada") && (
            <p className={`text-sm mt-3 ${strong}`}>
              {m.paymentMethod === "oxxo" ? <Store size={14} className="inline mr-1" /> : <CreditCard size={14} className="inline mr-1" />}
              {m.paymentsMade ?? 0} de {total} pagos · próximo {fmtDate(m.nextPaymentAt)}
            </p>
          )}
        </div>
      </div>

      {m.status === "pendiente" && (
        <div className={`mt-4 pt-4 border-t flex flex-wrap items-end gap-2 ${isDark ? "border-white/5" : "border-gray-100"}`}>
          <label className="flex-1 min-w-[180px]">
            <span className={`text-xs font-semibold block mb-1 ${muted}`}>Precio confirmado por {period} (MXN)</span>
            <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border text-sm ${isDark ? "bg-slate-800 border-white/10 text-white" : "bg-white border-gray-200"}`} />
          </label>
          <button onClick={handleConfirm} disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirmar y habilitar pago
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {m.status === "por_pagar" && wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center gap-1.5">
            <MessageCircle size={14} /> Avisar al cliente por WhatsApp
          </a>
        )}
        {!["cancelada", "finalizada"].includes(m.status) && (
          <button onClick={handleCancel} disabled={busy}
            className={`px-3 py-2 rounded-xl border text-sm font-semibold flex items-center gap-1.5 text-red-400 ${isDark ? "border-white/10" : "border-gray-200"}`}>
            <X size={14} /> Cancelar membresía
          </button>
        )}
      </div>
    </div>
  );
}

export default function CrmMembresiasPage() {
  const { isDark } = useTheme();
  const { user, hasRole } = useAuth();
  const [list, setList] = useState<Membership[] | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pendiente");

  useEffect(() => {
    if (!user || !hasRole("operador")) return;
    return subscribeAllMemberships(setList);
  }, [user, hasRole]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (list ?? []).forEach(m => { c[m.status] = (c[m.status] ?? 0) + 1; });
    return c;
  }, [list]);
  const shown = (list ?? []).filter(m => tab === "todas" || m.status === tab);

  return (
    <CrmShell title="Membresías" subtitle="Revisa, confirma precio y da seguimiento a los pagos">
      <Toaster position="top-right" />
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t.id
              ? "bg-[var(--color-spm-red)] text-white"
              : isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
            {t.label}{t.id !== "todas" && counts[t.id] ? ` (${counts[t.id]})` : ""}
          </button>
        ))}
      </div>
      {list === null ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[var(--color-spm-red)]" /></div>
      ) : shown.length === 0 ? (
        <p className={`text-sm py-10 text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>No hay membresías en esta sección.</p>
      ) : (
        <div className="space-y-4">{shown.map(m => <MembershipCard key={m.id} m={m} isDark={isDark} />)}</div>
      )}
    </CrmShell>
  );
}
