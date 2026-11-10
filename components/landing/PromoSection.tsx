"use client";

import { useTheme } from "@/contexts/ThemeContext";
import {
  Droplets, Settings, Zap, Link2, ShieldCheck, Battery, Cog, Wrench,
  CheckCircle2, ChevronRight, MessageCircle, Star,
} from "lucide-react";

/**
 * Paquete promocional "Pro Rider".
 * Edita estos valores para cambiar precio y vigencia.
 * Si `precio` es null, se muestra "Precio especial — pregúntanos".
 */
const PROMO = {
  nombre: "Pro Rider",
  precio: null as string | null,        // ej. "1,499"
  precioRegular: null as string | null, // ej. "1,990"
  vigencia: null as string | null,      // ej. "Válido hasta el 31 de diciembre"
};

const WHATSAPP_URL =
  "https://wa.me/528133880010?text=" +
  encodeURIComponent(`Hola, me interesa el Paquete ${PROMO.nombre} para mi moto`);

const INCLUYE = [
  { icon: Droplets, title: "Aceite y filtro", desc: "Aceite de la viscosidad que pide tu moto y filtro nuevo." },
  { icon: Settings, title: "Filtro de aire y bujías", desc: "Limpieza o cambio para un motor que respira y arranca bien." },
  { icon: Link2, title: "Cadena y sprockets", desc: "Limpieza, lubricación y ajuste de tensión." },
  { icon: ShieldCheck, title: "Frenos", desc: "Revisión de balatas, discos y nivel de líquido." },
  { icon: Battery, title: "Batería y eléctrico", desc: "Prueba de carga, luces, direccionales y claxon." },
  { icon: Cog, title: "Llantas y suspensión", desc: "Presión, desgaste y revisión de fugas en barras." },
  { icon: Zap, title: "Diagnóstico general", desc: "Revisión de puntos clave y reporte de lo que encontremos." },
  { icon: Droplets, title: "Lavado", desc: "Tu moto queda limpia y lista para rodar." },
];

export default function PromoSection() {
  const { isDark } = useTheme();
  const muted = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <section id="promo" className="py-24 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`rounded-3xl overflow-hidden border ${
            isDark ? "bg-slate-900/60 border-white/5" : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          {/* Top: title + price */}
          <div className="grid lg:grid-cols-5 gap-10 p-8 lg:p-12">
            <div className="lg:col-span-3 flex flex-col gap-5">
              <span
                className={`self-start inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest ${
                  isDark
                    ? "bg-green-950/50 text-green-400 border border-green-900/50"
                    : "bg-green-50 text-green-700 border border-green-200"
                }`}
              >
                Promoción de temporada
              </span>
              <h2 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl leading-tight">
                Paquete <span className="gradient-text">{PROMO.nombre}</span>
              </h2>
              <p className={`text-lg max-w-xl ${muted}`}>
                Servicio completo para que tu moto ruede como nueva, más un bonus de
                modificación. Todo en una sola visita, en tu puerta.
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-[var(--color-spm-red)] text-white font-semibold rounded-xl hover:bg-[var(--color-spm-red-dark)] transition-all hover:scale-105"
                >
                  <MessageCircle size={18} />
                  Apartar por WhatsApp
                </a>
                <a
                  href="#cotizar"
                  className={`inline-flex items-center gap-1 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  Cotizar en línea <ChevronRight size={18} />
                </a>
              </div>
            </div>

            <div
              className={`lg:col-span-2 rounded-2xl p-6 lg:p-8 flex flex-col gap-4 ${
                isDark ? "bg-slate-950/60 border border-white/5" : "bg-slate-50 border border-slate-200"
              }`}
            >
              <span className={`text-xs font-semibold uppercase tracking-widest ${muted}`}>
                Precio de promoción
              </span>
              {PROMO.precio ? (
                <div>
                  <p className="font-display font-bold text-5xl">${PROMO.precio} <span className={`text-base font-medium ${muted}`}>MXN</span></p>
                  {PROMO.precioRegular && (
                    <p className={`text-sm mt-1 ${muted}`}>
                      Precio regular <span className="line-through">${PROMO.precioRegular}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-display font-bold text-3xl">Precio especial — pregúntanos</p>
              )}
              <ul className={`flex flex-col gap-2.5 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {["8 servicios incluidos", "Mano de obra de 1 modificación sin costo", "Lugares limitados por semana"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-[var(--color-spm-orange)] shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
              {PROMO.vigencia && <p className={`text-xs ${muted}`}>{PROMO.vigencia}</p>}
            </div>
          </div>

          {/* Includes grid */}
          <div className={`px-8 lg:px-12 pb-10`}>
            <h3 className="font-display font-bold text-2xl mb-6">Qué incluye</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {INCLUYE.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className={`p-5 rounded-2xl border ${
                    isDark ? "bg-slate-900/60 border-white/5" : "bg-white border-gray-100 shadow-sm"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-spm-red)]/10 flex items-center justify-center mb-3">
                    <Icon size={18} className="text-[var(--color-spm-red)]" />
                  </div>
                  <p className={`font-semibold text-sm mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>{title}</p>
                  <p className={`text-xs leading-relaxed ${muted}`}>{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bonus band */}
          <div className="bg-gradient-to-r from-[var(--color-spm-red)] to-[var(--color-spm-red-dark)] text-white px-8 lg:px-12 py-10 flex flex-col md:flex-row md:items-center gap-6 justify-between">
            <div className="flex flex-col gap-2 max-w-3xl">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/80 flex items-center gap-2">
                <Star size={14} fill="white" /> Bonus de modificación
              </span>
              <p className="font-display font-bold text-2xl lg:text-3xl">
                Instalación de 1 accesorio sin costo de mano de obra
              </p>
              <p className="text-white/85 text-sm lg:text-base">
                Elige uno: kit de luces LED, sliders, porta placa corto, espejos o manubrio.
                Tú traes la pieza o te la cotizamos.
              </p>
            </div>
            <Wrench size={72} className="text-white/30 shrink-0 hidden md:block" aria-hidden="true" />
          </div>

          {/* Conditions */}
          <div className={`px-8 lg:px-12 py-6 text-xs leading-relaxed ${muted}`}>
            Refacciones adicionales detectadas en la revisión se cotizan antes de instalarse. El
            accesorio del bonus no está incluido, solo la mano de obra. Motos de alta cilindrada
            pueden tener ajuste de precio. Sujeto a disponibilidad de agenda.
          </div>
        </div>
      </div>
    </section>
  );
}
