"use client";

import { useEffect, useMemo, useState } from "react";
import CrmShell from "@/components/crm/CrmShell";
import { FixedPricePreview, formatMXN } from "@/components/crm/FixedPricePreview";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  createWorkshopService,
  deleteWorkshopService,
  subscribeWorkshopServices,
  updateWorkshopService,
} from "@/lib/firestore/services";
import { customerUnitPrice, profitPerUnit, SALE_MARKUP_PERCENT } from "@/lib/pricing";
import type { ServiceType, WorkshopService } from "@/types";
import { SERVICE_LABELS } from "@/types";
import { ClipboardList, Edit2, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

const SERVICE_OPTIONS = Object.entries(SERVICE_LABELS) as [ServiceType, string][];

function emptyForm() {
  return {
    name: "",
    code: "",
    serviceType: "lavado" as ServiceType,
    description: "",
    costPrice: "",
    isActive: true,
  };
}

export default function ServiciosPage() {
  const { isDark } = useTheme();
  const { hasRole } = useAuth();
  const [services, setServices] = useState<WorkshopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<WorkshopService | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const unsub = subscribeWorkshopServices((rows) => {
      setServices(rows);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (SERVICE_LABELS[s.serviceType] ?? "").toLowerCase().includes(q)
    );
  }, [services, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setCreating(true);
  }

  function openEdit(service: WorkshopService) {
    setCreating(false);
    setEditing(service);
    setForm({
      name: service.name,
      code: service.code,
      serviceType: service.serviceType,
      description: service.description ?? "",
      costPrice: String(service.costPrice),
      isActive: service.isActive,
    });
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm());
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const cost = Number(form.costPrice);
    if (!form.name.trim() || !Number.isFinite(cost) || cost < 0) {
      toast.error("Nombre y costo del servicio son requeridos");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateWorkshopService(editing.id, {
          name: form.name.trim(),
          code: form.code.trim() || editing.code,
          serviceType: form.serviceType,
          description: form.description.trim() || undefined,
          costPrice: cost,
          isActive: form.isActive,
        });
        toast.success("Servicio actualizado");
      } else {
        await createWorkshopService({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          serviceType: form.serviceType,
          description: form.description.trim() || undefined,
          costPrice: cost,
          isActive: form.isActive,
        });
        toast.success("Servicio creado");
      }
      closeForm();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar. Hace falta rol de manager y las reglas de Firestore desplegadas.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(service: WorkshopService) {
    if (!hasRole("manager")) {
      toast.error("No tienes permiso para eliminar servicios");
      return;
    }
    const ok = window.confirm(`¿Eliminar el servicio "${service.name}"?`);
    if (!ok) return;
    try {
      if (hasRole("admin")) {
        await deleteWorkshopService(service.id);
        toast.success("Servicio eliminado");
      } else {
        await updateWorkshopService(service.id, { isActive: false });
        toast.success("Servicio desactivado. Solo un admin puede borrarlo por completo.");
      }
      if (editing?.id === service.id) closeForm();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo eliminar");
    }
  }

  const inp = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
    isDark ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400"
  }`;
  const lbl = `block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`;
  const showForm = creating || editing;

  return (
    <CrmShell title="Servicios" subtitle={`Mano de obra del taller · venta = costo + ${SALE_MARKUP_PERCENT}%`}>
      <Toaster position="top-right" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inp} pl-9`}
            placeholder="Buscar por nombre, código o tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold"
        >
          <Plus size={14} />
          Nuevo servicio
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-[var(--color-spm-red)]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList size={40} className="mx-auto text-slate-600 mb-3" />
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {search ? "Sin resultados" : "Aún no hay servicios con precio"}
              </p>
              {!search && (
                <button onClick={openCreate} className="mt-3 text-sm text-[var(--color-spm-red)] font-semibold hover:underline">
                  Agregar el primero
                </button>
              )}
            </div>
          ) : (
            filtered.map((service) => {
              const sale = customerUnitPrice(service);
              const profit = profitPerUnit(Number(service.costPrice) || 0, sale);
              return (
                <div
                  key={service.id}
                  className={`p-4 rounded-2xl border ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"} ${!service.isActive ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm truncate ${isDark ? "text-white" : "text-slate-900"}`}>{service.name}</p>
                      <p className={`text-xs font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        {service.code} · {SERVICE_LABELS[service.serviceType] ?? service.serviceType}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => openEdit(service)} className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--color-spm-red)]" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(service)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div>
                      <p className={isDark ? "text-slate-500" : "text-slate-400"}>Costo</p>
                      <p className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{formatMXN(service.costPrice)}</p>
                    </div>
                    <div>
                      <p className={isDark ? "text-slate-500" : "text-slate-400"}>Venta</p>
                      <p className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{formatMXN(sale)}</p>
                    </div>
                    <div>
                      <p className={isDark ? "text-slate-500" : "text-slate-400"}>Utilidad</p>
                      <p className="font-semibold text-emerald-500">{formatMXN(profit)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSave} className={`p-5 rounded-2xl border h-fit space-y-4 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`}>
            <div className="flex items-center justify-between">
              <h2 className={`font-display font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                {editing ? "Editar servicio" : "Nuevo servicio"}
              </h2>
              <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-200"><X size={16} /></button>
            </div>
            <div>
              <label className={lbl}>Nombre *</label>
              <input className={inp} value={form.name} placeholder="Lavado de motocicleta"
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Código</label>
                <input className={inp} value={form.code} placeholder="SRV-00001 (auto)"
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>Tipo</label>
                <select className={inp} value={form.serviceType}
                  onChange={(e) => setForm((p) => ({ ...p, serviceType: e.target.value as ServiceType }))}>
                  {SERVICE_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Costo para el taller *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input type="number" min="0" step="0.01" className={inp + " pl-6"} placeholder="0.00"
                  value={form.costPrice} onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))} />
              </div>
            </div>
            <FixedPricePreview costInput={form.costPrice} isDark={isDark} />
            <div>
              <label className={lbl}>Descripción</label>
              <textarea rows={2} className={inp + " resize-none"} value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>Activo</span>
            </label>
            <button type="submit" disabled={saving}
              className="w-full py-2.5 rounded-xl bg-[var(--color-spm-red)] text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
          </form>
        )}
      </div>
    </CrmShell>
  );
}
