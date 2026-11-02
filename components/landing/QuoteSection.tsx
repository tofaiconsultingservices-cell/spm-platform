"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { CheckCircle, Loader2, MessageCircle } from "lucide-react";
import type { QuoteRequest } from "@/types";

const SERVICE_OPTIONS = [
  "afinacion-menor",
  "afinacion-mayor",
  "frenos",
  "sistema-electrico",
  "suspension",
  "cadena-y-sprockets",
  "neumaticos",
  "bateria",
  "motor",
  "diagnostico",
  "lavado",
  "otro",
];

const SERVICE_LABELS_ES: Record<string, string> = {
  "afinacion-menor": "Afinación Menor",
  "afinacion-mayor": "Afinación Mayor",
  frenos: "Sistema de Frenos",
  "sistema-electrico": "Sistema Eléctrico",
  suspension: "Suspensión",
  "cadena-y-sprockets": "Cadena y Sprockets",
  neumaticos: "Neumáticos",
  bateria: "Batería",
  motor: "Motor",
  diagnostico: "Diagnóstico General",
  lavado: "Lavado de Motocicleta",
  otro: "Otro",
};

const MOTO_BRANDS = ["Yamaha", "Honda", "Kawasaki", "Suzuki", "KTM", "BMW", "Harley-Davidson", "Royal Enfield", "Benelli", "Otra"];

export default function QuoteSection() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<QuoteRequest>();

  async function onSubmit(data: QuoteRequest) {
    setServerError("");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source: "landing-page" }),
      });
      if (!res.ok) throw new Error("server_error");
      setSubmitted(true);
      reset();
    } catch {
      setServerError(t("quote_error"));
    }
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm transition-all outline-none focus:ring-2 focus:ring-[var(--color-spm-red)]/40 focus:border-[var(--color-spm-red)] ${
    isDark
      ? "bg-slate-900 border-white/10 text-white placeholder:text-slate-600"
      : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400 shadow-sm"
  }`;

  const labelClass = `block text-xs font-semibold uppercase tracking-wide mb-1.5 ${
    isDark ? "text-slate-400" : "text-slate-500"
  }`;

  const errorClass = "text-red-400 text-xs mt-1";

  return (
    <section
      id="cotizar"
      className={`py-24 lg:py-32 ${isDark ? "bg-slate-900/50" : "bg-white"}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left — Info */}
          <div className="lg:sticky lg:top-28">
            <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-6 ${
              isDark
                ? "bg-green-950/50 text-green-400 border border-green-900/50"
                : "bg-green-50 text-green-600 border border-green-200"
            }`}>
              {t("quote_badge")}
            </span>
            <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl mb-6">
              {t("quote_title")}{" "}
              <span className="gradient-text">{t("quote_title_accent")}</span>
            </h2>
            <p className={`text-base lg:text-lg leading-relaxed mb-8 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {t("quote_subtitle")}
            </p>

            {/* Trust indicators */}
            <div className="space-y-4">
              {[
                { icon: "✅", text: "Respuesta en menos de 30 minutos" },
                { icon: "🔧", text: "Mecánicos certificados y verificados" },
                { icon: "💯", text: "Garantía de satisfacción en todos los servicios" },
                { icon: "💳", text: "Pago en efectivo, tarjeta o transferencia" },
              ].map(({ icon, text }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">{icon}</span>
                  <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>{text}</span>
                </div>
              ))}
            </div>

            {/* WhatsApp quick contact */}
            <div className={`mt-8 p-4 rounded-2xl ${isDark ? "bg-slate-900 border border-white/10" : "bg-green-50 border border-green-200"}`}>
              <p className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                ¿Prefieres contactarnos directo?
              </p>
              <a
                href="https://wa.me/528133880010?text=Hola,%20necesito%20un%20mec%C3%A1nico%20para%20mi%20moto"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-xl transition-all"
              >
                <MessageCircle size={16} />
                WhatsApp directo
              </a>
            </div>
          </div>

          {/* Right — Form */}
          <div className={`rounded-3xl p-6 lg:p-8 border ${
            isDark
              ? "bg-slate-900/80 border-white/10"
              : "bg-white border-gray-200 shadow-xl"
          }`}>
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <h3 className={`font-display font-bold text-xl mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                  ¡Cotización enviada!
                </h3>
                <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  {t("quote_success")}
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 border border-[var(--color-spm-red)] text-[var(--color-spm-red)] text-sm font-semibold rounded-xl hover:bg-[var(--color-spm-red)] hover:text-white transition-all"
                >
                  Nueva cotización
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{t("quote_name")}</label>
                    <input
                      {...register("name", { required: "Nombre requerido" })}
                      placeholder="Juan Pérez"
                      className={inputClass}
                    />
                    {errors.name && <p className={errorClass}>{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>{t("quote_phone")}</label>
                    <input
                      {...register("phone", { required: "Teléfono requerido" })}
                      placeholder="+52 81 0000 0000"
                      type="tel"
                      className={inputClass}
                    />
                    {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{t("quote_email")}</label>
                  <input
                    {...register("email")}
                    placeholder="juan@email.com"
                    type="email"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{t("quote_address")}</label>
                  <input
                    {...register("address", { required: "Dirección requerida" })}
                    placeholder="Colonia, calle o referencia"
                    className={inputClass}
                  />
                  {errors.address && <p className={errorClass}>{errors.address.message}</p>}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{t("quote_moto_brand")}</label>
                    <select {...register("motoBrand")} className={inputClass}>
                      <option value="">Seleccionar</option>
                      {MOTO_BRANDS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t("quote_moto_year")}</label>
                    <input
                      {...register("motoYear")}
                      placeholder={String(new Date().getFullYear())}
                      type="number"
                      min="1990"
                      max={String(new Date().getFullYear() + 1)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{t("quote_service")}</label>
                  <select
                    {...register("serviceType", { required: "Selecciona un servicio" })}
                    className={inputClass}
                  >
                    <option value="">Seleccionar servicio</option>
                    {SERVICE_OPTIONS.map((s) => (
                      <option key={s} value={s}>{SERVICE_LABELS_ES[s]}</option>
                    ))}
                  </select>
                  {errors.serviceType && <p className={errorClass}>{errors.serviceType.message}</p>}
                </div>

                <div>
                  <label className={labelClass}>{t("quote_desc")}</label>
                  <textarea
                    {...register("description", { required: "Describe el problema" })}
                    placeholder="Mi moto no enciende, hace ruido extraño en la caja..."
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                  {errors.description && <p className={errorClass}>{errors.description.message}</p>}
                </div>

                {serverError && (
                  <p className="text-red-400 text-sm text-center">{serverError}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white font-bold text-base rounded-2xl transition-all hover:scale-[1.02] disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    t("quote_submit")
                  )}
                </button>

                <p className={`text-xs text-center ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  Al enviar aceptas nuestros{" "}
                  <a href="/terminos" className="text-[var(--color-spm-red)] hover:underline">
                    Términos de servicio
                  </a>{" "}
                  y{" "}
                  <a href="/privacidad" className="text-[var(--color-spm-red)] hover:underline">
                    Política de privacidad
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
