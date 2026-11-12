"use client";

import { SALE_MARKUP_PERCENT, priceFromCost } from "@/lib/pricing";

export function formatMXN(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function FixedPricePreview({
  costInput,
  isDark,
}: {
  costInput: string;
  isDark: boolean;
}) {
  const cost = Number(costInput);
  const valid = costInput.trim() !== "" && Number.isFinite(cost) && cost >= 0;
  const priced = valid ? priceFromCost(cost) : null;

  return (
    <div className={`rounded-xl px-3 py-2.5 text-sm ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
      <p className={`text-xs mb-1.5 ${isDark ? "text-emerald-200/80" : "text-emerald-800"}`}>
        Precio de venta fijo: costo + {SALE_MARKUP_PERCENT}%. No se puede editar.
      </p>
      <div className="flex justify-between gap-3">
        <span className={isDark ? "text-slate-300" : "text-slate-600"}>Precio de venta</span>
        <span className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          {priced ? formatMXN(priced.salePrice) : "—"}
        </span>
      </div>
      <div className="flex justify-between gap-3 mt-1">
        <span className={isDark ? "text-slate-300" : "text-slate-600"}>Utilidad por unidad</span>
        <span className="font-semibold text-emerald-500">
          {priced ? formatMXN(priced.profit) : "—"}
        </span>
      </div>
    </div>
  );
}
