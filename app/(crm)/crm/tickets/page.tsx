"use client";

import { useState, useEffect, useMemo } from "react";
import CrmShell from "@/components/crm/CrmShell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  subscribeTickets, advanceTicketStatus, updateTicketFields,
  createTicketDirect, markAsPaidCash, recordPayment,
} from "@/lib/firestore/tickets";
import { subscribeClients } from "@/lib/firestore/clients";

// ── Notification helpers ───────────────────────────────────────────────────
async function notifyStatusChange(ticket: ServiceTicket, newStatus: ServiceTicketStatus, paymentLink?: string) {
  if (!ticket.clientPhone) return;
  try {
    await fetch("/api/notifications/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId:     ticket.ticketId,
        clientPhone:  ticket.clientPhone,
        clientName:   ticket.clientName ?? "Cliente",
        status:       newStatus,
        mechanicName: ticket.mechanicName,
        paymentLink,
      }),
    });
  } catch (err) {
    console.warn("[CRM] WhatsApp notification failed (non-fatal):", err);
  }
}

async function sendPaymentLink(ticket: ServiceTicket): Promise<string | null> {
  if (!ticket.finalCost || !ticket.clientPhone) return null;
  try {
    const res  = await fetch("/api/payments/create-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId:           ticket.ticketId,
        clientName:         ticket.clientName ?? "Cliente",
        clientPhone:        ticket.clientPhone,
        serviceDescription: ticket.serviceDescription,
        serviceType:        ticket.serviceType,
        amountMXN:          ticket.finalCost,
        sendWhatsApp:       true,
      }),
    });
    const data = await res.json();
    return data.url ?? null;
  } catch (err) {
    console.warn("[CRM] Payment link creation failed:", err);
    return null;
  }
}
import { subscribeMechanics } from "@/lib/firestore/mechanics";
import { subscribeActiveProducts, adjustStock } from "@/lib/firestore/products";
import { subscribeWorkshopServices } from "@/lib/firestore/services";
import { buildServiceCharge, customerUnitPrice, roundMoney, SALE_MARKUP_PERCENT } from "@/lib/pricing";
import type { ServiceTicket, ServiceTicketStatus, Mechanic, Client, PaymentMethod, Product, PartItem, WorkshopService, ServiceCharge } from "@/types";
import {
  STATUS_LABELS, STATUS_COLORS, SERVICE_LABELS, NEXT_STATUS, STATUS_PIPELINE,
  PAYMENT_METHOD_LABELS,
} from "@/types";
import {
  Plus, Search, Filter, ChevronRight, X, Loader2,
  User, Phone, MapPin, Wrench, Clock, CheckCircle2,
  AlertCircle, DollarSign, ChevronDown, CreditCard, Printer,
  Inbox, Stethoscope, Truck, Ban, Receipt, FileText, Banknote,
  ArrowRight, Check, Package, Trash2, Copy, ExternalLink,
} from "lucide-react";
import { generateInvoicePDF, generatePartialInvoicePDF, generatePaymentReceiptPDF } from "@/lib/invoice-pdf";
import toast, { Toaster } from "react-hot-toast";

// ── Status filter tabs ─────────────────────────────────────────
const FILTER_TABS: { label: string; value: ServiceTicketStatus | "todos" | "activos" }[] = [
  { label: "Todos", value: "todos" },
  { label: "Activos", value: "activos" },
  { label: "Lead", value: "lead-recibido" },
  { label: "Diagnóstico", value: "diagnostico-pendiente" },
  { label: "En camino", value: "en-camino" },
  { label: "En servicio", value: "en-servicio" },
  { label: "Completado", value: "completado" },
  { label: "Pagado", value: "pagado" },
  { label: "Cancelado", value: "cancelado" },
];

const ACTIVE_STATUSES: ServiceTicketStatus[] = [
  "lead-recibido", "diagnostico-pendiente", "en-camino", "en-servicio",
];

