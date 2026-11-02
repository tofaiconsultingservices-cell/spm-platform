import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | SanPedroMotoCare",
  description:
    "Conoce cómo SanPedroMotoCare recopila, usa y protege tu información personal.",
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
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
            Política de Privacidad
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Última actualización: {lastUpdated}
          </p>
        </div>

        <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-[var(--text-primary)]">
          <section>
            <h2 className="font-display font-bold text-lg mb-3">1. Responsable del tratamiento</h2>
            <p>
              <strong>SanPedroMotoCare</strong> (en adelante "SPM", "nosotros" o "la empresa") es
              responsable del tratamiento de los datos personales que nos proporciones a través de
              nuestro sitio web <strong>sanpedromotocare.com</strong> y de nuestra aplicación web.
              Puedes contactarnos en{" "}
              <a href="mailto:admin@sanpedromotocare.com" className="text-[var(--color-spm-red)] hover:underline">
                admin@sanpedromotocare.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">2. Datos que recopilamos</h2>
            <p>Recopilamos la siguiente información cuando usas nuestros servicios:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Nombre completo y datos de contacto (teléfono, correo electrónico).</li>
              <li>Dirección de servicio (para atenderte en tu ubicación).</li>
              <li>Información sobre tu motocicleta (marca, año, tipo de servicio).</li>
              <li>Historial de servicios solicitados y cotizaciones.</li>
              <li>Datos de acceso a cuenta (correo y contraseña cifrada vía Firebase Auth).</li>
              <li>Información técnica de uso del sitio (IP, tipo de dispositivo, navegador).</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">3. Finalidad del tratamiento</h2>
            <p>Usamos tus datos exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Procesar y dar seguimiento a tus solicitudes de cotización y servicio.</li>
              <li>Comunicarnos contigo para coordinar la atención de tu motocicleta.</li>
              <li>Enviarte actualizaciones sobre el estado de tu servicio (ticket SPM-XXXX).</li>
              <li>Mejorar la calidad de nuestros servicios y la experiencia del usuario.</li>
              <li>Cumplir con obligaciones legales y fiscales aplicables.</li>
            </ul>
            <p className="mt-3">
              <strong>No vendemos, alquilamos ni compartimos tus datos personales con terceros</strong>{" "}
              salvo cuando sea estrictamente necesario para prestar el servicio (p.ej. proveedor de
              pagos) o por requerimiento legal.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">4. Almacenamiento y seguridad</h2>
            <p>
              Tus datos se almacenan en servidores de <strong>Google Firebase</strong> (Firestore y
              Authentication), protegidos bajo las políticas de seguridad de Google Cloud. Utilizamos
              cookies HttpOnly para gestionar sesiones de forma segura, sin exponer tokens al
              navegador.
            </p>
            <p className="mt-2">
              Aplicamos medidas técnicas razonables para proteger tu información frente a acceso no
              autorizado, alteración o destrucción.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">5. Tus derechos (ARCO)</h2>
            <p>
              De acuerdo con la Ley Federal de Protección de Datos Personales en Posesión de los
              Particulares (LFPDPPP), tienes derecho a:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Acceso:</strong> conocer qué datos tenemos sobre ti.</li>
              <li><strong>Rectificación:</strong> corregir datos incorrectos.</li>
              <li><strong>Cancelación:</strong> solicitar la eliminación de tus datos.</li>
              <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos para ciertos fines.</li>
            </ul>
            <p className="mt-3">
              Para ejercer tus derechos ARCO envía un correo a{" "}
              <a href="mailto:admin@sanpedromotocare.com" className="text-[var(--color-spm-red)] hover:underline">
                admin@sanpedromotocare.com
              </a>{" "}
              con el asunto "Solicitud ARCO" e identificación oficial.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">6. Cookies</h2>
            <p>
              Usamos cookies técnicas esenciales para el funcionamiento del sitio (gestión de
              sesión) y cookies de preferencias (tema visual, idioma). No utilizamos cookies de
              rastreo publicitario de terceros.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">7. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta política ocasionalmente. Te notificaremos sobre cambios
              relevantes a través de nuestro sitio web. La fecha de "última actualización" al inicio
              de este documento siempre reflejará la versión más reciente.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg mb-3">8. Contacto</h2>
            <p>
              Si tienes dudas sobre esta política o el tratamiento de tus datos, contáctanos:
            </p>
            <ul className="list-none mt-2 space-y-1">
              <li>📧 <a href="mailto:admin@sanpedromotocare.com" className="text-[var(--color-spm-red)] hover:underline">admin@sanpedromotocare.com</a></li>
              <li>📱 <a href="https://wa.me/528133880010" target="_blank" rel="noopener noreferrer" className="text-[var(--color-spm-red)] hover:underline">WhatsApp: +52 81 3388-0010</a></li>
              <li>📍 San Pedro Garza García, Nuevo León, México</li>
            </ul>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-8 border-t border-[var(--border-color,#e5e7eb)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--text-secondary)]">
            © {new Date().getFullYear()} SanPedroMotoCare. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/terminos" className="text-xs text-[var(--color-spm-red)] hover:underline">
              Términos de servicio
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
