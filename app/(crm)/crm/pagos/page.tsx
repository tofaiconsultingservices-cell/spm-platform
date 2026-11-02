"use client";

import { useState, useEffect, useMemo } from "react";
import CrmShell from "@/components/crm/CrmShell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { subscribeTickets, recordPayment } from "@/lib/firestore/tickets";
import type { ServiceTicket, TicketPayment, PaymentMethod, PaymentType } from "@/types";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, SERVICE_LABELS } from "@/types";
import {
  CreditCard, DollarSign, Search, X, Loader2,
  CheckCircle2, Clock, Receipt, ArrowUpRight,
  Banknote, Building, Filter, ExternalLink, Copy,
} from "lucide-react";
import { generatePaymentReceiptPDF } from "@/lib/invoice-pdf";
import toast, { Toaster } from "react-hot-toast";

function formatDate(ts: unknown): string {
  if (!ts) return "";
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 0 })}`;
}

const METHOD_ICONS: Record<PaymentMethod, typeof CreditCard> = {
  stripe: CreditCard,
  efectivo: Banknote,
  transferencia: Building,
};

function printPaymentOrderFromModal(ticketId: string, clientName: string, clientPhone: string, serviceLabel: string, amountMXN: number, url: string) {
  const win = window.open("", "_blank", "width=700,height=620");
  if (!win) return;
  const amount = amountMXN.toLocaleString("es-MX");
  const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Orden de Pago — ${ticketId}</title>
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
  <div class="tid">${ticketId}</div>
  <div class="grid">
    <div class="cell"><div class="lbl">Cliente</div><div class="val">${clientName}</div></div>
    <div class="cell"><div class="lbl">Teléfono</div><div class="val">${clientPhone || "—"}</div></div>
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

// ── Register Payment Modal ────────────────────────────────────
function RegisterPaymentModal({
  open, onClose, isDark, tickets, userId, userName,
}: {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  tickets: ServiceTicket[];
  userId: string;
  userName: string;
}) {
  const [ticketSearch, setTicketSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<ServiceTicket | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [type, setType] = useState<PaymentType>("parcial");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendStripeLink, setSendStripeLink] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedTicket(null);
      setTicketSearch("");
      setMethod("efectivo");
      setType("parcial");
      setAmount("");
      setNote("");
      setSendStripeLink(false);
      setGeneratedUrl(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedTicket) {
      const fc = selectedTicket.finalCost ?? 0;
      const tp = selectedTicket.totalPaid ?? 0;
      const remaining = fc - tp;
      if (remaining > 0 && !amount) setAmount(remaining.toString());
    }
  }, [selectedTicket]);

  const eligibleTickets = useMemo(() => {
    const q = ticketSearch.toLowerCase();
    return tickets
      .filter(t => t.status !== "pagado" && t.status !== "cancelado")
      .filter(t =>
        !q ||
        t.ticketId?.toLowerCase().includes(q) ||
        (t.clientName ?? "").toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [tickets, ticketSearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket || !amount || Number(amount) <= 0) {
      toast.error("Selecciona un ticket y monto válido");
      return;
    }

    setLoading(true);
    try {
      if (method === "stripe" && sendStripeLink) {
        const res = await fetch("/api/payments/create-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: selectedTicket.ticketId,
            clientName: selectedTicket.clientName ?? "Cliente",
            clientPhone: selectedTicket.clientPhone,
            serviceDescription: selectedTicket.serviceDescription,
            serviceType: selectedTicket.serviceType,
            amountMXN: Number(amount),
            sendWhatsApp: true,
            type: type === "anticipo" ? "anticipo" : type === "parcial" ? "parcial" : "servicio",
          }),
        });
        const data = await res.json();
        if (data.url) {
          setGeneratedUrl(data.url);
          toast.success("Link de Stripe enviado por WhatsApp");
          setLoading(false);
          return; // stay open so operator can copy/print the URL
        } else {
          toast.error("No se pudo generar el link");
          setLoading(false);
          return;
        }
      }

      if (method !== "stripe" || !sendStripeLink) {
        await recordPayment(selectedTicket.id, {
          type,
          method,
          amount: Number(amount),
          note: note || undefined,
          registeredBy: userId,
          registeredByName: userName,
        });
        toast.success(`Pago de ${formatCurrency(Number(amount))} registrado`);
      }

      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar el pago");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
    isDark ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400"
  }`;
  const labelCls = `block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`;

  const remaining = selectedTicket
    ? (selectedTicket.finalCost ?? 0) - (selectedTicket.totalPaid ?? 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-slate-900" : "bg-white"}`}>
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
          <h3 className={`font-display font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>Registrar Pago</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Ticket selector */}
          <div>
            <label className={labelCls}>Ticket *</label>
            {selectedTicket ? (
              <div className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? "border-emerald-900/40 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}>
                <div>
                  <p className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                    <span className="text-[var(--color-spm-red)] font-mono">{selectedTicket.ticketId}</span>
                    {" — "}{selectedTicket.clientName}
                  </p>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Costo: {formatCurrency(selectedTicket.finalCost ?? 0)}
                    {(selectedTicket.totalPaid ?? 0) > 0 && ` · Pagado: ${formatCurrency(selectedTicket.totalPaid ?? 0)}`}
                    {remaining > 0 && ` · Restante: ${formatCurrency(remaining)}`}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedTicket(null)} className="text-slate-400 hover:text-slate-200 p-1 ml-2"><X size={16} /></button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder="Buscar por SPM-XXXX o nombre..."
                  value={ticketSearch}
                  onChange={e => { setTicketSearch(e.target.value); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 180)}
                />
                {dropdownOpen && (
                  <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-20 max-h-52 overflow-y-auto ${isDark ? "bg-slate-800 border-white/10" : "bg-white border-gray-200"}`}>
                    {eligibleTickets.length === 0 ? (
                      <div className="px-4 py-4 text-center">
                        <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Sin tickets pendientes</p>
                      </div>
                    ) : eligibleTickets.map(t => (
                      <button key={t.id} type="button"
                        onMouseDown={() => { setSelectedTicket(t); setDropdownOpen(false); setTicketSearch(""); }}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-[var(--color-spm-red)]/10 transition-colors border-b last:border-0 ${isDark ? "border-white/5" : "border-gray-100"}`}>
                        <div>
                          <p className={`font-medium text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                            <span className="text-[var(--color-spm-red)] font-mono">{t.ticketId}</span>
                            {" — "}{t.clientName ?? "Sin nombre"}
                          </p>
                          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {SERVICE_LABELS[t.serviceType as keyof typeof SERVICE_LABELS] ?? t.serviceType}
                            {t.finalCost ? ` · ${formatCurrency(t.finalCost)}` : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className={labelCls}>Metodo de pago *</label>
            <div className="grid grid-cols-3 gap-2">
              {(["efectivo", "stripe", "transferencia"] as PaymentMethod[]).map(m => {
                const Icon = METHOD_ICONS[m];
                const active = method === m;
                return (
                  <button key={m} type="button" onClick={() => setMethod(m)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? "border-[var(--color-spm-red)] bg-[var(--color-spm-red)]/10 text-[var(--color-spm-red)]"
                        : isDark
                          ? "border-white/10 text-slate-400 hover:border-white/20"
                          : "border-gray-200 text-slate-500 hover:border-gray-300"
                    }`}>
                    <Icon size={18} />
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment type */}
          <div>
            <label className={labelCls}>Tipo *</label>
            <div className="grid grid-cols-3 gap-2">
              {(["anticipo", "parcial", "final"] as PaymentType[]).map(t => {
                const active = type === t;
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      active
                        ? "border-[var(--color-spm-red)] bg-[var(--color-spm-red)]/10 text-[var(--color-spm-red)]"
                        : isDark
                          ? "border-white/10 text-slate-400 hover:border-white/20"
                          : "border-gray-200 text-slate-500 hover:border-gray-300"
                    }`}>
                    {PAYMENT_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className={labelCls}>Monto (MXN) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input type="number" min={1} step="0.01" className={inputCls + " pl-7"}
                placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            {selectedTicket && remaining > 0 && (
              <button type="button" onClick={() => setAmount(remaining.toString())}
                className="text-xs text-[var(--color-spm-red)] hover:underline mt-1">
                Usar saldo restante: {formatCurrency(remaining)}
              </button>
            )}
          </div>

          {/* Stripe: send link option */}
          {method === "stripe" && (
            <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${
              isDark ? "border-white/10 bg-slate-800/50" : "border-gray-200 bg-gray-50"
            }`}>
              <input type="checkbox" checked={sendStripeLink} onChange={e => setSendStripeLink(e.target.checked)}
                className="rounded text-[var(--color-spm-red)]" />
              <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Generar link de Stripe y enviar por WhatsApp
              </span>
            </label>
          )}

          {/* Note */}
          <div>
            <label className={labelCls}>Nota (opcional)</label>
            <textarea rows={2} className={inputCls + " resize-none"} placeholder="Referencia, concepto..."
              value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {/* Generated URL panel */}
          {generatedUrl && (
            <div className={`p-3 rounded-xl border space-y-2 ${isDark ? "border-emerald-900/40 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                URL de pago generada
              </p>
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-mono ${isDark ? "bg-slate-800 border-white/10 text-slate-300" : "bg-white border-gray-200 text-slate-700"}`}>
                <span className="flex-1 truncate">{generatedUrl}</span>
                <a href={generatedUrl} target="_blank" rel="noopener noreferrer"
                  className="text-emerald-500 hover:text-emerald-400 flex-shrink-0">
                  <ExternalLink size={12} />
                </a>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => navigator.clipboard.writeText(generatedUrl).then(() => toast.success("URL copiada"))}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-300 text-slate-600 hover:bg-gray-100"
                  }`}>
                  <Copy size={11} />
                  Copiar URL
                </button>
                <button type="button"
                  onClick={() => selectedTicket && printPaymentOrderFromModal(
                    selectedTicket.ticketId,
                    selectedTicket.clientName ?? "Cliente",
                    selectedTicket.clientPhone ?? "",
                    SERVICE_LABELS[selectedTicket.serviceType as keyof typeof SERVICE_LABELS] ?? selectedTicket.serviceType,
                    Number(amount),
                    generatedUrl,
                  )}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-300 text-slate-600 hover:bg-gray-100"
                  }`}>
                  <Receipt size={11} />
                  Imprimir orden
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-200 text-slate-600 hover:bg-gray-50"}`}>
              {generatedUrl ? "Cerrar" : "Cancelar"}
            </button>
            {!generatedUrl && (
              <button type="submit" disabled={loading || !selectedTicket || !amount}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 size={14} className="animate-spin" />}
                {method === "stripe" && sendStripeLink ? "Enviar link de cobro" : "Registrar pago"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function PagosPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "todos">("todos");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = subscribeTickets((t) => { setTickets(t); setLoading(false); });
    return unsub;
  }, []);

  const allPayments = useMemo(() => {
    const list: (TicketPayment & { ticket: ServiceTicket })[] = [];
    for (const t of tickets) {
      for (const p of t.payments ?? []) {
        list.push({ ...p, ticket: t });
      }
    }
    list.sort((a, b) => {
      const ta = (a.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      const tb = (b.createdAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
      return tb - ta;
    });
    return list;
  }, [tickets]);

  const filtered = useMemo(() => {
    let list = allPayments;
    if (methodFilter !== "todos") list = list.filter(p => p.method === methodFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.ticket.ticketId?.toLowerCase().includes(q) ||
        (p.ticket.clientName ?? "").toLowerCase().includes(q) ||
        (p.note ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [allPayments, methodFilter, search]);

  const stats = useMemo(() => {
    const totalRecaudado = allPayments.reduce((s, p) => s + p.amount, 0);
    const stripe = allPayments.filter(p => p.method === "stripe").reduce((s, p) => s + p.amount, 0);
    const efectivo = allPayments.filter(p => p.method === "efectivo").reduce((s, p) => s + p.amount, 0);
    const transferencia = allPayments.filter(p => p.method === "transferencia").reduce((s, p) => s + p.amount, 0);
    const pendiente = tickets
      .filter(t => t.status === "completado" || t.status === "en-servicio")
      .reduce((s, t) => s + Math.max(0, (t.finalCost ?? 0) - (t.totalPaid ?? 0)), 0);
    return { totalRecaudado, stripe, efectivo, transferencia, pendiente, count: allPayments.length };
  }, [allPayments, tickets]);

  const card = `rounded-2xl border p-5 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`;

  return (
    <CrmShell title="Pagos" subtitle="Registro de cobros, pagos parciales y recibos">
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Total recaudado", value: formatCurrency(stats.totalRecaudado), icon: DollarSign, color: "text-green-400", bg: "bg-green-500/10" },
            { label: "Stripe", value: formatCurrency(stats.stripe), icon: CreditCard, color: "text-purple-400", bg: "bg-purple-500/10" },
            { label: "Efectivo", value: formatCurrency(stats.efectivo), icon: Banknote, color: "text-amber-400", bg: "bg-amber-500/10" },
            { label: "Transferencia", value: formatCurrency(stats.transferencia), icon: Building, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Por cobrar", value: formatCurrency(stats.pendiente), icon: Clock, color: "text-red-400", bg: "bg-red-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={card}>
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={16} className={color} />
              </div>
              <p className={`text-xl font-display font-bold mb-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>{value}</p>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Poliza de Mantenimiento — link compartible */}
        <div className={`flex items-center gap-4 p-4 rounded-2xl border ${
          isDark ? "bg-emerald-950/20 border-emerald-800/30" : "bg-emerald-50 border-emerald-200"
        }`}>
          <span className="text-2xl flex-shrink-0">🛵</span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
              Poliza de Mantenimiento para Repartidores — $99 MXN/mes
            </p>
            <p className={`text-xs mt-0.5 font-mono truncate ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              https://buy.stripe.com/test_14A6oAbSo6bm8XZ5imfQI00
            </p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText("https://buy.stripe.com/test_14A6oAbSo6bm8XZ5imfQI00");
              toast.success("Link copiado al portapapeles");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0 ${
              isDark ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            }`}
          >
            <Copy size={12} />
            Copiar link
          </button>
          <a
            href="https://buy.stripe.com/test_14A6oAbSo6bm8XZ5imfQI00"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0 ${
              isDark ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-white text-slate-700 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <ExternalLink size={12} />
            Abrir
          </a>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className={`flex items-center gap-2 flex-1 px-4 py-2.5 rounded-xl border text-sm ${
            isDark ? "bg-slate-900 border-white/10" : "bg-white border-gray-200"
          }`}>
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por ticket, cliente o nota..."
              className={`bg-transparent outline-none w-full text-sm ${isDark ? "text-white placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"}`} />
          </div>
          <div className="flex gap-2">
            <select value={methodFilter}
              onChange={e => setMethodFilter(e.target.value as PaymentMethod | "todos")}
              className={`px-3 py-2.5 rounded-xl border text-sm outline-none ${
                isDark ? "bg-slate-900 border-white/10 text-white" : "bg-white border-gray-200 text-slate-800"
              }`}>
              <option value="todos">Todos los metodos</option>
              <option value="stripe">Stripe</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all flex-shrink-0">
              <DollarSign size={15} /> Registrar pago
            </button>
          </div>
        </div>

        {/* Payment list */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[var(--color-spm-red)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed ${
            isDark ? "border-white/10 text-slate-500" : "border-gray-200 text-slate-400"
          }`}>
            <DollarSign size={36} className="mb-3 opacity-40" />
            <p className="font-semibold">Sin pagos registrados</p>
            <p className="text-sm mt-1">Registra el primer pago con el boton de arriba</p>
          </div>
        ) : (
          <div className={`rounded-2xl border overflow-hidden ${isDark ? "border-white/5" : "border-gray-100"}`}>
            {/* Header */}
            <div className={`grid grid-cols-[1fr_1.2fr_100px_100px_100px_80px_60px] gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b ${
              isDark ? "bg-slate-800 border-white/5 text-slate-400" : "bg-slate-50 border-gray-100 text-slate-500"
            }`}>
              <span>Ticket / Cliente</span>
              <span>Nota</span>
              <span className="text-center">Tipo</span>
              <span className="text-center">Metodo</span>
              <span className="text-right">Monto</span>
              <span className="text-center">Fecha</span>
              <span className="text-center">Recibo</span>
            </div>

            <div className={isDark ? "bg-slate-900" : "bg-white"}>
              {filtered.map((p, i) => {
                const MIcon = METHOD_ICONS[p.method as PaymentMethod] ?? CreditCard;
                return (
                  <div key={p.id}
                    className={`grid grid-cols-[1fr_1.2fr_100px_100px_100px_80px_60px] gap-3 items-center px-5 py-3.5 border-b transition-colors hover:bg-white/5 ${
                      i === filtered.length - 1 ? "border-0" : isDark ? "border-white/5" : "border-gray-50"
                    }`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                        <span className="text-[var(--color-spm-red)] font-mono">{p.ticket.ticketId}</span>
                      </p>
                      <p className={`text-xs truncate ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        {p.ticket.clientName ?? ""}
                      </p>
                    </div>

                    <p className={`text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {p.note || "—"}
                    </p>

                    <div className="flex justify-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.type === "anticipo" ? "bg-amber-500/15 text-amber-400"
                        : p.type === "final" ? "bg-green-500/15 text-green-400"
                        : "bg-blue-500/15 text-blue-400"
                      }`}>
                        {PAYMENT_TYPE_LABELS[p.type]}
                      </span>
                    </div>

                    <div className="flex justify-center items-center gap-1.5">
                      <MIcon size={12} className={isDark ? "text-slate-400" : "text-slate-500"} />
                      <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {p.method === "stripe" ? "Stripe" : p.method === "efectivo" ? "Efectivo" : "Transfer."}
                      </span>
                    </div>

                    <p className={`text-sm font-display font-bold text-right ${isDark ? "text-white" : "text-slate-900"}`}>
                      {formatCurrency(p.amount)}
                    </p>

                    <p className={`text-xs text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      {formatDate(p.createdAt)}
                    </p>

                    <div className="flex justify-center">
                      <button
                        onClick={() => generatePaymentReceiptPDF(p.ticket, p)}
                        title="Generar recibo"
                        className={`p-1.5 rounded-lg transition-all hover:scale-105 ${
                          isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-700 hover:bg-gray-100"
                        }`}>
                        <Receipt size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className={`px-5 py-3 border-t ${isDark ? "bg-slate-800/60 border-white/5" : "bg-slate-50 border-gray-100"}`}>
              <div className="flex items-center justify-between text-sm">
                <span className={`font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {filtered.length} pago{filtered.length !== 1 ? "s" : ""}
                </span>
                <span className={`font-display font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Total: <span className="text-green-400">{formatCurrency(filtered.reduce((s, p) => s + p.amount, 0))}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tickets with pending balance */}
        {!loading && (
          <>
            <h3 className={`font-display font-bold text-base mt-6 ${isDark ? "text-white" : "text-slate-900"}`}>
              Tickets con saldo pendiente
            </h3>
            <div className="space-y-2">
              {tickets
                .filter(t =>
                  (t.status === "completado" || t.status === "en-servicio") &&
                  t.finalCost && (t.finalCost - (t.totalPaid ?? 0)) > 0
                )
                .map(t => {
                  const remaining = (t.finalCost ?? 0) - (t.totalPaid ?? 0);
                  const pct = t.finalCost ? Math.round(((t.totalPaid ?? 0) / t.finalCost) * 100) : 0;
                  return (
                    <div key={t.id} className={`p-4 rounded-2xl border ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-mono font-bold text-sm text-[var(--color-spm-red)]">{t.ticketId}</span>
                          <span className={`ml-2 text-sm ${isDark ? "text-white" : "text-slate-900"}`}>{t.clientName}</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Restante: </span>
                          <span className={`font-bold text-sm ${isDark ? "text-amber-400" : "text-amber-600"}`}>
                            {formatCurrency(remaining)}
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-slate-800" : "bg-gray-100"}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--color-spm-red)] to-[var(--color-spm-orange)] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          {formatCurrency(t.totalPaid ?? 0)} de {formatCurrency(t.finalCost ?? 0)} ({pct}%)
                        </span>
                        <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          {(t.payments ?? []).length} pago{(t.payments ?? []).length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })}
              {tickets.filter(t =>
                (t.status === "completado" || t.status === "en-servicio") &&
                t.finalCost && (t.finalCost - (t.totalPaid ?? 0)) > 0
              ).length === 0 && (
                <div className={`text-center py-8 rounded-2xl border border-dashed ${
                  isDark ? "border-white/10 text-slate-500" : "border-gray-200 text-slate-400"
                }`}>
                  <CheckCircle2 size={24} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Todos los tickets estan al corriente</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <RegisterPaymentModal
        open={creating}
        onClose={() => setCreating(false)}
        isDark={isDark}
        tickets={tickets}
        userId={user?.uid ?? ""}
        userName={user?.displayName ?? "Operador"}
      />
    </CrmShell>
  );
}
