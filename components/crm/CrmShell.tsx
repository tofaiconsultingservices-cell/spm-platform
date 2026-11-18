"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard, Ticket, Users, Wrench, FileText, CreditCard,
  Phone, BarChart3, Settings, LogOut, Menu, X,
  Sun, Moon, Globe, Loader2, Bot, Package, ClipboardList,
} from "lucide-react";
import CrmAiPanel from "@/components/crm/CrmAiPanel";

const NAV_ITEMS = [
  { href: "/crm/dashboard",      label: "Dashboard",       icon: LayoutDashboard },
  { href: "/crm/tickets",        label: "Tickets",         icon: Ticket },
  { href: "/crm/clientes",       label: "Clientes",        icon: Users },
  { href: "/crm/mecanicos",      label: "Mecánicos",       icon: Wrench },
  { href: "/crm/inventario",     label: "Inventario",      icon: Package },
  { href: "/crm/servicios",      label: "Servicios",       icon: ClipboardList },
  { href: "/crm/pagos",          label: "Pagos",           icon: CreditCard },
  { href: "/crm/facturas",       label: "Facturas",        icon: FileText },
  { href: "/crm/contact-center", label: "Contact Center",  icon: Phone },
  { href: "/crm/reportes",       label: "Reportes",        icon: BarChart3 },
  { href: "/crm/configuracion",  label: "Configuración",   icon: Settings },
];

interface CrmShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function CrmShell({ title, subtitle, children }: CrmShellProps) {
  const { user, signOut, hasRole, loading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { lang, toggleLang } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && !hasRole("operador")) router.replace("/portal");
  }, [user, loading, hasRole, router]);

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

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 flex flex-col border-r transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-200"}`}
      >
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-spm-red)] to-[var(--color-spm-orange)] flex items-center justify-center text-white text-xs font-bold">
              {user.displayName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>{user.displayName}</p>
              <p className={`text-xs capitalize ${isDark ? "text-slate-500" : "text-slate-400"}`}>{user.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[var(--color-spm-red)] text-white"
                    : isDark
                    ? "text-slate-400 hover:bg-white/5 hover:text-white"
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
          <button
            onClick={toggleLang}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-gray-100"
            }`}
          >
            <Globe size={14} />
            {lang === "es" ? "Español" : "English"}
          </button>
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isDark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-gray-100"
            }`}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
            {isDark ? "Modo claro" : "Modo oscuro"}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-950/30 transition-all"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className={`flex items-center gap-4 px-4 lg:px-8 py-3 border-b ${
          isDark ? "bg-slate-900/80 border-white/5" : "bg-white border-gray-200"
        } backdrop-blur-sm`}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`lg:hidden p-2 rounded-lg ${isDark ? "text-slate-400" : "text-slate-600"}`}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="flex-1 min-w-0">
            <h1 className={`font-display font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>{title}</h1>
            {subtitle && (
              <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{subtitle}</p>
            )}
          </div>

          {/* AI Assistant button */}
          <button
            onClick={() => setAiPanelOpen((v) => !v)}
            title="Asistente IA SPM"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              aiPanelOpen
                ? "bg-[var(--color-spm-red)] text-white"
                : isDark
                ? "bg-slate-800 text-slate-300 hover:bg-slate-700"
                : "bg-gray-100 text-slate-600 hover:bg-gray-200"
            }`}
          >
            <Bot size={14} />
            <span className="hidden sm:inline">Asistente IA</span>
          </button>
        </header>

        {/* CRM AI Panel */}
        {aiPanelOpen && <CrmAiPanel onClose={() => setAiPanelOpen(false)} />}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
