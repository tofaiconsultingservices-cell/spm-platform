"use client";

import { useState, useEffect } from "react";
import { collection, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDb, getFirebaseStorage } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { VEHICLE_TYPES, USAGES, type VehicleTypeId, type UsageId } from "@/lib/memberships/config";
import type { Motorcycle, MotoType } from "@/types";
import { Camera, Loader2, Save, X } from "lucide-react";

export const PHOTO_SLOTS = [
  { id: "frente", label: "Frente" },
  { id: "izquierdo", label: "Lado izquierdo" },
  { id: "derecho", label: "Lado derecho" },
  { id: "atras", label: "Atrás" },
] as const;
type Slot = (typeof PHOTO_SLOTS)[number]["id"];

const BRANDS = [
  "Honda", "Yamaha", "Kawasaki", "Suzuki", "BMW", "KTM", "Ducati", "Triumph", "Harley-Davidson",
  "Royal Enfield", "Bajaj", "TVS", "Hero", "Italika", "Vento", "Carabela", "CFMoto",
  "Polaris", "Can-Am", "Otra",
];

/** Tipo heredado (MotoType) para que el CRM siga mostrando algo coherente. */
const LEGACY_TYPE: Record<VehicleTypeId, MotoType> = {
  scooter: "scooter", trabajo: "otra", deportiva: "deportiva", premium: "touring",
  dirt: "enduro", atv: "otra", utv: "otra",
};

const VIN_RE = /^[A-HJ-NPR-Z0-9]{11,17}$/;

/** Reduce la foto a máx. 1600 px en JPEG para subir rápido desde el celular. */
async function compressImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file; // formato que el navegador no puede leer (p. ej. HEIC): se sube tal cual
  }
}

interface PhotoState { file?: File; preview?: string; url?: string }

