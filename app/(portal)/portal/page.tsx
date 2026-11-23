"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { subscribeTickets } from "@/lib/firestore/tickets";
import type { ServiceTicket } from "@/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import {
  Bike, FileText, CreditCard, User, LogOut, Plus,
  Search, Clock, CheckCircle2, AlertCircle, Loader2, Home,
  ExternalLink, BadgeCheck,
} from "lucide-react";
import NotificationPermission from "@/components/portal/NotificationPermission";

function formatDate(ts: unknown): string {
  if (!ts) return "";
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export default function PortalPage() {
  const { user, signOut, loading } = useAuth();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();
  const [myTickets, setMyTickets] = useState<ServiceTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [ticketSearch, setTicketSearch] = useState("");
  const trackingFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeTickets(all => {
      const email = user.email?.toLowerCase();
      const phone = user.phone;
      setMyTickets(
        all
          .filter(t =>
            (email && t.clientEmail?.toLowerCase() === email) ||
            (phone && t.clientPhone === phone)
          )
          .slice(0, 5)
      );
      setTicketsLoading(false);
    });
    return unsub;
  }, [user]);

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--color-spm-red)]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={`min-h-screen ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      {/* Header */}
      <header className={`sticky top-0 z-30 border-b px-4 lg:px-8 py-3 ${
        isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-200"
      } backdrop-blur-sm`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-8 h-8">
              <Image src="/images/logo.png" alt="SPM" fill className="object-contain" />
            </div>
            <span className={`font-display font-bold text-base ${isDark ? "text-white" : "text-slate-900"}`}>
              SPM <span className="text-[var(--color-spm-red)]">Portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                isDark ? "border-white/10 text-slate-400 hover:text-white" : "border-gray-200 text-slate-500"
              }`}
            >
              <Home size={12} />
              Inicio
            </Link>
            <button
              onClick={handleSignOut}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all text-red-400 ${
                isDark ? "border-red-900/30 hover:bg-red-950/20" : "border-red-200 hover:bg-red-50"
              }`}
            >
              <LogOut size={12} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className={`font-display font-bold text-2xl lg:text-3xl ${isDark ? "text-white" : "text-slate-900"}`}>
            {t("portal_welcome")}, {user.displayName?.split(" ")[0]} 👋
          </h1>
          <p className={`text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Gestiona tus servicios, pagos y motocicletas
          </p>
        </div>

        {/* FCM notification permission banner */}
        <NotificationPermission />

        {/* Quick Nav Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { href: "/portal/servicios", label: t("portal_services"), icon: Bike, color: "from-red-600 to-red-700" },
            { href: "/portal/pagar", label: t("portal_payments"), icon: CreditCard, color: "from-green-600 to-green-700" },
            { href: "/portal/moto", label: t("portal_moto"), icon: FileText, color: "from-blue-600 to-blue-700" },
            { href: "/portal/perfil", label: t("portal_profile"), icon: User, color: "from-purple-600 to-purple-700" },
            { href: "/portal/membresias", label: "Mi membresía", icon: BadgeCheck, color: "from-emerald-600 to-teal-700" },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-br ${color} text-white hover:scale-[1.03] transition-all shadow-lg min-h-[100px]`}
            >
              <Icon size={24} className="mb-2" />
              <span className="text-sm font-semibold text-center">{label}</span>
            </Link>
          ))}
        </div>

        {/* Poliza de Mantenimiento para Repartidores */}
        <a
          href="https://buy.stripe.com/test_14A6oAbSo6bm8XZ5imfQI00"
          target="_blank"
          rel="noopener noreferrer"
          className={`block rounded-2xl border overflow-hidden mb-8 hover:scale-[1.01] transition-all ${
            isDark ? "bg-gradient-to-r from-emerald-950 to-slate-900 border-emerald-800/30" : "bg-gradient-to-r from-emerald-50 to-white border-emerald-200 shadow-sm"
          }`}
        >
          <div className="flex items-center gap-4 p-5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isDark ? "bg-emerald-500/20" : "bg-emerald-100"
            }`}>
              <span className="text-2xl">🛵</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className={`font-display font-bold text-base ${isDark ? "text-white" : "text-slate-900"}`}>
                  Poliza de Mantenimiento para Repartidores
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
                }`}>
                  NUEVO
                </span>
              </div>
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Mantenimiento preventivo mensual para tu moto de trabajo. Diagnostico, ajustes y prioridad en servicio.
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className={`font-display font-bold text-2xl ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                $99
              </p>
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>MXN/mes</p>
            </div>
            <ExternalLink size={16} className={`flex-shrink-0 ${isDark ? "text-slate-500" : "text-slate-400"}`} />
          </div>
        </a>

        {/* Track a ticket */}
        <div className={`rounded-2xl border p-5 mb-6 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`}>
          <h2 className={`font-semibold text-base mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
            Rastrear servicio
          </h2>
          <form
            ref={trackingFormRef}
            onSubmit={(e) => {
              e.preventDefault();
              const clean = ticketSearch.trim().toUpperCase();
              if (clean) router.push(`/tracking?ticket=${encodeURIComponent(clean)}`);
            }}
            className="flex gap-3"
          >
            <div className="relative flex-1">
              <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-gray-400"}`} />
              <input
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                placeholder="SPM-1234"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-spm-red)]/40 focus:border-[var(--color-spm-red)] transition-all ${
                  isDark
                    ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-600"
                    : "bg-slate-50 border-gray-200 text-slate-900 placeholder:text-slate-400"
                }`}
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[var(--color-spm-red)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-spm-red-dark)] transition-all"
            >
              Rastrear
            </button>
          </form>
        </div>

        {/* Recent Services — real data */}
        <div className={`rounded-2xl border ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-inherit">
            <h2 className={`font-semibold text-base ${isDark ? "text-white" : "text-slate-900"}`}>
              Mis servicios recientes
            </h2>
            <Link href="/portal/servicios" className="text-xs text-[var(--color-spm-red)] hover:underline">
              Ver todos →
            </Link>
          </div>

          <div className="p-3">
            {ticketsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-[var(--color-spm-red)]" />
              </div>
            ) : myTickets.length === 0 ? (
              <div className={`text-center py-10`}>
                <Bike size={36} className={`mx-auto mb-3 ${isDark ? "text-slate-700" : "text-slate-300"}`} />
                <p className={`font-medium text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Sin servicios registrados aún
                </p>
                <p className={`text-xs mt-1 mb-4 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  Solicita tu primer servicio y aparecerá aquí
                </p>
                <Link
                  href="/#cotizar"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-spm-red)] text-white text-sm font-semibold rounded-xl hover:bg-[var(--color-spm-red-dark)] transition-all"
                >
                  <Plus size={14} />
                  Solicitar servicio
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {myTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                      isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      ticket.status === "pagado" ? "bg-emerald-500/15" :
                      ticket.status === "cancelado" ? "bg-red-500/15" :
                      "bg-[var(--color-spm-red)]/10"
                    }`}>
                      {ticket.status === "pagado"
                        ? <CheckCircle2 size={16} className="text-emerald-400" />
                        : ticket.status === "cancelado"
                        ? <AlertCircle size={16} className="text-red-400" />
                        : <Clock size={16} className="text-[var(--color-spm-red)]" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[var(--color-spm-red)]">
                          {ticket.ticketId}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[ticket.status]}`}>
                          {STATUS_LABELS[ticket.status]}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {ticket.serviceDescription?.slice(0, 50)}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {ticket.finalCost != null && (
                        <p className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                          ${ticket.finalCost.toLocaleString("es-MX")}
                        </p>
                      )}
                      <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                        {formatDate(ticket.createdAt)}
                      </p>
                    </div>
                    {/* Pay now button for completed + unpaid */}
                    {ticket.status === "completado" && ticket.paymentLinkUrl && (
                      <a
                        href={ticket.paymentLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all"
                      >
                        <CreditCard size={11} /> Pagar
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status Legend */}
        <div className={`mt-6 p-4 rounded-2xl ${isDark ? "bg-slate-900/50 border border-white/5" : "bg-white border border-gray-100"}`}>
          <p className={`text-xs font-semibold mb-3 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Estados de servicio:</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Lead recibido", color: "bg-slate-500/20 text-slate-400" },
              { label: "En diagnóstico", color: "bg-yellow-500/20 text-yellow-400" },
              { label: "En camino", color: "bg-blue-500/20 text-blue-400" },
              { label: "En servicio", color: "bg-orange-500/20 text-orange-400" },
              { label: "Completado", color: "bg-green-500/20 text-green-400" },
              { label: "Pagado", color: "bg-emerald-500/20 text-emerald-400" },
            ].map(({ label, color }) => (
              <span key={label} className={`text-xs px-2.5 py-1 rounded-full font-medium ${color}`}>{label}</span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
