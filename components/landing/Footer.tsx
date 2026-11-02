"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { MessageCircle, Phone, ChevronRight } from "lucide-react";

function InstagramIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  );
}

export default function Footer() {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const serviceLinks = [
    "Afinación Menor",
    "Afinación Mayor",
    "Sistema de Frenos",
    "Sistema Eléctrico",
    "Suspensión",
    "Neumáticos",
    "Batería",
  ];

  const companyLinks = [
    { label: "Inicio", href: "/" },
    { label: "Servicios", href: "#servicios" },
    { label: "Rastrear", href: "#tracking" },
    { label: "Cotizar", href: "#cotizar" },
    { label: "Portal Cliente", href: "/portal" },
    { label: "CRM / Admin", href: "/login" },
  ];

  return (
    <footer className={`pt-16 pb-8 border-t ${isDark ? "bg-slate-950 border-white/5" : "bg-slate-900 border-slate-800"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-14 h-14 flex-shrink-0">
                <Image src="/images/logo.png" alt="SanPedroMotoCare Logo" fill className="object-contain" />
              </div>
              <div className="leading-tight">
                <p className="text-white font-display font-bold text-base">SanPedroMotoCare</p>
                <p className="text-slate-400 text-xs">Mecánico a Domicilio</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-5">
              {t("footer_tagline")} Mecánicos certificados en San Pedro Garza García y área metropolitana de Monterrey.
            </p>
            <div className="flex gap-2">
              {[
                { icon: MessageCircle, href: "https://wa.me/528133880010", bg: "bg-green-600 hover:bg-green-700" },
                { icon: Phone, href: "tel:+528133880010", bg: "bg-blue-600 hover:bg-blue-700" },
                { icon: InstagramIcon, href: "https://instagram.com/sanpedromotocare", bg: "bg-pink-600 hover:bg-pink-700" },
                { icon: FacebookIcon, href: "https://facebook.com/sanpedromotocare", bg: "bg-blue-800 hover:bg-blue-900" },
              ].map(({ icon: Icon, href, bg }, i) => (
                <a
                  key={i}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center text-white transition-all hover:scale-110`}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{t("footer_services")}</h4>
            <ul className="space-y-2">
              {serviceLinks.map((s) => (
                <li key={s}>
                  <a href="#servicios" className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1 group">
                    <ChevronRight size={12} className="text-[var(--color-spm-red)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">{t("footer_company")}</h4>
            <ul className="space-y-2">
              {companyLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1 group">
                    <ChevronRight size={12} className="text-[var(--color-spm-red)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + Hours */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Contacto</h4>
            <div className="space-y-3 text-slate-400 text-sm">
              <p>📞 +52 81 3388-0010</p>
              <p>📱 WhatsApp disponible</p>
              <p>📧 admin@sanpedromotocare.com</p>
              <p className="pt-2">🕐 Lun–Dom 7am–9pm</p>
              <p>🚨 Urgencias 24/7</p>
            </div>
          </div>
        </div>

        {/* Brand logo centrado */}
        <div className="flex justify-center mb-10">
          <Image
            src="/images/logo.png"
            alt="SanPedroMotoCare"
            width={160}
            height={160}
            className="object-contain opacity-50 hover:opacity-90 transition-opacity"
          />
        </div>

        {/* Zone Coverage */}
        <div className="text-center mb-8">
          <p className="text-slate-500 text-xs">{t("footer_zones")}</p>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-xs">
            © {new Date().getFullYear()} SanPedroMotoCare. {t("footer_rights")}
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacidad" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
              {t("footer_privacy")}
            </Link>
            <Link href="/terminos" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">
              {t("footer_terms")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