interface Props {
  initial?: Motorcycle | null;
  onSaved: (moto: Motorcycle) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export default function VehicleForm({ initial, onSaved, onCancel, submitLabel }: Props) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [vehicleType, setVehicleType] = useState<VehicleTypeId>(initial?.vehicleType ?? "trabajo");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [year, setYear] = useState(initial?.year ? String(initial.year) : String(new Date().getFullYear()));
  const [cc, setCc] = useState(initial?.cilindrada ? String(initial.cilindrada) : "");
  const [color, setColor] = useState(initial?.color ?? "");
  const [placa, setPlaca] = useState(initial?.placa ?? "");
  const [vin, setVin] = useState(initial?.vin ?? "");
  const [usage, setUsage] = useState<UsageId>(initial?.usage ?? "trabajo");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [photos, setPhotos] = useState<Record<Slot, PhotoState>>(() => ({
    frente: { url: initial?.photos?.frente },
    izquierdo: { url: initial?.photos?.izquierdo },
    derecho: { url: initial?.photos?.derecho },
    atras: { url: initial?.photos?.atras },
  }));
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  // Liberar las vistas previas locales al salir
  useEffect(() => () => {
    Object.values(photos).forEach(p => p.preview && URL.revokeObjectURL(p.preview));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pickPhoto(slot: Slot, file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Solo se permiten imágenes."); return; }
    setPhotos(p => {
      if (p[slot].preview) URL.revokeObjectURL(p[slot].preview!);
      return { ...p, [slot]: { ...p[slot], file, preview: URL.createObjectURL(file) } };
    });
  }

  async function handleSave() {
    if (!user) return;
    setError("");
    const y = Number(year);
    const vinClean = vin.toUpperCase().replace(/[\s-]/g, "");
    if (!brand || !model.trim()) return setError("Marca y modelo son requeridos.");
    if (!y || y < 1950 || y > new Date().getFullYear() + 1) return setError("Revisa el año.");
    if (vinClean && !VIN_RE.test(vinClean)) return setError("El VIN debe tener de 11 a 17 letras y números (sin I, O ni Q).");
    if (description.trim().length < 10) return setError("Cuéntanos brevemente cómo usas tu vehículo.");
    const missing = PHOTO_SLOTS.filter(s => !photos[s.id].file && !photos[s.id].url);
    if (missing.length) return setError(`Faltan fotos: ${missing.map(m => m.label).join(", ")}.`);

    setSaving(true);
    try {
      const db = getDb();
      const ref = initial ? doc(db, "motorcycles", initial.id) : doc(collection(db, "motorcycles"));

      const urls: Record<Slot, string> = {} as Record<Slot, string>;
      const toUpload = PHOTO_SLOTS.filter(s => photos[s.id].file);
      let done = 0;
      for (const s of PHOTO_SLOTS) {
        const ph = photos[s.id];
        if (ph.file) {
          setProgress(`Subiendo fotos ${done + 1}/${toUpload.length}…`);
          const blob = await compressImage(ph.file);
          const path = `motorcycles/${user.uid}/${ref.id}/${s.id}-${Date.now()}.jpg`;
          const r = storageRef(getFirebaseStorage(), path);
          await uploadBytes(r, blob, { contentType: blob.type || "image/jpeg" });
          urls[s.id] = await getDownloadURL(r);
          done++;
        } else {
          urls[s.id] = ph.url!;
        }
      }
      setProgress("Guardando…");

      // Firestore no acepta undefined: solo se incluyen campos con valor
      const data: Record<string, unknown> = {
        clientId: user.uid,
        vehicleType,
        tipoMoto: LEGACY_TYPE[vehicleType],
        brand,
        model: model.trim(),
        year: y,
        usage,
        description: description.trim(),
        photos: urls,
        photoUrl: urls.frente,
        updatedAt: serverTimestamp(),
      };
      if (cc) data.cilindrada = Number(cc);
      if (color.trim()) data.color = color.trim();
      if (placa.trim()) data.placa = placa.trim().toUpperCase();
      if (vinClean) data.vin = vinClean;

      if (initial) await updateDoc(ref, data);
      else await setDoc(ref, { ...data, createdAt: serverTimestamp() });

      onSaved({ id: ref.id, ...(data as Omit<Motorcycle, "id">) });
    } catch (err) {
      console.error("[VehicleForm] save failed:", err);
      setError("No pudimos guardar tu vehículo. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  const label = `text-xs font-semibold uppercase tracking-wide block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`;
  const input = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-[var(--color-spm-red-light)] ${
    isDark ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900"
  }`;

  return (
    <div className="space-y-5">
      <div>
        <span className={label}>Tipo de vehículo *</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {VEHICLE_TYPES.map(t => (
            <button key={t.id} type="button" onClick={() => setVehicleType(t.id)}
              className={`rounded-xl border p-2.5 text-left text-xs font-semibold transition-all ${
                vehicleType === t.id
                  ? "bg-[var(--color-spm-red)] border-[var(--color-spm-red)] text-white"
                  : isDark ? "bg-slate-800 border-white/10 text-slate-200" : "bg-white border-gray-200 text-slate-700"
              }`}>
              <span className="text-lg mr-1">{t.icon}</span>{t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Marca *</label>
          <select value={brand} onChange={e => setBrand(e.target.value)} className={input}>
            <option value="">Seleccionar…</option>
            {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Modelo *</label>
          <input value={model} onChange={e => setModel(e.target.value)} maxLength={60} placeholder="FT150, S 1000 RR, RZR XP…" className={input} />
        </div>
        <div>
          <label className={label}>Año *</label>
          <input type="number" inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} min={1950} max={new Date().getFullYear() + 1} className={input} />
        </div>
        <div>
          <label className={label}>Cilindrada (cc)</label>
          <input type="number" inputMode="numeric" value={cc} onChange={e => setCc(e.target.value)} placeholder="150" className={input} />
        </div>
        <div>
          <label className={label}>Color</label>
          <input value={color} onChange={e => setColor(e.target.value)} maxLength={30} placeholder="Negro" className={input} />
        </div>
        <div>
          <label className={label}>Placa</label>
          <input value={placa} onChange={e => setPlaca(e.target.value)} maxLength={12} placeholder="ABC-1234" className={`${input} uppercase font-mono`} />
        </div>
      </div>

      <div>
        <label className={label}>Número de serie (VIN)</label>
        <input value={vin} onChange={e => setVin(e.target.value)} maxLength={20} placeholder="17 caracteres — viene en la tarjeta de circulación o en el chasis" className={`${input} uppercase font-mono`} />
      </div>

      <div>
        <span className={label}>Fotos de tu vehículo * (4)</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PHOTO_SLOTS.map(s => {
            const src = photos[s.id].preview ?? photos[s.id].url;
            return (
              <label key={s.id} className={`relative aspect-[4/3] rounded-xl border-2 border-dashed overflow-hidden cursor-pointer grid place-items-center transition-all hover:border-[var(--color-spm-red-light)] ${
                isDark ? "border-white/15 bg-slate-800" : "border-gray-300 bg-slate-50"}`}>
                <input type="file" accept="image/*" className="sr-only" onChange={e => pickPhoto(s.id, e.target.files?.[0])} />
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={s.label} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className={`flex flex-col items-center gap-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    <Camera size={20} /> {s.label}
                  </span>
                )}
                {src && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] py-1 text-center">{s.label} · cambiar</span>}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <span className={label}>¿Cómo la usas? *</span>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {USAGES.map(u => (
            <button key={u.id} type="button" onClick={() => setUsage(u.id)}
              className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                usage === u.id
                  ? "bg-[var(--color-spm-red)] border-[var(--color-spm-red)] text-white"
                  : isDark ? "bg-slate-800 border-white/10 text-slate-200" : "bg-white border-gray-200 text-slate-700"
              }`}>{u.name}</button>
          ))}
        </div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={500}
          placeholder="Ej. Reparto en DiDi y Uber Eats, unos 150 km al día en zona centro. Tiene escape y luces LED aftermarket."
          className={`${input} resize-none`} />
        <p className={`text-xs mt-1 text-right ${isDark ? "text-slate-500" : "text-slate-400"}`}>{description.length}/500</p>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}
            className={`px-4 py-3 rounded-xl border text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-white/10 text-slate-300" : "border-gray-200 text-slate-600"}`}>
            <X size={15} /> Cancelar
          </button>
        )}
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex-1 py-3 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? progress || "Guardando…" : submitLabel ?? (initial ? "Guardar cambios" : "Registrar vehículo")}
        </button>
      </div>
      <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
        Tus fotos y datos solo los ve tu cuenta y el equipo de San Pedro Moto Care.
      </p>
    </div>
  );
}
