import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Página no encontrada | SanPedroMotoCare",
  description: "La página que buscas no existe.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-10 group">
        <div className="relative w-12 h-12">
          <Image
            src="/images/logo.png"
            alt="SanPedroMotoCare"
            fill
            className="object-contain"
            priority
          />
        </div>
        <div>
          <span className="font-display font-bold text-xl text-[var(--text-primary)]">SanPedro</span>
          <span className="font-display font-bold text-xl text-[var(--color-spm-red)]">MotoCare</span>
        </div>
      </Link>

      {/* Error code */}
      <div className="relative mb-6">
        <p className="font-display font-bold text-[10rem] leading-none text-[var(--color-spm-red)]/10 select-none">
          404
        </p>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl">🏍️</span>
        </div>
      </div>

      <h1 className="font-display font-bold text-2xl sm:text-3xl mb-3 text-center">
        Esta página se quedó sin gasolina
      </h1>
      <p className="text-center text-sm sm:text-base text-[var(--text-secondary)] max-w-sm mb-8">
        La ruta que buscas no existe o fue movida. No te preocupes — nuestro mecánico virtual te ayuda desde el inicio.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white font-semibold text-sm rounded-xl transition-all hover:scale-105 shadow-lg shadow-red-900/20"
        >
          Volver al inicio
        </Link>
        <Link
          href="/#cotizar"
          className="px-6 py-3 border border-[var(--color-spm-red)] text-[var(--color-spm-red)] font-semibold text-sm rounded-xl hover:bg-[var(--color-spm-red)] hover:text-white transition-all"
        >
          Solicitar servicio
        </Link>
        <a
          href="https://wa.me/528133880010?text=Hola%2C%20necesito%20ayuda"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-xl transition-all hover:scale-105"
        >
          WhatsApp directo
        </a>
      </div>

      <p className="mt-12 text-xs text-[var(--text-secondary)] opacity-60">
        © {new Date().getFullYear()} SanPedroMotoCare
      </p>
    </div>
  );
}
