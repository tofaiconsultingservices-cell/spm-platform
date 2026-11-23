"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const { signIn, signInWithGoogle, signUp, user, loading, redirectError } = useAuth();
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "registro">("login");
  const [fromPath, setFromPath] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // true while the browser is being redirected to Google
  const [redirecting, setRedirecting] = useState(false);

  // Show any error from the Google redirect (e.g. auth/unauthorized-domain)
  useEffect(() => {
    if (redirectError) {
      if (redirectError === "auth/unauthorized-domain") {
        setError(
          "Dominio no autorizado en Firebase Console. Agrégalo en Authentication → Settings → Authorized domains."
        );
      } else {
        setError(`Error de autenticación: ${redirectError}`);
      }
    }
  }, [redirectError]);

  // ?modo=registro abre directo "Crear cuenta"; ?from=/portal/... regresa ahí al entrar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("modo") === "registro") setMode("registro");
    const from = params.get("from");
    if (from && from.startsWith("/portal")) setFromPath(from);
  }, []);

  // Redirect once auth resolves
  useEffect(() => {
    if (!loading && user) {
      if (user.role === "mecanico") router.replace("/mecanico");
      else if (user.role === "viewer") router.replace(fromPath ?? "/portal");
      else router.replace("/crm/dashboard");
    }
  }, [user, loading, router, fromPath]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(name, email, password, phone);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/email-already-in-use") setError("Ya existe una cuenta con este correo. Inicia sesión.");
      else if (code === "auth/invalid-email") setError("El correo no es válido.");
      else if (code === "auth/weak-password") setError("La contraseña es muy débil. Usa al menos 6 caracteres.");
      else setError("No pudimos crear tu cuenta. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setRedirecting(true);
    try {
      // signInWithRedirect navega el browser a Google — no devuelve usuario aquí.
      // El resultado llega en onAuthStateChanged cuando el browser vuelve a la app.
      await signInWithGoogle();
    } catch (err: unknown) {
      setRedirecting(false);
      const code = (err as { code?: string })?.code ?? "";
      if (code) {
        setError(`Error: ${code}`);
      } else {
        setError("Error al iniciar sesión con Google. Intenta de nuevo.");
      }
    }
    // No finally setRedirecting(false) — el browser ya salió de la página
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm transition-all outline-none focus:ring-2 focus:ring-[var(--color-spm-red)]/40 focus:border-[var(--color-spm-red)] ${
    isDark
      ? "bg-slate-900 border-white/10 text-white placeholder:text-slate-600"
      : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400 shadow-sm"
  }`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[var(--color-spm-red)]" />
      </div>
    );
  }

  // While redirecting to Google, show a full-screen loader
  if (redirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950">
        <Loader2 size={36} className="animate-spin text-[var(--color-spm-red)]" />
        <p className="text-white/70 text-sm">Redirigiendo a Google…</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-950 via-red-950/30 to-slate-900 flex-col items-center justify-center p-12">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[var(--color-spm-red)]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-[var(--color-spm-orange)]/10 rounded-full blur-3xl" />
        </div>
        <div className="relative text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <Image src="/images/logo.png" alt="SPM" fill className="object-contain" />
          </div>
          <h1 className="font-display font-bold text-3xl text-white mb-2">
            SanPedroMotoCare
          </h1>
          <p className="text-slate-400 text-base mb-8">Plataforma de gestión unificada</p>

          <div className="grid grid-cols-2 gap-4 text-left">
            {[
              { icon: "🏍️", title: "Tickets", desc: "Gestión completa de servicios" },
              { icon: "👥", title: "Clientes", desc: "CRM integrado" },
              { icon: "🔧", title: "Mecánicos", desc: "Dispatch en tiempo real" },
              { icon: "📊", title: "Analytics", desc: "Dashboard con KPIs" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="text-2xl block mb-2">{icon}</span>
                <p className="text-white font-semibold text-sm">{title}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className={`inline-flex items-center gap-2 text-sm mb-8 transition-colors ${
              isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ArrowLeft size={14} />
            Volver al inicio
          </Link>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="relative w-10 h-10">
              <Image src="/images/logo.png" alt="SPM" fill className="object-contain" />
            </div>
            <div>
              <span className={`font-display font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>SanPedro</span>
              <span className="font-display font-bold text-lg text-[var(--color-spm-red)]">MotoCare</span>
            </div>
          </div>

          <h2 className={`font-display font-bold text-2xl lg:text-3xl mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>
            {mode === "registro" ? "Crea tu cuenta" : t("login_title")}
          </h2>
          <p className={`text-sm mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {mode === "registro"
              ? "Con tu cuenta armas tu membresía de mantenimiento y sigues tus servicios."
              : t("login_subtitle")}
          </p>

          {/* Tabs: iniciar sesión / crear cuenta */}
          <div className={`grid grid-cols-2 gap-1 p-1 rounded-xl mb-6 ${isDark ? "bg-white/5" : "bg-slate-100"}`}>
            {(["login", "registro"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(""); }}
                className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === m
                    ? "bg-[var(--color-spm-red)] text-white"
                    : isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>

          {/* Google Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={submitting}
            className={`w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border font-semibold text-sm transition-all mb-4 hover:scale-[1.01] ${
              isDark
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10"
                : "bg-white border-gray-200 text-slate-700 hover:bg-gray-50 shadow-sm"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.87C4.672 4.744 6.656 3.58 9 3.58z"/>
            </svg>
            {t("login_google")}
          </button>

          <div className={`flex items-center gap-3 mb-4 ${isDark ? "text-slate-600" : "text-slate-300"}`}>
            <div className="flex-1 h-px bg-current" />
            <span className="text-xs">o</span>
            <div className="flex-1 h-px bg-current" />
          </div>

          {/* Email Form */}
          <form onSubmit={mode === "registro" ? handleRegister : handleEmailLogin} className="space-y-4">
            {mode === "registro" && (
              <>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                    required
                    maxLength={80}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    WhatsApp / teléfono
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="81 1234 5678"
                    autoComplete="tel"
                    maxLength={20}
                    className={inputClass}
                  />
                </div>
              </>
            )}
            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {t("login_email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === "registro" ? "tucorreo@gmail.com" : "admin@spm.mx"}
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {t("login_password")}
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "registro" ? "new-password" : "current-password"}
                  required
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-gray-400"}`}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white font-bold text-sm rounded-xl transition-all hover:scale-[1.01] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {mode === "registro" ? "Crear cuenta" : t("login_btn")}
            </button>
          </form>

          <p className={`text-xs text-center mt-6 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            ¿Eres cliente?{" "}
            <Link href="/portal" className="text-[var(--color-spm-red)] hover:underline font-medium">
              Acceder al portal de clientes
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