// ── Small components ───────────────────────────────────────────
function StatusBadge({ status }: { status: ServiceTicketStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

// ── Create Ticket Modal ────────────────────────────────────────
function CreateTicketModal({
  open, onClose, isDark, clients,
}: { open: boolean; onClose: () => void; isDark: boolean; clients: Client[] }) {
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [form, setForm] = useState({
    serviceType: "diagnostico", serviceDescription: "", serviceAddress: "",
    motoBrand: "", motoModel: "", motoYear: "", motoPlaca: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedClient(null);
      setClientSearch("");
      setDropdownOpen(false);
      setForm({ serviceType: "diagnostico", serviceDescription: "", serviceAddress: "", motoBrand: "", motoModel: "", motoYear: "", motoPlaca: "" });
    }
  }, [open]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 8);
    const q = clientSearch.toLowerCase();
    return clients.filter(c =>
      `${c.name} ${c.lastName}`.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.clientId.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [clients, clientSearch]);

  function selectClient(c: Client) {
    setSelectedClient(c);
    setClientSearch("");
    setDropdownOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) {
      toast.error("Selecciona un cliente registrado");
      return;
    }
    if (!form.serviceAddress || !form.serviceDescription) {
      toast.error("Completa todos los campos requeridos");
      return;
    }
    setLoading(true);
    try {
      const fullName = `${selectedClient.name} ${selectedClient.lastName}`.trim();
      const id = await createTicketDirect({
        clientId: selectedClient.id,
        clientName: fullName,
        clientPhone: selectedClient.phone,
        clientEmail: selectedClient.email,
        serviceType: form.serviceType,
        serviceDescription: form.serviceDescription,
        serviceAddress: form.serviceAddress,
        source: "crm-directo",
        ...(form.motoBrand ? { motoBrand: form.motoBrand } : {}),
        ...(form.motoModel ? { motoModel: form.motoModel } : {}),
        ...(form.motoYear ? { motoYear: Number(form.motoYear) } : {}),
        ...(form.motoPlaca ? { motoPlaca: form.motoPlaca.toUpperCase() } : {}),
      });
      toast.success(`Ticket ${id} creado`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al crear el ticket");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
    isDark ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400"
  }`;
  const labelCls = `block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-slate-900" : "bg-white"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
          <h3 className={`font-display font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>Nuevo Ticket</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* ── Client selector ── */}
          <div>
            <label className={labelCls}>
              Cliente *{" "}
              <span className={`normal-case font-normal ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                (debe estar registrado)
              </span>
            </label>

            {clients.length === 0 ? (
              <div className={`flex items-center justify-between p-3 rounded-xl border border-dashed ${isDark ? "border-white/10 bg-slate-800/50" : "border-gray-200 bg-gray-50"}`}>
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Sin clientes registrados</p>
                <a href="/crm/clientes" className="text-xs text-[var(--color-spm-red)] hover:underline font-semibold">
                  Registrar cliente →
                </a>
              </div>
            ) : selectedClient ? (
              <div className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? "border-emerald-900/40 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}>
                <div>
                  <p className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                    {selectedClient.name} {selectedClient.lastName}
                  </p>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {selectedClient.phone}
                    {selectedClient.email && ` · ${selectedClient.email}`}
                    {" · "}<span className="font-mono">{selectedClient.clientId}</span>
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedClient(null)}
                  className="text-slate-400 hover:text-slate-200 p-1 ml-2 flex-shrink-0">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder="Buscar por nombre o teléfono…"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 180)}
                />
                {dropdownOpen && (
                  <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-20 max-h-52 overflow-y-auto ${isDark ? "bg-slate-800 border-white/10" : "bg-white border-gray-200"}`}>
                    {filteredClients.length === 0 ? (
                      <div className="px-4 py-4 text-center space-y-1">
                        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Sin resultados</p>
                        <a href="/crm/clientes" className="text-xs text-[var(--color-spm-red)] hover:underline">
                          Registrar nuevo cliente →
                        </a>
                      </div>
                    ) : (
                      filteredClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => selectClient(c)}
                          className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[var(--color-spm-red)]/10 transition-colors border-b last:border-0 ${isDark ? "border-white/5" : "border-gray-100"}`}
                        >
                          <div>
                            <p className={`font-medium text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                              {c.name} {c.lastName}
                            </p>
                            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{c.phone}</p>
                          </div>
                          <span className={`text-xs font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>{c.clientId}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Tipo de servicio *</label>
            <select className={inputCls} value={form.serviceType}
              onChange={e => setForm(p => ({ ...p, serviceType: e.target.value }))}>
              {(Object.entries(SERVICE_LABELS) as [string, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Dirección del servicio *</label>
            <input className={inputCls} placeholder="Calle, Colonia, Ciudad" value={form.serviceAddress}
              onChange={e => setForm(p => ({ ...p, serviceAddress: e.target.value }))} />
          </div>

          {/* Datos de la motocicleta */}
          <div>
            <label className={labelCls}>Motocicleta</label>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Marca (Honda, Yamaha...)"
                value={form.motoBrand} onChange={e => setForm(p => ({ ...p, motoBrand: e.target.value }))} />
              <input className={inputCls} placeholder="Modelo (CB500F, R3...)"
                value={form.motoModel} onChange={e => setForm(p => ({ ...p, motoModel: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input type="number" className={inputCls} placeholder="Año" min={1950} max={2027}
                value={form.motoYear} onChange={e => setForm(p => ({ ...p, motoYear: e.target.value }))} />
              <input className={inputCls + " uppercase font-mono"} placeholder="Placa (ABC-1234)"
                value={form.motoPlaca} onChange={e => setForm(p => ({ ...p, motoPlaca: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Descripcion del problema *</label>
            <textarea rows={3} className={inputCls + " resize-none"} placeholder="Describe el problema..."
              value={form.serviceDescription}
              onChange={e => setForm(p => ({ ...p, serviceDescription: e.target.value }))} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-200 text-slate-600 hover:bg-gray-50"}`}>
              Cancelar
            </button>
            <button type="submit" disabled={loading || !selectedClient || clients.length === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              Crear Ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function printPaymentOrder(ticket: ServiceTicket, url: string) {
  const win = window.open("", "_blank", "width=700,height=620");
  if (!win) return;
  const amount = ticket.finalCost?.toLocaleString("es-MX") ?? "—";
  const serviceLabel = SERVICE_LABELS[ticket.serviceType as keyof typeof SERVICE_LABELS] ?? ticket.serviceType;
  const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden de Pago — ${ticket.ticketId}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#1e293b;background:#fff}
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #e2e8f0}
    .logo{font-size:22px;font-weight:800;color:#dc2626;letter-spacing:-0.5px}
    .badge{font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;border:1px solid #e2e8f0;padding:4px 10px;border-radius:20px}
    h1{font-size:26px;font-weight:800;margin-bottom:4px}
    .tid{font-size:14px;color:#dc2626;font-family:monospace;font-weight:600;margin-bottom:24px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
    .cell{padding:12px 14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0}
    .lbl{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px}
    .val{font-size:14px;font-weight:600;color:#1e293b}
    .amt{background:#fff5f5;border:2px solid #fecaca;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px}
    .amt-lbl{font-size:11px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .amt-val{font-size:38px;font-weight:900;color:#dc2626}
    .link-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px;margin-bottom:20px}
    .link-lbl{font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
    .link-url{font-size:12px;color:#0f172a;word-break:break-all;background:white;border:1px solid #d1fae5;border-radius:8px;padding:10px 12px;font-family:monospace;line-height:1.5}
    .validity{font-size:12px;color:#64748b;text-align:center;margin-bottom:28px}
    .footer{font-size:11px;color:#94a3b8;text-align:center;padding-top:16px;border-top:1px solid #e2e8f0}
    .print-btn{position:fixed;top:16px;right:16px;padding:9px 20px;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;box-shadow:0 2px 8px rgba(220,38,38,.25)}
    @media print{.print-btn{display:none}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Guardar / Imprimir</button>
  <div class="header">
    <div class="logo">SanPedroMotoCare</div>
    <div class="badge">Orden de pago</div>
  </div>
  <h1>Orden de Pago</h1>
  <div class="tid">${ticket.ticketId}</div>
  <div class="grid">
    <div class="cell"><div class="lbl">Cliente</div><div class="val">${ticket.clientName ?? "—"}</div></div>
    <div class="cell"><div class="lbl">Teléfono</div><div class="val">${ticket.clientPhone ?? "—"}</div></div>
    <div class="cell"><div class="lbl">Servicio</div><div class="val">${serviceLabel}</div></div>
    <div class="cell"><div class="lbl">Fecha</div><div class="val">${today}</div></div>
  </div>
  <div class="amt">
    <div class="amt-lbl">Total a pagar</div>
    <div class="amt-val">$${amount} <span style="font-size:18px">MXN</span></div>
  </div>
  <div class="link-box">
    <div class="link-lbl">🔒 Link de pago seguro (Stripe)</div>
    <div class="link-url">${url}</div>
  </div>
  <p class="validity">⏱ El link es válido por 24 horas a partir de su generación</p>
  <div class="footer">SanPedroMotoCare · Servicio de reparación y mantenimiento de motocicletas a domicilio</div>
</body>
</html>`);
  win.document.close();
  win.focus();
}

// ── Ticket Detail Drawer ───────────────────────────────────────
function TicketDrawer({
  ticket, mechanics, isDark, userId, onClose,
}: {
  ticket: ServiceTicket | null;
  mechanics: Mechanic[];
  isDark: boolean;
  userId: string;
  onClose: () => void;
}) {
  const [note, setNote]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [editCost, setEditCost]   = useState(false);
  const [costs, setCosts]         = useState({ estimated: "", final: "", anticipo: "" });
  const [diagnosis, setDiagnosis] = useState("");
  const [selectedMechanic, setSelectedMechanic] = useState("");
  const [sendingLink, setSendingLink]         = useState(false);
  const [sendingAnticipo, setSendingAnticipo] = useState(false);
  const [anticipoAmount, setAnticipo]         = useState(200);
  const [markingCash, setMarkingCash]         = useState(false);
  const [showPayForm, setShowPayForm]         = useState(false);
  const [payAmount, setPayAmount]             = useState("");
  const [payMethod, setPayMethod]             = useState<PaymentMethod>("efectivo");
  const [payNote, setPayNote]                 = useState("");
  const [payLoading, setPayLoading]           = useState(false);
  const [generatedPaymentUrl, setGeneratedPaymentUrl] = useState<string | null>(null);
  const [generatedAnticipoUrl, setGeneratedAnticipoUrl] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm]               = useState(false);
  const [linkAmount, setLinkAmount]                   = useState("");
  const [linkSendWa, setLinkSendWa]                   = useState(true);

  // Parts from catalog
  const [products, setProducts]       = useState<Product[]>([]);
  const [parts, setParts]             = useState<PartItem[]>([]);
  const [partSearch, setPartSearch]   = useState("");
  const [partDropdown, setPartDropdown] = useState(false);

  const [workshopServices, setWorkshopServices] = useState<WorkshopService[]>([]);
  const [charges, setCharges] = useState<ServiceCharge[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceDropdown, setServiceDropdown] = useState(false);
  const [oneOffName, setOneOffName] = useState("");
  const [oneOffCost, setOneOffCost] = useState("");

  useEffect(() => {
    const unsub = subscribeActiveProducts(setProducts);
    const unsubServices = subscribeWorkshopServices(setWorkshopServices);
    return () => { unsub(); unsubServices(); };
  }, []);

  useEffect(() => {
    if (ticket) {
      setCosts({
        estimated: ticket.estimatedCost?.toString() ?? "",
        final:     ticket.finalCost?.toString()     ?? "",
        anticipo:  ticket.anticipo?.toString()       ?? "",
      });
      setDiagnosis(ticket.diagnosis ?? "");
      setSelectedMechanic(ticket.mechanicId ?? "");
      setParts(ticket.parts ?? []);
      setCharges(ticket.serviceCharges ?? []);
      setPartSearch("");
      setPartDropdown(false);
      setServiceSearch("");
      setOneOffName("");
      setOneOffCost("");
      setShowLinkForm(false);
      setLinkAmount("");
      setLinkSendWa(true);
      setGeneratedPaymentUrl(null);
    }
  }, [ticket?.id]);

  if (!ticket) return null;

  const nextStatus = NEXT_STATUS[ticket.status];

  async function handleAdvance() {
    if (!nextStatus) return;
    setSaving(true);
    try {
      console.log("[CRM] Avanzando ticket", ticket!.id, "→", nextStatus);
      await advanceTicketStatus(ticket!.id, nextStatus, note, userId);
      toast.success(`Estado → ${STATUS_LABELS[nextStatus]}`);
      setNote("");

      // Auto-send WhatsApp notification
      await notifyStatusChange(ticket!, nextStatus);

      // Deduct stock for parts when ticket is completed
      if (nextStatus === "completado") {
        const partsWithId = parts.filter(p => p.productId);
        for (const part of partsWithId) {
          try {
            await adjustStock(part.productId!, -part.qty, { type: "uso-servicio", reference: ticket!.id, note: `Ticket ${ticket!.ticketId}`, createdBy: userId });
          } catch (e) {
            console.warn("[CRM] Stock deduction failed for", part.productId, e);
          }
        }
      }

      // If advancing to "completado" and finalCost exists, offer payment link
      if (nextStatus === "completado" && ticket!.finalCost && ticket!.clientPhone) {
        toast.loading("Generando link de pago…", { id: "payment" });
        const url = await sendPaymentLink(ticket!);
        if (url) {
          toast.success("Link de pago enviado por WhatsApp ✅", { id: "payment" });
        } else {
          toast.dismiss("payment");
        }
      }
    } catch (err) {
      console.error("[CRM] Error al avanzar status:", err);
      toast.error("Error al actualizar estado");
    } finally { setSaving(false); }
  }

  async function handleCancel() {
    setSaving(true);
    try {
      await advanceTicketStatus(ticket!.id, "cancelado", note || "Cancelado desde CRM", userId);
      toast.success("Ticket cancelado");
      await notifyStatusChange(ticket!, "cancelado");
    } catch (err) {
      console.error("[CRM] Error al cancelar:", err);
      toast.error("Error");
    } finally { setSaving(false); }
  }

  async function handleSendPaymentLink() {
    const amount = Number(linkAmount);
    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    if (!ticket!.clientPhone) {
      toast.error("El ticket no tiene teléfono de cliente registrado");
      return;
    }
    setSendingLink(true);
    try {
      const remaining = (ticket!.finalCost ?? 0) - (ticket!.totalPaid ?? 0);
      const payType   = amount >= remaining ? "servicio" : "parcial";
      const res = await fetch("/api/payments/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId:           ticket!.ticketId,
          clientName:         ticket!.clientName ?? "Cliente",
          clientPhone:        ticket!.clientPhone,
          serviceDescription: ticket!.serviceDescription,
          serviceType:        ticket!.serviceType,
          amountMXN:          amount,
          sendWhatsApp:       linkSendWa,
          type:               payType,
        }),
      });
      const data = await res.json();
      if (data.url) {
        setGeneratedPaymentUrl(data.url);
        setShowLinkForm(false);
        toast.success(linkSendWa ? "Link generado y enviado por WhatsApp ✅" : "Link generado ✅");
      } else {
        toast.error("No se pudo generar el link de pago");
      }
    } catch {
      toast.error("Error al generar el link");
    } finally { setSendingLink(false); }
  }

  async function handleMarkCash() {
    setMarkingCash(true);
    try {
      await markAsPaidCash(ticket!.id, userId, {
        clientId: ticket!.clientId,
        finalCost: ticket!.finalCost,
      });
      toast.success("Pago en efectivo registrado ✅");
      await notifyStatusChange(ticket!, "pagado");
    } catch {
      toast.error("Error al registrar el pago");
    } finally {
      setMarkingCash(false);
    }
  }

  async function handleSendAnticipo() {
    if (!ticket!.clientPhone) {
      toast.error("El ticket no tiene teléfono de cliente");
      return;
    }
    if (anticipoAmount <= 0) {
      toast.error("El monto del anticipo debe ser mayor a $0");
      return;
    }
    setSendingAnticipo(true);
    try {
      const res = await fetch("/api/payments/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId:           ticket!.ticketId,
          clientName:         ticket!.clientName ?? "Cliente",
          clientPhone:        ticket!.clientPhone,
          serviceDescription: `Visita de diagnóstico — ${ticket!.ticketId}`,
          serviceType:        ticket!.serviceType,
          amountMXN:          anticipoAmount,
          sendWhatsApp:       true,
          type:               "anticipo",
        }),
      });
      const data = await res.json();
      if (data.url) {
        setGeneratedAnticipoUrl(data.url);
        toast.success(`Anticipo $${anticipoAmount} enviado por WhatsApp ✅`);
      } else {
        toast.error("No se pudo generar el link de anticipo");
      }
    } catch {
      toast.error("Error al generar el anticipo");
    } finally { setSendingAnticipo(false); }
  }

  async function handleSaveFields() {
    setSaving(true);
    try {
      const mechanic = mechanics.find(m => m.id === selectedMechanic);
      const partsTotal = parts.reduce((sum, part) => sum + (Number(part.total) || 0), 0);
      const servicesTotal = charges.reduce((sum, charge) => sum + (Number(charge.total) || 0), 0);
      const customerTotal = roundMoney(partsTotal + servicesTotal);
      await updateTicketFields(ticket!.id, {
        ...(charges.length > 0 ? { estimatedCost: customerTotal, finalCost: customerTotal } : {}),
        ...(costs.anticipo   !== "" ? { anticipo:      Number(costs.anticipo)  } : {}),
        ...(diagnosis        !== "" ? { diagnosis }                              : {}),
        ...(selectedMechanic        ? { mechanicId: selectedMechanic, mechanicName: mechanic?.name } : {}),
        parts,
        serviceCharges: charges,
      });
      toast.success("Actualizado");
      setEditCost(false);
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  }

  function addPartFromCatalog(product: Product) {
    const existing = parts.findIndex(p => p.productId === product.id);
    if (existing >= 0) {
      setParts(prev => prev.map((p, i) => i === existing
        ? { ...p, qty: p.qty + 1, total: (p.qty + 1) * p.unitCost }
        : p
      ));
    } else {
      const unitPrice = customerUnitPrice(product);
      setParts(prev => [...prev, {
        productId: product.id,
        name: product.shortName ?? product.name,
        qty: 1,
        unitCost: unitPrice,
        total: unitPrice,
      }]);
    }
    setPartSearch("");
    setPartDropdown(false);
  }

  function addServiceFromCatalog(service: WorkshopService) {
    const line = buildServiceCharge({
      name: service.name,
      costPrice: service.costPrice,
      serviceId: service.id,
      code: service.code,
    });
    setCharges(prev => {
      const existing = prev.findIndex(c => c.serviceId === service.id);
      if (existing < 0) return [...prev, line];
      return prev.map((c, i) => i === existing
        ? buildServiceCharge({ name: c.name, costPrice: c.costPrice, qty: c.qty + 1, serviceId: c.serviceId, code: c.code })
        : c);
    });
    setServiceSearch("");
    setServiceDropdown(false);
  }

  function addOneOffService() {
    const cost = Number(oneOffCost);
    if (!oneOffName.trim() || !Number.isFinite(cost) || cost < 0) {
      toast.error("Escribe el nombre y el costo del servicio");
      return;
    }
    setCharges(prev => [...prev, buildServiceCharge({ name: oneOffName, costPrice: cost })]);
    setOneOffName("");
    setOneOffCost("");
  }

  function updateChargeQty(index: number, qty: number) {
    setCharges(prev => {
      if (qty <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((c, i) => i === index
        ? buildServiceCharge({ name: c.name, costPrice: c.costPrice, qty, serviceId: c.serviceId, code: c.code })
        : c);
    });
  }

  function updatePartQty(index: number, qty: number) {
    if (qty <= 0) {
      setParts(prev => prev.filter((_, i) => i !== index));
    } else {
      setParts(prev => prev.map((p, i) => i === index ? { ...p, qty, total: qty * p.unitCost } : p));
    }
  }

  const inputCls = `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
    isDark ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900"
  }`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col ${
        isDark ? "bg-slate-900" : "bg-white"
      }`}>
        {/* Header */}
        <div className={`sticky top-0 flex items-center justify-between px-5 py-4 border-b z-10 ${
          isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100"
        }`}>
          <div>
            <p className="font-display font-bold text-base text-[var(--color-spm-red)]">{ticket.ticketId}</p>
            <StatusBadge status={ticket.status} />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200"><X size={18} /></button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Client info */}
          <div className={`p-4 rounded-2xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2 mb-3">
              <User size={14} className="text-[var(--color-spm-red)]" />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Cliente</span>
            </div>
            <p className={`font-semibold text-sm mb-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>{ticket.clientName ?? "—"}</p>
            {(ticket as unknown as { clientPhone?: string }).clientPhone && (
              <p className={`text-xs flex items-center gap-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Phone size={11} />{(ticket as unknown as { clientPhone?: string }).clientPhone}
              </p>
            )}
            <p className={`text-xs flex items-center gap-1 mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <MapPin size={11} />{ticket.serviceAddress?.street ?? "Sin dirección"}
            </p>
          </div>

          {/* Service info */}
          <div className={`p-4 rounded-2xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Wrench size={14} className="text-[var(--color-spm-red)]" />
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Servicio</span>
            </div>
            <p className={`text-sm font-semibold mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
              {SERVICE_LABELS[ticket.serviceType as keyof typeof SERVICE_LABELS] ?? ticket.serviceType}
            </p>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{ticket.serviceDescription}</p>
            {ticket.diagnosis && (
              <p className={`text-xs mt-2 italic ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Diagnóstico: {ticket.diagnosis}
              </p>
            )}
          </div>

          {/* Assign mechanic */}
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Mecánico asignado
            </label>
            <select className={inputCls} value={selectedMechanic}
              onChange={e => setSelectedMechanic(e.target.value)}>
              <option value="">Sin asignar</option>
              {mechanics.filter(m => m.status !== "inactivo").map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.status === "disponible" ? "✓ Disponible" : m.status}
                </option>
              ))}
            </select>
          </div>

          {/* Costs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Costos
              </span>
              <button onClick={() => setEditCost(!editCost)}
                className="text-xs text-[var(--color-spm-red)] hover:underline">
                {editCost ? "Cancelar" : "Editar"}
              </button>
            </div>
            {editCost ? (
              <div className="space-y-2">
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  El precio al cliente de cada servicio es el costo + {SALE_MARKUP_PERCENT}% y no se edita. Agrégalo en Servicios del taller.
                  {charges.length > 0 && (
                    <> Al guardar, el total del ticket queda en ${roundMoney(
                      charges.reduce((s, c) => s + c.total, 0) + parts.reduce((s, p) => s + p.total, 0)
                    ).toLocaleString("es-MX")}.</>
                  )}
                </p>
                <div>
                  <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Anticipo de visita $</label>
                  <input type="number" min="0" className={inputCls} placeholder="0"
                    value={costs.anticipo} onChange={e => setCosts(p => ({ ...p, anticipo: e.target.value }))} />
                </div>
                <div>
                  <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Diagnóstico / notas internas</label>
                  <textarea rows={2} className={inputCls + " resize-none mt-1"}
                    value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className={`grid grid-cols-3 gap-3 p-3 rounded-xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                {[
                  { label: "Estimado", value: ticket.estimatedCost },
                  { label: "Anticipo",  value: ticket.anticipo },
                  { label: "Final",     value: ticket.finalCost },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
                    <p className={`font-bold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                      {value != null ? `$${value.toLocaleString("es-MX")}` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Servicios del taller ───────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench size={14} className="text-[var(--color-spm-red)]" />
              <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Servicios del taller</span>
              {charges.length > 0 && (
                <span className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  ${charges.reduce((s, c) => s + c.total, 0).toLocaleString("es-MX")}
                </span>
              )}
            </div>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={inputCls + " pl-8 text-sm"}
                placeholder="Buscar servicio con precio..."
                value={serviceSearch}
                onChange={e => { setServiceSearch(e.target.value); setServiceDropdown(true); }}
                onFocus={() => setServiceDropdown(true)}
                onBlur={() => setTimeout(() => setServiceDropdown(false), 180)}
              />
              {serviceDropdown && serviceSearch.trim() && (
                <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-20 max-h-48 overflow-y-auto ${isDark ? "bg-slate-800 border-white/10" : "bg-white border-gray-200"}`}>
                  {workshopServices
                    .filter(s => s.isActive && (
                      s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
                      s.code.toLowerCase().includes(serviceSearch.toLowerCase())
                    ))
                    .slice(0, 8)
                    .map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={() => addServiceFromCatalog(s)}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-[var(--color-spm-red)]/10 border-b last:border-0 ${isDark ? "border-white/5" : "border-gray-100"}`}
                      >
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>{s.name}</p>
                          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{s.code} · costo ${s.costPrice.toLocaleString("es-MX")}</p>
                        </div>
                        <span className={`text-xs font-semibold ml-3 ${isDark ? "text-slate-300" : "text-slate-700"}`}>${customerUnitPrice(s).toLocaleString("es-MX")}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-[1fr_88px_auto] gap-2 mb-2">
              <input className={inputCls} placeholder="Servicio suelto" value={oneOffName}
                onChange={e => setOneOffName(e.target.value)} />
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="Costo" value={oneOffCost}
                onChange={e => setOneOffCost(e.target.value)} />
              <button type="button" onClick={addOneOffService}
                className="px-3 rounded-xl bg-slate-700 text-white text-xs font-semibold">
                +{SALE_MARKUP_PERCENT}%
              </button>
            </div>
            {oneOffCost !== "" && Number(oneOffCost) >= 0 && (
              <p className={`text-xs mb-2 ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                Precio al cliente: ${customerUnitPrice({ costPrice: Number(oneOffCost) }).toLocaleString("es-MX")} · utilidad ${ (customerUnitPrice({ costPrice: Number(oneOffCost) }) - Number(oneOffCost)).toLocaleString("es-MX") }
              </p>
            )}
            {charges.length > 0 && (
              <div className="space-y-1.5">
                {charges.map((charge, i) => (
                  <div key={`${charge.serviceId ?? charge.name}-${i}`} className={`flex items-center gap-2 p-2.5 rounded-xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>{charge.name}</p>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        costo ${charge.costPrice.toLocaleString("es-MX")} · venta ${charge.unitPrice.toLocaleString("es-MX")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button type="button" onClick={() => updateChargeQty(i, charge.qty - 1)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDark ? "bg-slate-700 text-white" : "bg-gray-200 text-slate-700"}`}>−</button>
                      <span className={`text-sm font-semibold w-6 text-center ${isDark ? "text-white" : "text-slate-900"}`}>{charge.qty}</span>
                      <button type="button" onClick={() => updateChargeQty(i, charge.qty + 1)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs ${isDark ? "bg-slate-700 text-white" : "bg-gray-200 text-slate-700"}`}>+</button>
                      <button type="button" onClick={() => setCharges(prev => prev.filter((_, j) => j !== i))}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Partes del catálogo ────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package size={14} className="text-[var(--color-spm-red)]" />
              <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Partes usadas</span>
              {parts.length > 0 && (
                <span className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Total: ${parts.reduce((s, p) => s + p.total, 0).toLocaleString("es-MX")}
                </span>
              )}
            </div>

            {/* Search bar */}
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={inputCls + " pl-8 text-sm"}
                placeholder="Buscar parte del catálogo..."
                value={partSearch}
                onChange={e => { setPartSearch(e.target.value); setPartDropdown(true); }}
                onFocus={() => setPartDropdown(true)}
                onBlur={() => setTimeout(() => setPartDropdown(false), 180)}
              />
              {partDropdown && partSearch.trim() && (
                <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-20 max-h-48 overflow-y-auto ${isDark ? "bg-slate-800 border-white/10" : "bg-white border-gray-200"}`}>
                  {products
                    .filter(p => {
                      const q = partSearch.toLowerCase();
                      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.shortName ?? "").toLowerCase().includes(q);
                    })
                    .slice(0, 8)
                    .map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => addPartFromCatalog(p)}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-[var(--color-spm-red)]/10 transition-colors border-b last:border-0 ${isDark ? "border-white/5" : "border-gray-100"}`}
                      >
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>{p.shortName ?? p.name}</p>
                          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{p.sku} · stock: {p.stock}</p>
                        </div>
                        <span className={`text-xs font-semibold ml-3 flex-shrink-0 ${isDark ? "text-slate-300" : "text-slate-700"}`}>${customerUnitPrice(p).toLocaleString("es-MX")}</span>
                      </button>
                    ))
                  }
                  {products.filter(p => { const q = partSearch.toLowerCase(); return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q); }).length === 0 && (
                    <div className="px-4 py-3 text-center">
                      <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Sin resultados</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Parts list */}
            {parts.length > 0 && (
              <div className="space-y-1.5">
                {parts.map((part, i) => (
                  <div key={i} className={`flex items-center gap-2 p-2.5 rounded-xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>{part.name}</p>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>${part.unitCost.toLocaleString("es-MX")} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => updatePartQty(i, part.qty - 1)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-slate-700"}`}>−</button>
                      <span className={`text-sm font-semibold w-6 text-center ${isDark ? "text-white" : "text-slate-900"}`}>{part.qty}</span>
                      <button onClick={() => updatePartQty(i, part.qty + 1)}
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-slate-700"}`}>+</button>
                      <button onClick={() => setParts(prev => prev.filter((_, j) => j !== i))}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors ml-0.5">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save fields button */}
          <button onClick={handleSaveFields} disabled={saving}
            className="w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar cambios
          </button>

          {/* ── Anticipo / guarantee deposit ──────────────────────────────── */}
          {ticket.status === "diagnostico-pendiente" && (
            <div className={`p-4 rounded-2xl border ${isDark ? "border-amber-900/30 bg-amber-950/20" : "border-amber-200 bg-amber-50"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                Cobrar visita de diagnóstico
              </p>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    min={0}
                    value={anticipoAmount}
                    onChange={e => setAnticipo(Number(e.target.value))}
                    className={`w-full pl-7 pr-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500 ${
                      isDark ? "bg-slate-800 border-white/10 text-white" : "bg-white border-gray-200 text-slate-900"
                    }`}
                  />
                </div>
                <span className={`self-center text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>MXN</span>
              </div>
              <button
                onClick={handleSendAnticipo}
                disabled={sendingAnticipo}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {sendingAnticipo ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                {ticket.anticipoLinkUrl ? "Reenviar link de anticipo" : `Cobrar visita ($${anticipoAmount})`}
              </button>

              {/* Anticipo URL panel */}
              {(generatedAnticipoUrl || ticket.anticipoLinkUrl) && (
                <div className={`mt-2 p-3 rounded-xl border space-y-2 ${isDark ? "border-amber-900/40 bg-amber-950/20" : "border-amber-200 bg-amber-50"}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                    URL de anticipo
                  </p>
                  <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-mono ${isDark ? "bg-slate-800 border-white/10 text-slate-300" : "bg-white border-gray-200 text-slate-700"}`}>
                    <span className="flex-1 truncate">{generatedAnticipoUrl ?? ticket.anticipoLinkUrl}</span>
                    <a href={generatedAnticipoUrl ?? ticket.anticipoLinkUrl ?? ""} target="_blank" rel="noopener noreferrer"
                      className="text-amber-500 hover:text-amber-400 flex-shrink-0">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedAnticipoUrl ?? ticket.anticipoLinkUrl ?? "").then(() => toast.success("URL copiada"))}
                    className={`w-full py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                      isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-300 text-slate-600 hover:bg-gray-100"
                    }`}>
                    <Copy size={11} />
                    Copiar URL del anticipo
                  </button>
                </div>
              )}

              {ticket.anticipoPagado && (
                <p className="text-xs text-green-400 text-center mt-2 font-medium">
                  ✓ Anticipo recibido — mecánico autorizado a salir
                </p>
              )}
            </div>
          )}

          {/* Payment confirmation badge — ticket already paid */}
          {ticket.status === "pagado" && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isDark ? "border-emerald-900/30 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}>
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                  Servicio pagado
                  {ticket.finalCost && ` — $${ticket.finalCost.toLocaleString("es-MX")} MXN`}
                </p>
                {ticket.paymentMethod && (
                  <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Método: {ticket.paymentMethod === "efectivo" ? "Efectivo" : "Stripe"}
                  </p>
                )}
              </div>
              {ticket.paymentMethod && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  ticket.paymentMethod === "efectivo"
                    ? isDark ? "bg-amber-900/40 text-amber-300" : "bg-amber-100 text-amber-700"
                    : isDark ? "bg-purple-900/40 text-purple-300" : "bg-purple-100 text-purple-700"
                }`}>
                  {ticket.paymentMethod === "efectivo" ? "Efectivo" : "Stripe"}
                </span>
              )}
            </div>
          )}

          {/* Payment options — visible when service is completed or in-service and has a final cost */}
          {(ticket.status === "completado" || ticket.status === "en-servicio") && ticket.finalCost && (
            <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? "border-emerald-900/30 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                  Cobrar servicio
                </p>
                <span className={`font-bold text-sm ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>
                  {(ticket.totalPaid ?? 0) > 0
                    ? `Resta: $${Math.max(0, ticket.finalCost - (ticket.totalPaid ?? 0)).toLocaleString("es-MX")}`
                    : `$${ticket.finalCost.toLocaleString("es-MX")} MXN`
                  }
                </span>
              </div>

              {!showPayForm ? (
                <div className="space-y-2">

                  {/* ── URL panel — visible once a link is generated ──────── */}
                  {(generatedPaymentUrl || ticket.paymentLinkUrl) && (
                    <div className={`p-3 rounded-xl border space-y-2 ${isDark ? "border-emerald-900/40 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                        Link de pago activo
                      </p>
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-mono ${isDark ? "bg-slate-800 border-white/10 text-slate-300" : "bg-white border-gray-200 text-slate-700"}`}>
                        <span className="flex-1 truncate">{generatedPaymentUrl ?? ticket.paymentLinkUrl}</span>
                        <a href={generatedPaymentUrl ?? ticket.paymentLinkUrl ?? ""} target="_blank" rel="noopener noreferrer"
                          className="text-emerald-500 hover:text-emerald-400 flex-shrink-0">
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(generatedPaymentUrl ?? ticket.paymentLinkUrl ?? "").then(() => toast.success("URL copiada"))}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                            isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-300 text-slate-600 hover:bg-gray-100"
                          }`}>
                          <Copy size={11} />
                          Copiar URL
                        </button>
                        <button
                          onClick={() => printPaymentOrder(ticket, generatedPaymentUrl ?? ticket.paymentLinkUrl ?? "")}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                            isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-300 text-slate-600 hover:bg-gray-100"
                          }`}>
                          <Printer size={11} />
                          Imprimir orden
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Stripe link form ─────────────────────────────────── */}
                  {showLinkForm ? (
                    <div className={`p-3 rounded-xl border space-y-2.5 ${isDark ? "border-emerald-900/30 bg-emerald-950/10" : "border-emerald-200 bg-emerald-50/60"}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                        Generar link de pago (Stripe)
                      </p>
                      {/* Amount */}
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                        <input
                          type="number" min={1} autoFocus
                          className={inputCls + " pl-7"}
                          placeholder="Monto a cobrar (MXN)"
                          value={linkAmount}
                          onChange={e => setLinkAmount(e.target.value)}
                        />
                      </div>
                      {/* WhatsApp toggle */}
                      <label className={`flex items-center gap-2 cursor-pointer select-none`}>
                        <input
                          type="checkbox"
                          checked={linkSendWa}
                          onChange={e => setLinkSendWa(e.target.checked)}
                          className="rounded accent-emerald-500"
                        />
                        <span className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                          Enviar por WhatsApp al cliente
                        </span>
                      </label>
                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowLinkForm(false)}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${isDark ? "border-white/10 text-slate-300" : "border-gray-200 text-slate-600"}`}>
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={sendingLink || !linkAmount || Number(linkAmount) <= 0}
                          onClick={handleSendPaymentLink}
                          className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all">
                          {sendingLink ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
                          Generar link
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const rem = Math.max(0, (ticket.finalCost ?? 0) - (ticket.totalPaid ?? 0));
                        setLinkAmount(rem > 0 ? rem.toString() : "");
                        setShowLinkForm(true);
                      }}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
                      <CreditCard size={14} />
                      {ticket.paymentLinkUrl ? "Nuevo link de pago (Stripe)" : "Generar link de pago (Stripe)"}
                    </button>
                  )}

                  <button onClick={() => { setShowPayForm(true); setShowLinkForm(false); setPayAmount(Math.max(0, ticket.finalCost! - (ticket.totalPaid ?? 0)).toString()); }}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border ${
                      isDark ? "border-white/10 text-slate-200 hover:bg-white/5" : "border-gray-300 text-slate-700 hover:bg-gray-100"
                    }`}>
                    <DollarSign size={14} />
                    Registrar pago manual
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Method selector */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["efectivo", "stripe", "transferencia"] as PaymentMethod[]).map(m => (
                      <button key={m} type="button" onClick={() => setPayMethod(m)}
                        className={`px-2 py-2 rounded-lg text-[10px] font-semibold transition-all ${
                          payMethod === m
                            ? "bg-[var(--color-spm-red)] text-white"
                            : isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-white text-slate-500 hover:bg-gray-100"
                        }`}>
                        {m === "efectivo" ? "Efectivo" : m === "stripe" ? "Stripe" : "Transfer."}
                      </button>
                    ))}
                  </div>
                  {/* Amount */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                    <input type="number" min={1} className={inputCls + " pl-7"} placeholder="Monto"
                      value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                  </div>
                  <input className={inputCls} placeholder="Nota opcional (referencia, concepto...)"
                    value={payNote} onChange={e => setPayNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowPayForm(false)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border ${isDark ? "border-white/10 text-slate-300" : "border-gray-200 text-slate-600"}`}>
                      Cancelar
                    </button>
                    <button
                      disabled={payLoading || !payAmount || Number(payAmount) <= 0}
                      onClick={async () => {
                        setPayLoading(true);
                        try {
                          const amt = Number(payAmount);
                          const remaining = ticket.finalCost! - (ticket.totalPaid ?? 0);
                          const pType = amt >= remaining ? "final" : "parcial";
                          await recordPayment(ticket.id, {
                            type: pType,
                            method: payMethod,
                            amount: amt,
                            note: payNote || undefined,
                            registeredBy: userId,
                            registeredByName: "Operador",
                          });
                          toast.success(`Pago de $${amt.toLocaleString("es-MX")} registrado`);
                          setShowPayForm(false);
                          setPayAmount("");
                          setPayNote("");
                        } catch { toast.error("Error al registrar pago"); }
                        finally { setPayLoading(false); }
                      }}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white disabled:opacity-50 flex items-center justify-center gap-1.5">
                      {payLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Registrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Link panel — ticket has a payment link but isn't at completado/pagado yet */}
          {ticket.status !== "completado" && ticket.status !== "en-servicio" && ticket.status !== "pagado" && (generatedPaymentUrl || ticket.paymentLinkUrl) && (
            <div className={`p-3 rounded-xl border space-y-2 ${isDark ? "border-emerald-900/40 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                Link de pago activo
              </p>
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-mono ${isDark ? "bg-slate-800 border-white/10 text-slate-300" : "bg-white border-gray-200 text-slate-700"}`}>
                <span className="flex-1 truncate">{generatedPaymentUrl ?? ticket.paymentLinkUrl}</span>
                <a href={generatedPaymentUrl ?? ticket.paymentLinkUrl ?? ""} target="_blank" rel="noopener noreferrer"
                  className="text-emerald-500 hover:text-emerald-400 flex-shrink-0">
                  <ExternalLink size={12} />
                </a>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(generatedPaymentUrl ?? ticket.paymentLinkUrl ?? "").then(() => toast.success("URL copiada"))}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-300 text-slate-600 hover:bg-gray-100"
                  }`}>
                  <Copy size={11} />
                  Copiar URL
                </button>
                <button
                  onClick={() => ticket.finalCost && printPaymentOrder(ticket, generatedPaymentUrl ?? ticket.paymentLinkUrl ?? "")}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-300 text-slate-600 hover:bg-gray-100"
                  }`}>
                  <Printer size={11} />
                  Imprimir orden
                </button>
              </div>
            </div>
          )}

          {/* PDF buttons — visible for completed or paid tickets */}
          {(ticket.status === "pagado" || ticket.status === "completado") && (
            <div className="flex gap-2">
              <button
                onClick={() => generateInvoicePDF(ticket)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border ${
                  isDark
                    ? "border-[var(--color-spm-red)]/30 bg-[var(--color-spm-red)]/10 text-[var(--color-spm-red)] hover:bg-[var(--color-spm-red)]/20"
                    : "border-red-200 bg-red-50 text-[var(--color-spm-red)] hover:bg-red-100"
                }`}
              >
                <Printer size={13} />
                Factura
              </button>
              {(ticket.payments ?? []).length > 0 && (
                <button
                  onClick={() => generatePartialInvoicePDF(ticket)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border ${
                    isDark
                      ? "border-blue-900/30 bg-blue-950/20 text-blue-400 hover:bg-blue-950/30"
                      : "border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100"
                  }`}
                >
                  <FileText size={13} />
                  Estado de cuenta
                </button>
              )}
            </div>
          )}

          {/* ── Status Pipeline Stepper ─────────────────────────────── */}
          {ticket.status !== "cancelado" && (
            <div className={`p-4 rounded-2xl border ${isDark ? "border-white/5 bg-slate-800/40" : "border-gray-100 bg-slate-50"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Pipeline del servicio
              </p>
              {/* Stepper visual */}
              <div className="flex items-center gap-0 mb-4 overflow-x-auto pb-1">
                {STATUS_PIPELINE.map((step, i) => {
                  const currentIdx = STATUS_PIPELINE.indexOf(ticket.status);
                  const isDone = i < currentIdx;
                  const isCurrent = step === ticket.status;
                  const isFuture = i > currentIdx;
                  const StepIcon = [Inbox, Stethoscope, Truck, Wrench, CheckCircle2, DollarSign][i];

                  return (
                    <div key={step} className="flex items-center flex-shrink-0">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isDone
                            ? "bg-green-500 text-white"
                            : isCurrent
                              ? "bg-[var(--color-spm-red)] text-white ring-2 ring-[var(--color-spm-red)]/30 ring-offset-1 " + (isDark ? "ring-offset-slate-800" : "ring-offset-slate-50")
                              : isDark ? "bg-slate-700 text-slate-500" : "bg-gray-200 text-gray-400"
                        }`}>
                          {isDone ? <Check size={14} /> : <StepIcon size={14} />}
                        </div>
                        <span className={`text-[9px] mt-1 font-semibold text-center leading-tight max-w-[52px] ${
                          isCurrent ? "text-[var(--color-spm-red)]"
                          : isDone ? (isDark ? "text-green-400" : "text-green-600")
                          : isDark ? "text-slate-500" : "text-slate-400"
                        }`}>
                          {STATUS_LABELS[step].split(" ").slice(0, 2).join(" ")}
                        </span>
                      </div>
                      {i < STATUS_PIPELINE.length - 1 && (
                        <div className={`w-4 h-0.5 mx-0.5 mt-[-12px] ${
                          isDone ? "bg-green-500" : isDark ? "bg-slate-700" : "bg-gray-200"
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              {ticket.status !== "pagado" && (
                <>
                  <textarea
                    rows={2}
                    placeholder="Nota opcional (ej: 'Cliente confirmo hora')"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className={inputCls + " resize-none mb-3"}
                  />
                  <div className="space-y-2">
                    {nextStatus && (
                      <button onClick={handleAdvance} disabled={saving}
                        className="w-full py-3 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={16} />}
                        Avanzar a: {STATUS_LABELS[nextStatus]}
                      </button>
                    )}
                    <button onClick={handleCancel} disabled={saving}
                      className={`w-full py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                        isDark ? "bg-red-950/30 text-red-400 hover:bg-red-950/50 border border-red-900/30"
                        : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      }`}>
                      <Ban size={12} />
                      Cancelar ticket
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Cancelled indicator */}
          {ticket.status === "cancelado" && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${isDark ? "border-red-900/30 bg-red-950/20" : "border-red-200 bg-red-50"}`}>
              <Ban size={18} className="text-red-400 flex-shrink-0" />
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-red-300" : "text-red-700"}`}>Ticket cancelado</p>
                <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {formatDate(ticket.updatedAt)}
                </p>
              </div>
            </div>
          )}

          {/* ── Payments section (partial payments) ────────────────── */}
          {(ticket.payments ?? []).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Pagos registrados ({(ticket.payments ?? []).length})
                </p>
                <button onClick={() => generatePartialInvoicePDF(ticket)}
                  className="text-xs text-[var(--color-spm-red)] hover:underline flex items-center gap-1">
                  <FileText size={11} /> Estado de cuenta
                </button>
              </div>
              <div className="space-y-1.5">
                {(ticket.payments ?? []).map(p => (
                  <div key={p.id} className={`flex items-center justify-between p-2.5 rounded-xl ${isDark ? "bg-slate-800/40" : "bg-slate-50"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        p.method === "stripe" ? "bg-purple-500/20 text-purple-400"
                        : p.method === "efectivo" ? "bg-amber-500/20 text-amber-400"
                        : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {p.method === "stripe" ? <CreditCard size={10} /> : p.method === "efectivo" ? <Banknote size={10} /> : <DollarSign size={10} />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                          ${p.amount.toLocaleString("es-MX")}
                          <span className={`ml-1.5 font-normal ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                            {p.type === "anticipo" ? "Anticipo" : p.type === "final" ? "Final" : "Parcial"}
                          </span>
                        </p>
                        <p className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          {formatDate(p.createdAt)} {p.registeredByName ? `· ${p.registeredByName}` : ""}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => generatePaymentReceiptPDF(ticket, p)}
                      className={`p-1 rounded-lg ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
                      title="Recibo">
                      <Receipt size={12} />
                    </button>
                  </div>
                ))}
              </div>
              {/* Payment progress */}
              {ticket.finalCost && (ticket.finalCost > 0) && (
                <div className="mt-2">
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                      style={{ width: `${Math.min(100, Math.round(((ticket.totalPaid ?? 0) / ticket.finalCost) * 100))}%` }}
                    />
                  </div>
                  <p className={`text-[10px] mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    {((ticket.totalPaid ?? 0) >= ticket.finalCost)
                      ? "Liquidado"
                      : `$${(ticket.totalPaid ?? 0).toLocaleString("es-MX")} de $${ticket.finalCost.toLocaleString("es-MX")} (${Math.round(((ticket.totalPaid ?? 0) / ticket.finalCost) * 100)}%)`
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {(ticket.statusHistory ?? []).length > 0 && (
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Historial
              </p>
              <div className="space-y-2">
                {[...(ticket.statusHistory ?? [])].reverse().map((ev, i) => (
                  <div key={i} className={`flex items-start gap-3 p-2.5 rounded-xl ${isDark ? "bg-slate-800/40" : "bg-slate-50"}`}>
                    <div className="w-2 h-2 rounded-full bg-[var(--color-spm-red)] mt-1.5 flex-shrink-0" />
                    <div>
                      <p className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {STATUS_LABELS[ev.status]}
                      </p>
                      {ev.note && <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{ev.note}</p>}
                      <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        {formatDate(ev.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"} space-y-1 pt-2 border-t ${isDark ? "border-white/5" : "border-gray-100"}`}>
            <div className="flex items-center gap-1.5">
              <Clock size={11} />Creado: {formatDate(ticket.createdAt)}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={11} />Actualizado: {formatDate(ticket.updatedAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TicketsPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [tickets,   setTickets]   = useState<ServiceTicket[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [clients,   setClients]   = useState<Client[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<string>("todos");
  const [search,    setSearch]    = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating,  setCreating]  = useState(false);

  useEffect(() => {
    const unsub1 = subscribeTickets((t) => { setTickets(t); setLoading(false); });
    const unsub2 = subscribeMechanics(setMechanics);
    const unsub3 = subscribeClients(setClients);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const selected = useMemo(() => tickets.find(t => t.id === selectedId) ?? null, [tickets, selectedId]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (filter === "activos") list = list.filter(t => ACTIVE_STATUSES.includes(t.status));
    else if (filter !== "todos") list = list.filter(t => t.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.ticketId?.toLowerCase().includes(q) ||
        (t.clientName ?? "").toLowerCase().includes(q) ||
        (t.mechanicName ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, filter, search]);

  // Stats
  const stats = useMemo(() => ({
    total:   tickets.length,
    active:  tickets.filter(t => ACTIVE_STATUSES.includes(t.status)).length,
    today:   tickets.filter(t => {
      const d = (t.createdAt as { toDate?: () => Date })?.toDate?.();
      if (!d) return false;
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length,
    revenue: tickets
      .filter(t => t.status === "pagado" && t.finalCost)
      .reduce((acc, t) => acc + (t.finalCost ?? 0), 0),
  }), [tickets]);

  const cardCls = `p-4 rounded-2xl border ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`;

  return (
    <CrmShell title="Tickets" subtitle="Órdenes de servicio en tiempo real">
      <Toaster position="top-right" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { icon: "🏍️", label: "Total tickets",  value: stats.total,   color: "text-slate-400" },
          { icon: "⚡", label: "Activos",         value: stats.active,  color: "text-blue-400" },
          { icon: "📅", label: "Creados hoy",     value: stats.today,   color: "text-orange-400" },
          { icon: "💰", label: "Ingresos cobrados", value: `$${stats.revenue.toLocaleString("es-MX")}`, color: "text-green-400" },
        ].map(s => (
          <div key={s.label} className={cardCls}>
            <span className="text-xl">{s.icon}</span>
            <p className={`font-display font-bold text-2xl mt-1 ${isDark ? "text-white" : "text-slate-900"}`}>{s.value}</p>
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border text-sm ${
          isDark ? "bg-slate-900 border-white/10" : "bg-white border-gray-200"
        }`}>
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="SPM-0001, nombre cliente, mecánico…"
            className={`bg-transparent outline-none w-full text-sm ${isDark ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"}`} />
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all flex-shrink-0">
          <Plus size={15} /> Nuevo ticket
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {FILTER_TABS.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === tab.value
                ? "bg-[var(--color-spm-red)] text-white"
                : isDark
                  ? "bg-white/5 text-slate-400 hover:bg-white/10"
                  : "bg-gray-100 text-slate-600 hover:bg-gray-200"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-[var(--color-spm-red)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed ${
          isDark ? "border-white/10 text-slate-500" : "border-gray-200 text-slate-400"
        }`}>
          <AlertCircle size={36} className="mb-3 opacity-40" />
          <p className="font-semibold">Sin tickets{filter !== "todos" ? ` en estado "${filter}"` : ""}</p>
          <p className="text-sm mt-1">
            {search ? "Prueba con otro término de búsqueda" : "Crea el primer ticket con el botón de arriba"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => (
            <button key={ticket.id} onClick={() => setSelectedId(ticket.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all hover:scale-[1.005] hover:border-[var(--color-spm-red)]/30 ${
                isDark ? "bg-slate-900 border-white/5 hover:bg-slate-800" : "bg-white border-gray-100 hover:border-gray-200 shadow-sm"
              }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-display font-bold text-sm text-[var(--color-spm-red)]">{ticket.ticketId}</span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p className={`font-semibold text-sm truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                    {ticket.clientName ?? "Cliente sin nombre"}
                  </p>
                  <p className={`text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {SERVICE_LABELS[ticket.serviceType as keyof typeof SERVICE_LABELS] ?? ticket.serviceType}
                    {ticket.mechanicName && ` · 🔧 ${ticket.mechanicName}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{formatDate(ticket.createdAt)}</p>
                  {ticket.estimatedCost != null && (
                    <p className={`text-xs font-semibold mt-0.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      ${ticket.estimatedCost.toLocaleString("es-MX")}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      <CreateTicketModal open={creating} onClose={() => setCreating(false)} isDark={isDark} clients={clients} />

      {/* Detail drawer */}
      <TicketDrawer
        ticket={selected}
        mechanics={mechanics}
        isDark={isDark}
        userId={user?.uid ?? ""}
        onClose={() => setSelectedId(null)}
      />
    </CrmShell>
  );
}
