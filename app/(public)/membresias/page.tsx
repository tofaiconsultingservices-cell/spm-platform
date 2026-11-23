import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import ChatWidget from "@/components/chatbot/ChatWidget";
import { VEHICLE_TYPES, recommendedFreq, calcMembership, fmtMXN } from "@/lib/memberships/config";

export const metadata = {
  title: "Membresías de Mantenimiento | SanPedroMotoCare",
  description:
    "Arma tu membresía de mantenimiento a 12 meses para motoneta, moto de trabajo, deportiva, BMW, dirt bike, cuatrimoto o RZR. Pago semanal o mensual.",
};

const REGISTER_HREF = "/login?modo=registro&from=/portal/membresias";

/** Precio mensual más bajo de cada tipo (uso recreativo, cilindrada menor). */
function fromMonthly(typeId: (typeof VEHICLE_TYPES)[number]["id"]): number {
  const q = calcMembership({
    type: typeId, range: 0, usage: "recreativo", freq: recommendedFreq(typeId, "recreativo"),
    perks: [], parts: true, units: 1, billing: "monthly", model: "",
  });
  return q.monthly;
}

const STEPS = [
  { n: 1, title: "Crea tu cuenta", desc: "Con tu correo o con Google. Así guardamos tu plan y tu historial de servicios." },
  { n: 2, title: "Registra tu vehículo", desc: "Marca, modelo, año, VIN, 4 fotos y cómo lo usas, para que lleguemos preparados." },
  { n: 3, title: "Arma tu paquete", desc: "Eliges tu vehículo, cilindrada y servicios. Ves el precio de refacción y mano de obra de cada uno." },
  { n: 4, title: "Activamos tu plan", desc: "Revisamos tu vehículo, confirmamos el precio y empiezas a pagar semanal o mensual." },
];

export default function MembresiasPublicPage() {
  return (
    <main>
      <Navbar />
      <section className="pt-28 pb-16 lg:pt-36">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-spm-red-light)]">
            Membresías de mantenimiento · 12 meses
          </p>
          <h1 className="font-display font-bold text-4xl sm:text-5xl lg:text-6xl leading-tight mt-3 max-w-3xl">
            Arma el plan de <span className="gradient-text">tu máquina</span>
          </h1>
          <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-2xl">
            Motonetas, motos de trabajo, deportivas, BMW y europeas, dirt bikes, cuatrimotos y RZR.
            Mano de obra −20%, refacciones −10% y pago semanal con 8% extra de descuento.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href={REGISTER_HREF}
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-[var(--color-spm-red)] text-white font-semibold rounded-xl hover:bg-[var(--color-spm-red-dark)] transition-all hover:scale-105">
              Crear cuenta y armar mi membresía
            </Link>
            <Link href="/portal/membresias"
              className="inline-flex items-center gap-2 px-6 py-3.5 border border-[var(--border-color)] font-semibold rounded-xl hover:border-[var(--color-spm-red-light)] transition-all">
              Ya tengo cuenta
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-14">
            {VEHICLE_TYPES.map(t => (
              <div key={t.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
                <span className="text-3xl">{t.icon}</span>
                <h3 className="font-display font-bold mt-3">{t.name}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{t.ex}</p>
                <p className="mt-3 text-sm">
                  Desde <span className="font-display font-bold text-xl text-[var(--color-spm-red-light)]">{fmtMXN(fromMonthly(t.id))}</span>
                  <span className="text-[var(--text-secondary)]">/mes</span>
                </p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-14">
            {STEPS.map(s => (
              <div key={s.n} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-spm-red)] text-white font-display font-bold grid place-items-center">{s.n}</div>
                <h3 className="font-display font-bold text-lg mt-4">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{s.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-[var(--text-secondary)] mt-8 max-w-3xl">
            Precios de referencia con uso recreativo, refacciones de rango medio incluidas y la cilindrada más baja de cada categoría.
            El precio final se confirma al revisar tu vehículo.
          </p>
        </div>
      </section>
      <Footer />
      <ChatWidget />
    </main>
  );
}
