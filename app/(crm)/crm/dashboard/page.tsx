"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { subscribeTickets } from "@/lib/firestore/tickets";
import { subscribeMechanics } from "@/lib/firestore/mechanics";
import type { ServiceTicket, Mechanic, ServiceTicketStatus } from "@/types";
import { STATUS_LABELS, STATUS_COLORS, SERVICE_LABELS } from "@/types";
import {
  LayoutDashboard, Ticket, Users, Wrench, FileText, CreditCard,
  Phone, BarChart3, Settings, LogOut, Menu, X,
  Sun, Moon, Globe, Loader2, TrendingUp, DollarSign,
  CheckCircle2, Clock, AlertCircle, Zap, Plus,
  ChevronRight, RefreshCw,
  BadgeCheck,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/crm/dashboard",      label: "Dashboard",       icon: LayoutDashboard },
  { href: "/crm/tickets",        label: "Tickets",         icon: Ticket },
  { href: "/crm/clientes",       label: "Clientes",        icon: Users },
  { href: "/crm/mecanicos",      label: "Mecánicos",       icon: Wrench },
  { href: "/crm/pagos",          label: "Pagos",           icon: CreditCard },
  { href: "/crm/membresias",     label: "Membresías",      icon: BadgeCheck },
  { href: "/crm/facturas",       label: "Facturas",        icon: FileText },
  { href: "/crm/contact-center", label: "Contact Center",  icon: Phone },
  { href: "/crm/reportes",       label: "Reportes",        icon: BarChart3 },
  { href: "/crm/configuracion",  label: "Configuración",   icon: Settings },
];

const ACTIVE_STATUSES: ServiceTicketStatus[] = [
  "lead-recibido", "diagnostico-pendiente", "en-camino", "en-servicio",
];

function formatRelative(ts: unknown): string {
  if (!ts) return "";
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as unknown as string);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)   return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function isSameDay(ts: unknown): boolean {
  if (!ts) return false;
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as unknown as string);
  const now = new Date();
  return d.getDate() === now.getDate() &&
         d.getMonth() === now.getMonth() &&
         d.getFullYear() === now.getFullYear();
}

function isSameMonth(ts: unknown): boolean {
  if (!ts) return false;
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as unknown as string);
  const now = new Date();
  return d.getMonth() === now.getMonth() &&
         d.getFullYear() === now.getFullYear();
}

