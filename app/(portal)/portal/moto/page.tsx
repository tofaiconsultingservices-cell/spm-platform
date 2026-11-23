"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { collection, onSnapshot, deleteDoc, doc, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { getType, USAGES } from "@/lib/memberships/config";
import VehicleForm from "@/components/portal/VehicleForm";
import type { Motorcycle } from "@/types";
import { ArrowLeft, Plus, Bike, Edit2, Trash2, X, Loader2, BadgeCheck } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function MotoPage() {
  const { user, loading } = useAuth();
  const { isDark }        = useTheme();
  const router            = useRouter();

  const [motos,    setMotos]    = useState<Motorcycle[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<Motorcycle | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isNew,    setIsNew]    = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // ?nuevo=1 llega justo después de crear la cuenta
  useEffect(() => {
    setIsNew(new URLSearchParams(window.location.search).get("nuevo") === "1");
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(getDb(), "motorcycles"), where("clientId", "==", user.uid));
    return onSnapshot(q, snap => {
      setMotos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Motorcycle));
      setFetching(false);
    });
  }, [user]);

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(m: Motorcycle) { setEditing(m); setShowForm(true); }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteDoc(doc(getDb(), "motorcycles", id));
      toast.success("Vehículo eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[var(--color-spm-red)]" />
      </div>
    );
  }

  const card   = `rounded-2xl border ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`;
  const strong = isDark ? "text-white" : "text-slate-900";
  const muted  = isDark ? "text-slate-400" : "text-slate-500";
  const chip   = `text-xs px-2 py-0.5 rounded-full ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`;
  const onboarding = isNew && !fetching && motos.length === 0;

  return (
    <div className={`min-h-screen ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      <Toaster position="top-right" />

      <header className={`sticky top-0 z-30 border-b px-4 py-3 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-200"}`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal" className={`p-1.5 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}>
              <ArrowLeft size={18} />
            </Link>
            <h1 className={`font-display font-bold text-lg ${strong}`}>Mis vehículos</h1>
          </div>
          {!onboarding && (
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-spm-red)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-spm-red-dark)] transition-all">
              <Plus size={15} /> Agregar
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {fetching ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--color-spm-red)]" />
          </div>
        ) : onboarding ? (
          <section className={`${card} p-5`}>
            <h2 className={`font-display font-bold text-xl ${strong}`}>¡Bienvenido! Registra tu vehículo</h2>
            <p className={`text-sm mt-1 mb-5 ${muted}`}>
              Con estos datos y fotos nuestros mecánicos llegan preparados y podemos armar tu membresía de mantenimiento.
            </p>
            <VehicleForm
              onSaved={() => { toast.success("Vehículo registrado"); router.push("/portal/membresias"); }}
              onCancel={() => router.push("/portal")}
              submitLabel="Registrar y armar mi membresía"
            />
          </section>
        ) : motos.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed ${
            isDark ? "border-white/10 text-slate-500" : "border-gray-200 text-slate-400"
          }`}>
            <Bike size={40} className="mb-3 opacity-40" />
            <p className="font-semibold text-sm mb-1">Sin vehículos registrados</p>
            <p className="text-xs mb-4">Agrega tu moto para que nuestros mecánicos lleguen preparados</p>
            <button onClick={openCreate}
              className="px-5 py-2 bg-[var(--color-spm-red)] text-white text-sm font-bold rounded-xl hover:bg-[var(--color-spm-red-dark)] transition-all">
              Registrar vehículo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {motos.map(m => (
              <div key={m.id} className={`${card} p-4`}>
                <div className="flex items-start gap-3">
                  {m.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photoUrl} alt={`${m.brand} ${m.model}`} className="w-20 h-16 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-16 rounded-xl bg-[var(--color-spm-red)]/10 flex items-center justify-center flex-shrink-0">
                      <Bike size={22} className="text-[var(--color-spm-red)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-display font-bold text-base ${strong}`}>{m.brand} {m.model}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={chip}>{m.year}</span>
                      {m.vehicleType && <span className={chip}>{getType(m.vehicleType).icon} {getType(m.vehicleType).name}</span>}
                      {m.cilindrada ? <span className={chip}>{m.cilindrada} cc</span> : null}
                      {m.usage && <span className={chip}>{USAGES.find(u => u.id === m.usage)?.name}</span>}
                      {m.placa && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-bold">{m.placa}</span>}
                    </div>
                    {m.vin && <p className={`text-xs font-mono mt-1.5 ${muted}`}>VIN {m.vin}</p>}
                    {!m.photos && (
                      <button onClick={() => openEdit(m)} className="text-xs font-semibold text-amber-400 hover:underline mt-1.5">
                        Completa fotos, VIN y uso →
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(m)} aria-label="Editar"
                      className={`p-2 rounded-lg transition-colors ${isDark ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} disabled={deleting === m.id} aria-label="Eliminar"
                      className={`p-2 rounded-lg transition-colors text-red-400 hover:text-red-300 ${isDark ? "hover:bg-red-950/30" : "hover:bg-red-50"} disabled:opacity-50`}>
                      {deleting === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <Link href="/portal/membresias"
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--color-spm-red-light)]/40 text-[var(--color-spm-red-light)] text-sm font-semibold hover:bg-[var(--color-spm-red)]/10 transition-all">
              <BadgeCheck size={16} /> Armar membresía de mantenimiento
            </Link>
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className={`relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl ${isDark ? "bg-slate-900" : "bg-white"}`}>
            <div className={`sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100"}`}>
              <h2 className={`font-display font-bold text-lg ${strong}`}>{editing ? "Editar vehículo" : "Nuevo vehículo"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200 p-1" aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="p-5">
              <VehicleForm
                key={editing?.id ?? "nuevo"}
                initial={editing}
                onSaved={() => { toast.success(editing ? "Vehículo actualizado" : "Vehículo registrado"); setShowForm(false); }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
