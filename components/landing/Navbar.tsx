"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sun, Moon, Globe, Menu, X, Bike } from "lucide-react";

export default function Navbar() {
  const { theme, toggleTheme, isDark } = useTheme();
  const { lang, t, toggleLang } = useLanguage();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "#servicios", label: t("nav_services") },
    { href: "#tracking", label: t("nav_tracking") },
    { href: "/tienda", label: "Tienda" },
    { href: "/membresias", label: "Membresías" },
    { href: "#cotizar", label: t("nav_quote") },
    { href: "#contacto", label: t("nav_contact") },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? isDark
            ? "bg-slate-950/95 shadow-lg shadow-black/20 backdrop-blur-md border-b border-white/5"
            : "bg-white/95 shadow-lg backdrop-blur-md border-b border-gray-200/50"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[72px] lg:h-[86px]">
          {/* Logo — nuevo branding oficial */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-[48px] h-[48px] lg:w-[64px] lg:h-[64px] flex-shrink-0">
              <Image
                src="/images/logo.png"
                alt="SanPedroMotoCare"
                fill
                sizes="64px"
                className="object-contain drop-shadow-lg"
                priority
              />
            </div>
            {/* Texto solo visible en pantallas medianas+ */}
            <div className="hidden md:block">
              <span
                className={`font-display font-bold text-lg lg:text-xl leading-tight ${
                  scrolled || menuOpen
                    ? isDark ? "text-white" : "text-slate-900"
                    : "text-white"
                }`}
              >
                SanPedro
              </span>
              <span className="font-display font-bold text-lg lg:text-xl text-[var(--color-spm-red)] leading-tight">
                MotoCare
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`font-medium text-sm transition-colors hover:text-[var(--color-spm-red)] ${
                  scrolled
                    ? isDark
                      ? "text-slate-300"
                      : "text-slate-700"
                    : "text-white/90"
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Language Toggle */}
            <button
              onClick={toggleLang}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                scrolled || menuOpen
                  ? isDark
                    ? "border-white/10 text-slate-300 hover:border-[var(--color-spm-red)] hover:text-[var(--color-spm-red)]"
                    : "border-gray-200 text-slate-600 hover:border-[var(--color-spm-red)] hover:text-[var(--color-spm-red)]"
                  : "border-white/20 text-white/80 hover:border-white hover:text-white"
              }`}
              aria-label="Toggle language"
            >
              <Globe size={12} />
              {lang.toUpperCase()}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full transition-all border ${
                scrolled || menuOpen
                  ? isDark
                    ? "border-white/10 text-slate-300 hover:border-[var(--color-spm-red)] hover:text-[var(--color-spm-red)]"
                    : "border-gray-200 text-slate-600 hover:border-[var(--color-spm-red)] hover:text-[var(--color-spm-red)]"
                  : "border-white/20 text-white/80 hover:border-white hover:text-white"
              }`}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* CTA / Portal Button */}
            {user ? (
              <>
                {/* Admin/Operador/Manager: show both Portal and CRM */}
                {user.role !== "viewer" && user.role !== "mecanico" && (
                  <Link
                    href="/portal"
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                      scrolled || menuOpen
                        ? isDark
                          ? "border-white/15 text-slate-300 hover:border-[var(--color-spm-red)] hover:text-[var(--color-spm-red)]"
                          : "border-gray-200 text-slate-600 hover:border-[var(--color-spm-red)] hover:text-[var(--color-spm-red)]"
                        : "border-white/25 text-white/80 hover:border-white hover:text-white"
                    }`}
                  >
                    {t("nav_portal")}
                  </Link>
                )}
                <Link
                  href={user.role === "mecanico" ? "/mecanico" : user.role === "viewer" ? "/portal" : "/crm/dashboard"}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-semibold rounded-full transition-all"
                >
                  <Bike size={14} />
                  {user.role === "mecanico" ? "Mi App" : user.role === "viewer" ? t("nav_portal") : t("nav_crm")}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-semibold rounded-full transition-all"
              >
                {t("nav_login")}
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={`lg:hidden p-2 rounded-full transition-all ${
                scrolled || menuOpen
                  ? isDark
                    ? "text-white hover:bg-white/10"
                    : "text-slate-900 hover:bg-gray-100"
                  : "text-white hover:bg-white/10"
              }`}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div
            className={`lg:hidden pb-4 pt-2 border-t ${
              isDark ? "border-white/10" : "border-gray-200"
            }`}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block py-3 px-2 font-medium text-sm transition-colors hover:text-[var(--color-spm-red)] ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
              {user ? (
                <>
                  {user.role !== "viewer" && user.role !== "mecanico" && (
                    <Link
                      href="/portal"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        isDark ? "border-white/15 text-slate-300" : "border-gray-200 text-slate-700"
                      }`}
                    >
                      {t("nav_portal")}
                    </Link>
                  )}
                  <Link
                    href={user.role === "mecanico" ? "/mecanico" : user.role === "viewer" ? "/portal" : "/crm/dashboard"}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--color-spm-red)] text-white text-sm font-semibold rounded-xl"
                  >
                    {user.role === "mecanico" ? "Mi App" : user.role === "viewer" ? t("nav_portal") : t("nav_crm")}
                  </Link>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--color-spm-red)] text-white text-sm font-semibold rounded-xl"
                >
                  {t("nav_login")}
                </Link>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