function StatusDot({ status }: { status: ServiceTicketStatus }) {
  const colors: Record<string, string> = {
    "lead-recibido": "bg-slate-400",
    "diagnostico-pendiente": "bg-yellow-400 animate-pulse",
    "en-camino": "bg-blue-400 animate-pulse",
    "en-servicio": "bg-orange-400 animate-pulse",
    "completado": "bg-green-400",
    "pagado": "bg-emerald-400",
    "cancelado": "bg-red-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-slate-400"}`} />;
}

export default function DashboardPage() {
  const { user, signOut, hasRole, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, lang, toggleLang } = useLanguage();
  const router   = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tickets,   setTickets]   = useState<ServiceTicket[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    if (!loading && !user)                   router.replace("/login");
    if (!loading && user && !hasRole("operador")) router.replace("/portal");
  }, [user, loading, hasRole, router]);

  useEffect(() => {
    if (!user || !hasRole("operador")) return;
    const unsubT = subscribeTickets(t => { setTickets(t); setDataReady(true); });
    const unsubM = subscribeMechanics(setMechanics);
    return () => { unsubT(); unsubM(); };
  }, [user, hasRole]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active       = tickets.filter(t => ACTIVE_STATUSES.includes(t.status)).length;
    const completedToday = tickets.filter(t =>
      t.status === "completado" || t.status === "pagado" ? isSameDay(t.completedAt ?? t.updatedAt) : false
    ).length;
    const revenueMonth = tickets
      .filter(t => t.status === "pagado" && isSameMonth(t.paidAt ?? t.updatedAt))
      .reduce((s, t) => s + (t.finalCost ?? 0), 0);
    const rated = tickets.filter(t => t.rating != null);
    const avgRating = rated.length
      ? (rated.reduce((s, t) => s + (t.rating ?? 0), 0) / rated.length).toFixed(1)
      : null;
    const availableMechanics = mechanics.filter(m => m.status === "disponible").length;
    const pendingPayment = tickets.filter(t => t.status === "completado" && !t.paymentLinkUrl).length;
    return { active, completedToday, revenueMonth, avgRating, availableMechanics, pendingPayment };
  }, [tickets, mechanics]);

  // ── Recent activity: últimos 8 tickets modificados ─────────────────────────
  const recentActivity = useMemo(() =>
    [...tickets]
      .sort((a, b) => {
        const ta = (a.updatedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        const tb = (b.updatedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      })
      .slice(0, 8),
    [tickets]
  );

  // ── Tickets activos por estado ─────────────────────────────────────────────
  const activeByStatus = useMemo(() => {
    const active = tickets.filter(t => ACTIVE_STATUSES.includes(t.status));
    const map: Record<string, ServiceTicket[]> = {};
    active.forEach(t => { (map[t.status] ??= []).push(t); });
    return map;
  }, [tickets]);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--color-spm-red)]" />
      </div>
    );
  }
  if (!user || !hasRole("operador")) return null;

  const card = `rounded-2xl border ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`;

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col border-r transition-transform duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-200"}`}>

        {/* Logo */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
          <div className="relative w-8 h-8">
            <Image src="/images/logo.png" alt="SPM" fill className="object-contain" />
          </div>
          <div>
            <p className={`font-display font-bold text-sm leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>SPM Platform</p>
            <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>CRM & Operations</p>
          </div>
        </div>

        {/* User info */}
        <div className={`px-4 py-3 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
          <div className="flex items-center gap-2.5">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-spm-red)] to-[var(--color-spm-orange)] flex items-center justify-center text-white text-xs font-bold">
                {user.displayName?.[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-xs font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>{user.displayName}</p>
              <p className={`text-xs capitalize ${isDark ? "text-slate-500" : "text-slate-400"}`}>{user.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/crm/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[var(--color-spm-red)] text-white"
                    : isDark ? "text-slate-400 hover:bg-white/5 hover:text-white"
                    : "text-slate-600 hover:bg-gray-100 hover:text-slate-900"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className={`p-3 border-t ${isDark ? "border-white/5" : "border-gray-100"} space-y-1`}>
          <button onClick={toggleLang}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-gray-100"
            }`}>
            <Globe size={14} />{lang === "es" ? "Español" : "English"}
          </button>
          <button onClick={toggleTheme}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-gray-100"
            }`}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? "Modo claro" : "Modo oscuro"}
          </button>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-950/30 transition-all">
            <LogOut size={14} />Cerrar sesión
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top Bar */}
        <header className={`flex items-center justify-between px-4 lg:px-8 py-3 border-b ${
          isDark ? "bg-slate-900/80 border-white/5" : "bg-white border-gray-200"
        } backdrop-blur-sm`}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`lg:hidden p-2 rounded-lg ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h1 className={`font-display font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
                Dashboard
              </h1>
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!dataReady && <Loader2 size={14} className="animate-spin text-slate-400" />}
            <Link href="/crm/tickets"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-spm-red)] text-white text-xs font-bold hover:bg-[var(--color-spm-red-dark)] transition-all">
              <Plus size={12} /> Nuevo ticket
            </Link>
            <Link href="/" target="_blank"
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                isDark ? "border-white/10 text-slate-400 hover:text-white" : "border-gray-200 text-slate-500"
              }`}>
              Ver sitio
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">

          {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Tickets activos",
                value: dataReady ? String(kpis.active) : "—",
                sub: `${mechanics.filter(m=>m.status==="en-servicio").length} en servicio`,
                icon: <Ticket size={18} className="text-blue-400" />,
                bg: "bg-blue-500/10",
                href: "/crm/tickets",
              },
              {
                label: "Completados hoy",
                value: dataReady ? String(kpis.completedToday) : "—",
                sub: tickets.filter(t=>t.status==="pagado"&&isSameDay(t.paidAt??t.updatedAt)).length + " pagados",
                icon: <CheckCircle2 size={18} className="text-green-400" />,
                bg: "bg-green-500/10",
                href: "/crm/facturas",
              },
              {
                label: "Ingresos del mes",
                value: dataReady ? `$${kpis.revenueMonth.toLocaleString("es-MX")}` : "—",
                sub: "MXN · servicios pagados",
                icon: <DollarSign size={18} className="text-yellow-400" />,
                bg: "bg-yellow-500/10",
                href: "/crm/facturas",
              },
              {
                label: "Mecánicos disponibles",
                value: dataReady ? String(kpis.availableMechanics) : "—",
                sub: `de ${mechanics.filter(m=>m.status!=="inactivo").length} activos`,
                icon: <Wrench size={18} className="text-orange-400" />,
                bg: "bg-orange-500/10",
                href: "/crm/mecanicos",
              },
            ].map(({ label, value, sub, icon, bg, href }) => (
              <Link key={label} href={href}
                className={`${card} p-5 hover:scale-[1.02] transition-all block`}>
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  {icon}
                </div>
                <p className={`font-display font-bold text-2xl mb-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                  {value}
                </p>
                <p className={`text-xs font-medium mb-0.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>{label}</p>
                <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{sub}</p>
              </Link>
            ))}
          </div>

          {/* ── Active tickets pipeline + Recent activity ────────────────────── */}
          <div className="grid lg:grid-cols-5 gap-6">

            {/* Pipeline de tickets activos */}
            <div className={`${card} p-5 lg:col-span-3`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                  Tickets en curso
                  {dataReady && <span className={`ml-2 text-xs font-normal ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    ({kpis.active} activos)
                  </span>}
                </h2>
                <Link href="/crm/tickets?filter=activos"
                  className="text-xs text-[var(--color-spm-red)] hover:underline">
                  Ver todos →
                </Link>
              </div>

              {!dataReady ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              ) : kpis.active === 0 ? (
                <div className={`text-center py-8 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  <CheckCircle2 size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">Sin tickets activos</p>
                  <p className="text-xs mt-1">Todo al día 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(activeByStatus).map(([status, tks]) => (
                    <div key={status}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        {STATUS_LABELS[status as ServiceTicketStatus]} ({tks.length})
                      </p>
                      {tks.slice(0, 3).map(t => (
                        <Link key={t.id} href="/crm/tickets"
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-colors hover:scale-[1.01] ${
                            isDark ? "bg-slate-800/60 hover:bg-slate-800" : "bg-slate-50 hover:bg-slate-100"
                          }`}>
                          <StatusDot status={t.status} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                              {t.ticketId}
                            </p>
                            <p className={`text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {t.clientName} · {SERVICE_LABELS[t.serviceType as keyof typeof SERVICE_LABELS] ?? t.serviceType}
                            </p>
                          </div>
                          {t.mechanicName && (
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600"}`}>
                              {t.mechanicName.split(" ")[0]}
                            </span>
                          )}
                          <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />
                        </Link>
                      ))}
                      {tks.length > 3 && (
                        <p className={`text-xs text-center ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                          +{tks.length - 3} más…
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pending payment alert */}
              {dataReady && kpis.pendingPayment > 0 && (
                <Link href="/crm/tickets?filter=completado"
                  className={`mt-3 flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold hover:bg-amber-500/15 transition-colors`}>
                  <AlertCircle size={14} />
                  {kpis.pendingPayment} ticket{kpis.pendingPayment>1?"s":""} completado{kpis.pendingPayment>1?"s":""} sin link de pago →
                </Link>
              )}
            </div>

            {/* Actividad reciente */}
            <div className={`${card} p-5 lg:col-span-2`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                  Actividad reciente
                </h2>
                {dataReady && (
                  <span className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                    {tickets.length} total
                  </span>
                )}
              </div>

              {!dataReady ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              ) : recentActivity.length === 0 ? (
                <div className={`text-center py-8 text-sm ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  Sin actividad registrada
                </div>
              ) : (
                <div className="space-y-0">
                  {recentActivity.map((t, i) => (
                    <Link key={t.id} href="/crm/tickets"
                      className={`flex items-start gap-3 py-2.5 border-b last:border-0 transition-colors hover:opacity-80 ${
                        isDark ? "border-white/5" : "border-gray-50"
                      }`}>
                      <div className="mt-0.5 flex-shrink-0">
                        <StatusDot status={t.status} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-[var(--color-spm-red)]">{t.ticketId}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[t.status]}`}>
                            {STATUS_LABELS[t.status]}
                          </span>
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {t.clientName} · {SERVICE_LABELS[t.serviceType as keyof typeof SERVICE_LABELS] ?? t.serviceType}
                        </p>
                      </div>
                      <span className={`text-xs flex-shrink-0 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                        {formatRelative(t.updatedAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Mechanics status row ─────────────────────────────────────────── */}
          {dataReady && mechanics.filter(m=>m.status!=="inactivo").length > 0 && (
            <div className={`${card} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
                  Estado del equipo
                </h2>
                <Link href="/crm/mecanicos" className="text-xs text-[var(--color-spm-red)] hover:underline">
                  Gestionar →
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {mechanics.filter(m=>m.status!=="inactivo").map(m => {
                  const statusMap: Record<string, {dot:string;label:string;bg:string}> = {
                    disponible:    { dot: "bg-green-400",               label: "Disponible",   bg: isDark ? "bg-green-950/30 border-green-900/40"   : "bg-green-50 border-green-200"   },
                    "en-servicio": { dot: "bg-orange-400 animate-pulse",label: "En servicio",  bg: isDark ? "bg-orange-950/30 border-orange-900/40" : "bg-orange-50 border-orange-200" },
                    descanso:      { dot: "bg-slate-400",               label: "Descanso",     bg: isDark ? "bg-slate-800 border-white/5"           : "bg-slate-50 border-slate-200"   },
                  };
                  const statusCfg = statusMap[m.status] ?? { dot: "bg-slate-500", label: m.status, bg: isDark ? "bg-slate-800 border-white/5" : "bg-slate-50 border-slate-200" };
                  return (
                    <div key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${statusCfg.bg}`}>
                      <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                      <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                        {m.name.split(" ")[0]}
                      </span>
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                        {statusCfg.label}
                      </span>
                      {m.averageRating && (
                        <span className="text-amber-400">★{m.averageRating.toFixed(1)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Quick actions ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: "Nuevo ticket",     icon: <Ticket size={16}/>,   href: "/crm/tickets",        color: "from-[var(--color-spm-red)] to-rose-600" },
              { title: "Ver clientes",     icon: <Users size={16}/>,    href: "/crm/clientes",       color: "from-blue-600 to-blue-700" },
              { title: "Reportes",         icon: <BarChart3 size={16}/>,href: "/crm/reportes",       color: "from-purple-600 to-purple-700" },
              { title: "Contact Center",   icon: <Phone size={16}/>,    href: "/crm/contact-center", color: "from-green-600 to-green-700" },
            ].map(({ title, icon, href, color }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${color} text-white hover:scale-[1.02] transition-all shadow-md`}>
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">{icon}</div>
                <span className="font-semibold text-sm">{title}</span>
              </Link>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}
