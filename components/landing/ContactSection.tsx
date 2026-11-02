"use client";

import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { MessageCircle, Phone, Mail, MapPin, Clock } from "lucide-react";

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

export default function ContactSection() {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const contacts = [
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: "+52 81 3388-0010",
      desc: t("contact_whatsapp_desc"),
      href: "https://wa.me/528133880010?text=Hola,%20necesito%20información%20sobre%20servicios%20para%20mi%20moto",
      color: "bg-green-500",
      bg: isDark ? "bg-green-950/30 border-green-900/40" : "bg-green-50 border-green-200",
    },
    {
      icon: Phone,
      label: t("contact_call"),
      value: "+52 81 3388-0010",
      desc: t("contact_call_desc"),
      href: "tel:+528133880010",
      color: "bg-blue-500",
      bg: isDark ? "bg-blue-950/30 border-blue-900/40" : "bg-blue-50 border-blue-200",
    },
    {
      icon: Mail,
      label: "Email",
      value: "admin@sanpedromotocare.com",
      desc: t("contact_email_desc"),
      href: "mailto:admin@sanpedromotocare.com",
      color: "bg-[var(--color-spm-red)]",
      bg: isDark ? "bg-red-950/30 border-red-900/40" : "bg-red-50 border-red-200",
    },
  ];

  return (
    <section
      id="contacto"
      className={`py-24 lg:py-32 ${isDark ? "bg-slate-950" : "bg-slate-50"}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6 ${
              isDark
                ? "bg-orange-950/50 text-orange-400 border border-orange-900/50"
                : "bg-orange-50 text-orange-600 border border-orange-200"
            }`}>
              {t("contact_badge")}
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl mb-6">
              {t("contact_title")}{" "}
              <span className="gradient-text">{t("contact_title_accent")}</span>
            </h2>
            <p className={`text-lg mb-8 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              Nuestro equipo está disponible para atenderte de inmediato. Elige el canal que prefieras.
            </p>

            {/* Contact Cards */}
            <div className="space-y-4">
              {contacts.map(({ icon: Icon, label, value, desc, href, color, bg }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02] group ${bg}`}
                >
                  <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>{label}</p>
                    <p className={`text-sm font-medium truncate ${isDark ? "text-slate-300" : "text-slate-700"}`}>{value}</p>
                    <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{desc}</p>
                  </div>
                  <div className={`text-xl ${isDark ? "text-slate-600" : "text-gray-300"} group-hover:text-[var(--color-spm-red)] transition-colors`}>→</div>
                </a>
              ))}
            </div>

            {/* Social + Hours */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-2xl ${isDark ? "bg-slate-900 border border-white/5" : "bg-white border border-gray-200 shadow-sm"}`}>
                <Clock size={16} className="text-[var(--color-spm-orange)] mb-2" />
                <p className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>Horario</p>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Lun–Dom 7am–9pm<br />Urgencias 24/7</p>
              </div>
              <div className={`p-4 rounded-2xl ${isDark ? "bg-slate-900 border border-white/5" : "bg-white border border-gray-200 shadow-sm"}`}>
                <MapPin size={16} className="text-[var(--color-spm-orange)] mb-2" />
                <p className={`font-semibold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>Cobertura</p>
                <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>San Pedro, MTY<br />y área metropolitana</p>
              </div>
            </div>

            {/* Social links */}
            <div className="mt-6 flex items-center gap-3">
              <span className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>Síguenos:</span>
              {[
                { icon: InstagramIcon, href: "https://instagram.com/sanpedromotocare", label: "Instagram" },
                { icon: FacebookIcon, href: "https://facebook.com/sanpedromotocare", label: "Facebook" },
              ].map(({ icon: SocialIcon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-110 ${
                    isDark
                      ? "bg-slate-800 text-slate-400 hover:bg-[var(--color-spm-red)] hover:text-white"
                      : "bg-gray-100 text-slate-600 hover:bg-[var(--color-spm-red)] hover:text-white"
                  }`}
                >
                  <SocialIcon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Right — SPM Hero Image */}
          <div className="hidden lg:block">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src="/images/spm-hero.png"
                alt="SanPedroMotoCare equipo"
                width={600}
                height={700}
                className="w-full h-[560px] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-spm-dark)]/70 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8">
                <div className={`p-5 rounded-2xl backdrop-blur-sm ${isDark ? "bg-slate-900/80 border border-white/10" : "bg-white/90"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    ¿Dónde está tu mecánico?
                  </p>
                  <p className={`font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>
                    En camino hacia ti 🏍️
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full flex-1">
                      <div className="h-full w-3/4 bg-gradient-to-r from-[var(--color-spm-red)] to-[var(--color-spm-orange)] rounded-full" />
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-spm-red)]">75%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
