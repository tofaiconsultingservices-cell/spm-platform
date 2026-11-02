import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio | SanPedroMotoCare",
  description:
    "Conoce los términos y condiciones que rigen el uso de los servicios de SanPedroMotoCare.",
  robots: { index: true, follow: true },
};

export default function TerminosPage() {
  const lastUpdated = "15 de abril de 2026";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-color,#e5e7eb)] px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-9 h-9">
              <Image src="/images/logo.png" alt="SanPedroMotoCare" fill className="object-contain" />
            </div>
            <span className="font-display font-bold text-base">
              SanPedro<span className="text-[var(--color-spm-red)]">MotoCare</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs text-[var(--color-spm-red)] hover:underline font-medium"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <span className="inline-block px-3 py-1 rounded-full bg-[var(--color-spm-red)]/10 text-[var(--color-spm-red)] text-xs font-semibold uppercase tracking-widest mb-4">
            Legal
          </span>
          <h1 className="font-display font-bold text-3xl sm:text-4xl mb-2">
            Términos de Servicio
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Última actualización: {lastUpdated}
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--text-primary)]">
          <section>
            <h2 className="font-display font-bold text-lg mb-3">1. Aceptación de los términos</h2>
            <p>
              Al solicitar una cotización, crear una cuenta o contratar cualquier servicio a través
              de <strong>sanpedromotocare.com</strong>, aceptas quedar vinculado por estos Términos
              de Servicio. Si no estás de acuerdo, no uses nuestros servicios.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">2. Descripción del servicio</h2>
            <p>
              SanPedroMotoCare ofrece servicios de mantenimiento y reparación de motocicletas a
              domicilio en San Pedro Garza García y área metropolitana de Monterrey, Nuevo León,
              México. Los servicios incluyen (sin limitarse a): afinaciones, frenos, sistema
              eléctrico, suspensión, cadena, neumáticos y diagnóstico general.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">3. Proceso de cotización y contratación</h2>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>
                Las cotizaciones son <strong>estimaciones</strong> basadas en la información
                proporcionada. El precio final puede variar si se detectan fallas adicionales
                durante el diagnóstico en sitio.
              </li>
              <li>
                Te notificaremos de cualquier cambio en el costo antes de proceder con el trabajo
                adicional.
              </li>
              <li>
                La contratación se confirma cuando un operador de SPM te contacta para agendar
                la visita.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">4. Garantía de servicio</h2>
            <p>
              Ofrecemos garantía en mano de obra por <strong>30 días naturales</strong> a partir
              de la fecha de servicio. Las refacciones instaladas están sujetas a la garantía del
              fabricante. La garantía no aplica en casos de mal uso, accidentes o modificaciones
              realizadas por terceros posteriores al servicio.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">5. Pagos</h2>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Aceptamos efectivo, tarjeta de crédito/débito y transferencia bancaria.</li>
              <li>El pago se realiza al finalizar el servicio, salvo acuerdo previo.</li>
              <li>
                En servicios de mayor cuantía, podemos solicitar un anticipo para adquirir
                refacciones.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">6. Cancelaciones y reprogramaciones</h2>
            <p>
              Puedes cancelar o reprogramar una visita sin costo si nos avisas con al menos{" "}
              <strong>2 horas de anticipación</strong> vía WhatsApp o llamada. Cancelaciones
              con menos tiempo podrán generar un cargo por visita (gasolina y tiempo del mecánico).
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">7. Responsabilidad</h2>
            <p>
              SanPedroMotoCare se compromete a prestar el servicio con profesionalismo y cuidado.
              No somos responsables por daños preexistentes no reportados, daños causados por
              refacciones defectuosas del fabricante, o situaciones de fuerza mayor.
            </p>
            <p className="mt-2">
              Nuestra responsabilidad máxima se limita al valor del servicio contratado.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">8. Uso del sitio web y la plataforma</h2>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>No debes usar el sitio para fines ilegales o no autorizados.</li>
              <li>
                Las cuentas de usuario son personales e intransferibles. Eres responsable de
                mantener la confidencialidad de tu contraseña.
              </li>
              <li>
                Podemos suspender cuentas que violen estos términos o hagan uso indebido de la
                plataforma.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">9. Propiedad intelectual</h2>
            <p>
              Todo el contenido del sitio (textos, imágenes, logotipos, código) es propiedad de
              SanPedroMotoCare o se usa con licencia. Queda prohibida su reproducción o uso
              comercial sin autorización escrita.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">10. Ley aplicable</h2>
            <p>
              Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier
              controversia se someterá a la jurisdicción de los tribunales competentes de San
              Pedro Garza García, Nuevo León.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">11. Contacto</h2>
            <p>Para dudas sobre estos términos:</p>
            <ul className="list-none mt-2 space-y-1">
              <li>📧 <a href="mailto:admin@sanpedromotocare.com" className="text-[var(--color-spm-red)] hover:underline">admin@sanpedromotocare.com</a></li>
              <li>📱 <a href="https://wa.me/528133880010" target="_blank" rel="noopener noreferrer" className="text-[var(--color-spm-red)] hover:underline">WhatsApp: +52 81 3388-0010</a></li>
            </ul>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-[var(--border-color,#e5e7eb)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-secondary)]">
            © {new Date().getFullYear()} SanPedroMotoCare. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacidad" className="text-xs text-[var(--color-spm-red)] hover:underline">
              Política de privacidad
            </Link>
            <Link href="/" className="text-xs text-[var(--color-spm-red)] hover:underline">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
