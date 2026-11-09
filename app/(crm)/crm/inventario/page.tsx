"use client";

import { useState, useEffect, useMemo } from "react";
import CrmShell from "@/components/crm/CrmShell";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeProducts, createProduct, updateProduct, deleteProduct,
  subscribeProductMovements, adjustStock,
} from "@/lib/firestore/products";
import { customerUnitPrice, profitPerUnit, SALE_MARKUP_PERCENT } from "@/lib/pricing";
import { FixedPricePreview } from "@/components/crm/FixedPricePreview";
import { subscribeVendors } from "@/lib/firestore/vendors";
import { receivePurchaseOrder, subscribePurchaseOrders } from "@/lib/firestore/purchase-orders";
import type {
  Product, ProductCategory, ProductUnit, Vendor, PurchaseOrder, PurchaseOrderItem,
  InventoryMovement,
} from "@/types";
import {
  PRODUCT_CATEGORY_LABELS, PRODUCT_UNIT_LABELS, PURCHASE_ORDER_STATUS_LABELS,
} from "@/types";
import {
  Plus, Search, X, Loader2, Package, AlertTriangle, TrendingDown,
  DollarSign, ChevronRight, Edit2, Save, History, ShoppingCart,
  ArrowDown, ArrowUp, Minus, Check, RefreshCw, Eye, Trash2,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMXN(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

const UNIT_OPTIONS: ProductUnit[] = ["PZA", "LT", "KIT", "PAR", "JGO", "MT"];
const CATEGORY_OPTIONS = Object.entries(PRODUCT_CATEGORY_LABELS) as [ProductCategory, string][];

// ── Stock badge ───────────────────────────────────────────────────────────────

function StockBadge({ stock, minStock }: { stock: number; minStock: number }) {
  if (stock === 0)
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">Sin stock</span>;
  if (stock <= minStock)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400"><AlertTriangle size={10} />Stock bajo</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400">En stock</span>;
}

// ── Movement icon ─────────────────────────────────────────────────────────────

function MovementIcon({ type }: { type: InventoryMovement["type"] }) {
  if (["compra", "ajuste-entrada", "devolucion"].includes(type))
    return <ArrowDown size={12} className="text-emerald-400" />;
  return <ArrowUp size={12} className="text-red-400" />;
}

// ── Create Product Modal ──────────────────────────────────────────────────────

function CreateProductModal({
  open, onClose, isDark, vendors,
}: { open: boolean; onClose: () => void; isDark: boolean; vendors: Vendor[] }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", shortName: "", sku: "", category: "motor" as ProductCategory,
    unit: "PZA" as ProductUnit, costPrice: "",
    stock: "0", minStock: "3", supplierName: "", compatibleModels: "",
    tags: "", isActive: true, isFeatured: false,
  });

  useEffect(() => {
    if (!open) setForm({
      name: "", shortName: "", sku: "", category: "motor",
      unit: "PZA", costPrice: "",
      stock: "0", minStock: "3", supplierName: "", compatibleModels: "",
      tags: "", isActive: true, isFeatured: false,
    });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cost = Number(form.costPrice);
    if (!form.name.trim() || !Number.isFinite(cost) || cost < 0) {
      toast.error("Nombre y precio de compra son requeridos");
      return;
    }
    const supplierName = form.supplierName.trim();
    const matched = vendors.find(v => v.name.trim().toLowerCase() === supplierName.toLowerCase());
    setLoading(true);
    try {
      await createProduct({
        name: form.name.trim(),
        shortName: form.shortName.trim() || undefined,
        sku: form.sku.trim() || undefined,
        category: form.category,
        unit: form.unit,
        costPrice: cost,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        vendorId: matched?.id,
        supplierName: supplierName || undefined,
        compatibleModels: form.compatibleModels.split(",").map(s => s.trim()).filter(Boolean),
        tags: form.tags.split(",").map(s => s.trim()).filter(Boolean),
        isActive: form.isActive,
        isFeatured: form.isFeatured,
      });
      toast.success("Producto creado");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al crear el producto");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const inp = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
    isDark ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400"
  }`;
  const lbl = `block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-slate-900" : "bg-white"}`}>
        <div className={`sticky top-0 flex items-center justify-between p-5 border-b z-10 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100"}`}>
          <h3 className={`font-display font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>Nuevo Producto</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={lbl}>Nombre completo *</label>
            <input className={inp} placeholder="ej. Balero Motor DM500" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Nombre corto</label>
              <input className={inp} placeholder="ej. Balero DM500" value={form.shortName}
                onChange={e => setForm(p => ({ ...p, shortName: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>SKU</label>
              <input className={inp} placeholder="PRD-00000 (auto si vacío)" value={form.sku}
                onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Categoría *</label>
              <select className={inp} value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value as ProductCategory }))}>
                {CATEGORY_OPTIONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Unidad *</label>
              <select className={inp} value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value as ProductUnit }))}>
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{PRODUCT_UNIT_LABELS[u]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Precio de compra (proveedor) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <input type="number" min="0" step="0.01" className={inp + " pl-6"} placeholder="0.00"
                value={form.costPrice} onChange={e => setForm(p => ({ ...p, costPrice: e.target.value }))} />
            </div>
          </div>
          <FixedPricePreview costInput={form.costPrice} isDark={isDark} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Stock inicial</label>
              <input type="number" min="0" className={inp} value={form.stock}
                onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Stock mínimo</label>
              <input type="number" min="0" className={inp} value={form.minStock}
                onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={lbl}>Proveedor</label>
            <input className={inp} list="proveedores-nuevo" placeholder="MotoCruz"
              value={form.supplierName}
              onChange={e => setForm(p => ({ ...p, supplierName: e.target.value }))} />
            <datalist id="proveedores-nuevo">
              {vendors.map(v => <option key={v.id} value={v.name} />)}
            </datalist>
          </div>
          <div>
            <label className={lbl}>Modelos compatibles (separados por coma)</label>
            <input className={inp} placeholder="FT150, DM200, 125Z" value={form.compatibleModels}
              onChange={e => setForm(p => ({ ...p, compatibleModels: e.target.value }))} />
          </div>
          <div>
            <label className={lbl}>Etiquetas (separadas por coma)</label>
            <input className={inp} placeholder="motor, cadena, balero" value={form.tags}
              onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                className="rounded" />
              <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>Activo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isFeatured}
                onChange={e => setForm(p => ({ ...p, isFeatured: e.target.checked }))}
                className="rounded" />
              <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>Destacado en tienda</span>
            </label>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Crear producto
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Receive Order Modal ───────────────────────────────────────────────────────

function ReceiveOrderModal({
  open, onClose, isDark, orders,
}: { open: boolean; onClose: () => void; isDark: boolean; orders: PurchaseOrder[] }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [receivedQtys, setReceivedQtys] = useState<Record<number, number>>({});

  const pendingOrders = orders.filter(o => o.status === "borrador" || o.status === "enviada" || o.status === "recibida-parcial");
  const selectedOrder = pendingOrders.find(o => o.id === selectedOrderId);

  useEffect(() => {
    if (!open) { setSelectedOrderId(""); setReceivedQtys({}); }
  }, [open]);

  useEffect(() => {
    if (selectedOrder) {
      const qtys: Record<number, number> = {};
      selectedOrder.items.forEach((item, i) => { qtys[i] = item.qty - (item.receivedQty ?? 0); });
      setReceivedQtys(qtys);
    }
  }, [selectedOrderId, selectedOrder]);

  async function handleReceive() {
    if (!selectedOrder) return;
    setLoading(true);
    try {
      const updatedItems: PurchaseOrderItem[] = selectedOrder.items.map((item, i) => ({
        ...item,
        receivedQty: (item.receivedQty ?? 0) + (receivedQtys[i] ?? 0),
      }));
      await receivePurchaseOrder(selectedOrder.id, user?.uid ?? "system", updatedItems);
      toast.success(`Orden ${selectedOrder.orderId} recibida`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Error al registrar recepción");
    } finally { setLoading(false); }
  }

  if (!open) return null;

  const inp = `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
    isDark ? "bg-slate-800 border-white/10 text-white" : "bg-white border-gray-200 text-slate-900"
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-slate-900" : "bg-white"}`}>
        <div className={`sticky top-0 flex items-center justify-between p-5 border-b z-10 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100"}`}>
          <h3 className={`font-display font-bold text-lg ${isDark ? "text-white" : "text-slate-900"}`}>Recibir Orden de Compra</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Orden de compra
            </label>
            <select className={inp} value={selectedOrderId}
              onChange={e => setSelectedOrderId(e.target.value)}>
              <option value="">Seleccionar orden...</option>
              {pendingOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderId} — {o.vendorName} — {PURCHASE_ORDER_STATUS_LABELS[o.status]}
                </option>
              ))}
            </select>
          </div>

          {selectedOrder && (
            <div className="space-y-3">
              <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Cantidades recibidas
              </p>
              {selectedOrder.items.map((item, i) => {
                const pending = item.qty - (item.receivedQty ?? 0);
                return (
                  <div key={i} className={`p-3 rounded-xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDark ? "text-white" : "text-slate-900"}`}>{item.productName}</p>
                        <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          Pedido: {item.qty} {item.unit} · Pendiente: {pending}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setReceivedQtys(p => ({ ...p, [i]: Math.max(0, (p[i] ?? 0) - 1) }))}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-slate-700"}`}>
                          <Minus size={12} />
                        </button>
                        <input type="number" min="0" max={pending}
                          className={`w-14 px-2 py-1 rounded-lg border text-center text-sm outline-none ${isDark ? "bg-slate-700 border-white/10 text-white" : "bg-white border-gray-200 text-slate-900"}`}
                          value={receivedQtys[i] ?? 0}
                          onChange={e => setReceivedQtys(p => ({ ...p, [i]: Math.min(pending, Math.max(0, Number(e.target.value))) }))} />
                        <button onClick={() => setReceivedQtys(p => ({ ...p, [i]: Math.min(pending, (p[i] ?? 0) + 1) }))}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-slate-700"}`}>
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button onClick={handleReceive} disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[var(--color-spm-orange)] hover:bg-[var(--color-spm-orange-dark)] text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmar recepción
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Product Drawer ────────────────────────────────────────────────────────────

function ProductDrawer({
  product, onClose, isDark, vendors,
}: { product: Product | null; onClose: () => void; isDark: boolean; vendors: Vendor[] }) {
  const { user, hasRole } = useAuth();
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [tab, setTab] = useState<"details" | "history">("details");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", shortName: "", sku: "", category: "otro" as ProductCategory,
    unit: "PZA" as ProductUnit, costPrice: "", stock: "", minStock: "",
    supplierName: "", isActive: true, isFeatured: false,
  });

  useEffect(() => {
    if (!product) return;
    setForm({
      name: product.name,
      shortName: product.shortName ?? "",
      sku: product.sku,
      category: product.category,
      unit: product.unit,
      costPrice: String(product.costPrice),
      stock: String(product.stock),
      minStock: String(product.minStock),
      supplierName: product.supplierName ?? vendors.find(v => v.id === product.vendorId)?.name ?? "",
      isActive: product.isActive,
      isFeatured: product.isFeatured ?? false,
    });
    setEditing(false);
    setTab("details");
    const unsub = subscribeProductMovements(product.id, setMovements);
    return unsub;
    // El nombre del proveedor se toma del arreglo ya cargado al abrir el producto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  async function handleSave() {
    if (!product) return;
    const cost = Number(form.costPrice);
    const nextStock = Number(form.stock);
    if (!form.name.trim() || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(nextStock) || nextStock < 0) {
      toast.error("Nombre, precio de compra y stock son requeridos");
      return;
    }
    const supplierName = form.supplierName.trim();
    const matched = vendors.find(v => v.name.trim().toLowerCase() === supplierName.toLowerCase());
    setSaving(true);
    try {
      await updateProduct(product.id, {
        name: form.name.trim(),
        shortName: form.shortName.trim() || undefined,
        sku: form.sku.trim() || product.sku,
        category: form.category,
        unit: form.unit,
        costPrice: cost,
        minStock: Number(form.minStock) || 0,
        vendorId: matched?.id ?? "",
        supplierName: supplierName || undefined,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
      });
      const delta = nextStock - product.stock;
      if (delta !== 0) {
        await adjustStock(product.id, delta, {
          type: delta > 0 ? "ajuste-entrada" : "ajuste-salida",
          note: "Ajuste manual de inventario",
          createdBy: user?.uid ?? "crm",
          unitCost: cost,
        });
      }
      toast.success("Producto actualizado");
      setEditing(false);
    } catch { toast.error("Error al guardar"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!product) return;
    if (!hasRole("manager")) {
      toast.error("No tienes permiso para eliminar productos");
      return;
    }
    if (!window.confirm(`¿Eliminar "${product.name}" del inventario?`)) return;
    try {
      if (hasRole("admin")) {
        await deleteProduct(product.id);
        toast.success("Producto eliminado");
        onClose();
      } else {
        await updateProduct(product.id, { isActive: false });
        toast.success("Producto desactivado. Solo un admin puede borrarlo por completo.");
      }
    } catch {
      toast.error("No se pudo eliminar");
    }
  }

  if (!product) return null;

  const inp = `w-full px-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-1 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
    isDark ? "bg-slate-800 border-white/10 text-white" : "bg-white border-gray-200 text-slate-900"
  }`;

  const MOVEMENT_LABELS: Record<InventoryMovement["type"], string> = {
    compra: "Compra", "venta-tienda": "Venta tienda", "uso-servicio": "Uso en servicio",
    "ajuste-entrada": "Ajuste +", "ajuste-salida": "Ajuste −", devolucion: "Devolución",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col ${isDark ? "bg-slate-900" : "bg-white"}`}>
        {/* Header */}
        <div className={`sticky top-0 flex items-center justify-between px-5 py-4 border-b z-10 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100"}`}>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-[var(--color-spm-red)] font-bold">{product.sku}</p>
            <p className={`font-display font-bold text-sm leading-tight truncate ${isDark ? "text-white" : "text-slate-900"}`}>{product.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 ml-3 flex-shrink-0"><X size={18} /></button>
        </div>

        {/* Tab bar */}
        <div className={`flex gap-1 px-5 pt-3 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
          {(["details", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${tab === t ? "border-[var(--color-spm-red)] text-[var(--color-spm-red)]" : `border-transparent ${isDark ? "text-slate-400" : "text-slate-500"}`}`}>
              {t === "details" ? "Detalles" : "Movimientos"}
            </button>
          ))}
        </div>

        <div className="flex-1 p-5 space-y-4">
          {tab === "details" ? (
            <>
              {/* Stock card */}
              <div className={`p-4 rounded-2xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Stock actual</span>
                  <StockBadge stock={product.stock} minStock={product.minStock} />
                </div>
                <p className={`text-4xl font-bold font-display ${product.stock === 0 ? "text-red-400" : product.stock <= product.minStock ? "text-amber-400" : isDark ? "text-white" : "text-slate-900"}`}>
                  {product.stock}
                </p>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  {PRODUCT_UNIT_LABELS[product.unit]} · mínimo: {product.minStock}
                </p>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Categoría", value: PRODUCT_CATEGORY_LABELS[product.category] },
                  { label: "Proveedor", value: product.supplierName || vendors.find(v => v.id === product.vendorId)?.name || "—" },
                  { label: "Precio de compra", value: formatMXN(product.costPrice) },
                  { label: "Precio de venta", value: formatMXN(customerUnitPrice(product)) },
                  { label: "Utilidad / pieza", value: formatMXN(profitPerUnit(Number(product.costPrice) || 0, customerUnitPrice(product))) },
                  { label: "Stock", value: String(product.stock) },
                ].map(({ label, value }) => (
                  <div key={label} className={`p-3 rounded-xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                    <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
                    <p className={`font-semibold text-sm mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>{value}</p>
                  </div>
                ))}
              </div>

              {product.compatibleModels.length > 0 && (
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Modelos compatibles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {product.compatibleModels.map(m => (
                      <span key={m} className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? "bg-blue-500/15 text-blue-300" : "bg-blue-50 text-blue-700"}`}>{m}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit fields */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Editar</span>
                  <button onClick={() => setEditing(!editing)} className="text-xs text-[var(--color-spm-red)] hover:underline">
                    {editing ? "Cancelar" : <span className="flex items-center gap-1"><Edit2 size={11} />Editar</span>}
                  </button>
                </div>
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Nombre</label>
                      <input className={inp + " mt-1"} value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Nombre corto</label>
                        <input className={inp + " mt-1"} value={form.shortName}
                          onChange={e => setForm(p => ({ ...p, shortName: e.target.value }))} />
                      </div>
                      <div>
                        <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>SKU</label>
                        <input className={inp + " mt-1"} value={form.sku}
                          onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Proveedor</label>
                      <input className={inp + " mt-1"} list="proveedores-editar" value={form.supplierName}
                        onChange={e => setForm(p => ({ ...p, supplierName: e.target.value }))} />
                      <datalist id="proveedores-editar">
                        {vendors.map(v => <option key={v.id} value={v.name} />)}
                      </datalist>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Compra $</label>
                        <input type="number" min="0" step="0.01" className={inp + " mt-1"} value={form.costPrice}
                          onChange={e => setForm(p => ({ ...p, costPrice: e.target.value }))} />
                      </div>
                      <div>
                        <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Stock</label>
                        <input type="number" min="0" className={inp + " mt-1"} value={form.stock}
                          onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} />
                      </div>
                      <div>
                        <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Mín.</label>
                        <input type="number" min="0" className={inp + " mt-1"} value={form.minStock}
                          onChange={e => setForm(p => ({ ...p, minStock: e.target.value }))} />
                      </div>
                    </div>
                    <FixedPricePreview costInput={form.costPrice} isDark={isDark} />
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.isActive}
                          onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                        <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>Activo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.isFeatured}
                          onChange={e => setForm(p => ({ ...p, isFeatured: e.target.checked }))} />
                        <span className={`text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>Destacado</span>
                      </label>
                    </div>
                    <button onClick={handleSave} disabled={saving}
                      className="w-full py-2.5 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Guardar cambios
                    </button>
                    <button type="button" onClick={handleDelete}
                      className="w-full py-2.5 rounded-xl border border-red-500/40 text-red-400 text-sm font-semibold flex items-center justify-center gap-2">
                      <Trash2 size={14} />
                      Eliminar producto
                    </button>
                  </div>
                ) : (
                  <div className={`p-3 rounded-xl text-xs space-y-1 ${isDark ? "bg-slate-800/40" : "bg-slate-50"}`}>
                    <div className="flex justify-between">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>Creado</span>
                      <span className={isDark ? "text-slate-300" : "text-slate-700"}>{formatDate(product.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>Actualizado</span>
                      <span className={isDark ? "text-slate-300" : "text-slate-700"}>{formatDate(product.updatedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>Margen fijo</span>
                      <span className="text-emerald-400 font-semibold">+{SALE_MARKUP_PERCENT}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>Utilidad</span>
                      <span className="text-emerald-400 font-semibold">
                        {formatMXN(profitPerUnit(Number(product.costPrice) || 0, customerUnitPrice(product)))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {movements.length === 0 ? (
                <div className="text-center py-10">
                  <History size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Sin movimientos registrados</p>
                </div>
              ) : (
                movements.map(m => (
                  <div key={m.id} className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      m.qty > 0 ? "bg-emerald-500/20" : "bg-red-500/20"
                    }`}>
                      <MovementIcon type={m.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>{MOVEMENT_LABELS[m.type]}</p>
                        <span className={`text-sm font-bold ${m.qty > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {m.qty > 0 ? "+" : ""}{m.qty}
                        </span>
                      </div>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {m.stockBefore} → {m.stockAfter} · {formatDate(m.createdAt)}
                      </p>
                      {m.note && <p className={`text-xs italic mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{m.note}</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const FILTER_TABS: { label: string; value: ProductCategory | "todos" | "bajo-stock" }[] = [
  { label: "Todos", value: "todos" },
  { label: "⚠ Stock bajo", value: "bajo-stock" },
  ...CATEGORY_OPTIONS.map(([k, v]) => ({ label: v, value: k as ProductCategory })),
];

export default function InventarioPage() {
  const { isDark } = useTheme();

  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductCategory | "todos" | "bajo-stock">("todos");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState(false);

  useEffect(() => {
    const u1 = subscribeProducts(p => { setProducts(p); setLoading(false); });
    const u2 = subscribeVendors(setVendors);
    const u3 = subscribePurchaseOrders(setOrders);
    return () => { u1(); u2(); u3(); };
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (filter === "bajo-stock") list = list.filter(p => p.stock <= p.minStock);
    else if (filter !== "todos") list = list.filter(p => p.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.shortName ?? "").toLowerCase().includes(q) ||
        (p.supplierName ?? "").toLowerCase().includes(q) ||
        vendors.some(v => v.id === p.vendorId && v.name.toLowerCase().includes(q)) ||
        p.compatibleModels.some(m => m.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, filter, search, vendors]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.isActive).length,
    lowStock: products.filter(p => p.stock <= p.minStock && p.isActive).length,
    outOfStock: products.filter(p => p.stock === 0 && p.isActive).length,
    totalValue: products.reduce((acc, p) => acc + p.stock * p.costPrice, 0),
    totalRetail: products.reduce((acc, p) => acc + p.stock * customerUnitPrice(p), 0),
  }), [products]);

  const cardCls = `p-4 rounded-2xl border ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-gray-100 shadow-sm"}`;

  return (
    <CrmShell title="Inventario" subtitle={`Productos de proveedores · venta = compra + ${SALE_MARKUP_PERCENT}%`}>
      <Toaster position="top-right" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} className="text-[var(--color-spm-red)]" />
            <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Productos</span>
          </div>
          <p className={`text-2xl font-display font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{stats.active}</p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{stats.total} en total</p>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Stock bajo</span>
          </div>
          <p className={`text-2xl font-display font-bold ${stats.lowStock > 0 ? "text-amber-400" : isDark ? "text-white" : "text-slate-900"}`}>{stats.lowStock}</p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{stats.outOfStock} sin stock</p>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-[var(--color-spm-orange)]" />
            <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Valor costo</span>
          </div>
          <p className={`text-lg font-display font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{formatMXN(stats.totalValue)}</p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>inventario a precio proveedor</p>
        </div>
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-emerald-400" />
            <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Valor venta</span>
          </div>
          <p className={`text-lg font-display font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{formatMXN(stats.totalRetail)}</p>
          <p className={`text-xs mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>si se vende todo</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
              isDark ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400"
            }`}
            placeholder="Buscar por nombre, SKU o modelo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={() => setReceiving(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-200 text-slate-700 hover:bg-gray-50"}`}>
          <ShoppingCart size={14} />
          <span className="hidden sm:inline">Recibir orden</span>
        </button>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all">
          <Plus size={14} />
          <span>Nuevo producto</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {FILTER_TABS.map(tab => (
          <button key={tab.value} onClick={() => setFilter(tab.value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              filter === tab.value
                ? "bg-[var(--color-spm-red)] text-white"
                : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-gray-100 text-slate-500 hover:text-slate-900"
            }`}>
            {tab.label}
            {tab.value === "bajo-stock" && stats.lowStock > 0 && (
              <span className="ml-1.5 bg-amber-400 text-slate-900 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{stats.lowStock}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[var(--color-spm-red)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto text-slate-600 mb-3" />
          <p className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {search ? "Sin resultados para esa búsqueda" : "No hay productos en esta categoría"}
          </p>
          {!search && (
            <button onClick={() => setCreating(true)}
              className="mt-3 text-sm text-[var(--color-spm-red)] hover:underline font-semibold">
              Agregar primer producto →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(product => {
            const supplier = product.supplierName || vendors.find(v => v.id === product.vendorId)?.name;
            const sale = customerUnitPrice(product);
            const profit = profitPerUnit(Number(product.costPrice) || 0, sale);
            return (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={`w-full text-left p-4 rounded-2xl border transition-all hover:border-[var(--color-spm-red)]/40 ${
                  isDark ? "bg-slate-900 border-white/5 hover:bg-slate-800/60" : "bg-white border-gray-100 shadow-sm hover:shadow-md"
                } ${!product.isActive ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    product.stock === 0 ? "bg-red-500/15" : product.stock <= product.minStock ? "bg-amber-500/15" : "bg-[var(--color-spm-red)]/10"
                  }`}>
                    <Package size={16} className={
                      product.stock === 0 ? "text-red-400" : product.stock <= product.minStock ? "text-amber-400" : "text-[var(--color-spm-red)]"
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm truncate ${isDark ? "text-white" : "text-slate-900"}`}>{product.name}</p>
                        <p className={`text-xs font-mono ${isDark ? "text-slate-500" : "text-slate-400"}`}>{product.sku}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StockBadge stock={product.stock} minStock={product.minStock} />
                        <ChevronRight size={14} className="text-slate-500" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {PRODUCT_CATEGORY_LABELS[product.category]}
                      </span>
                      {supplier && (
                        <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>· {supplier}</span>
                      )}
                      <span className={`text-xs ml-auto text-right ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        <span className="font-semibold">{formatMXN(sale)}</span>
                        <span className={`block ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          compra {formatMXN(product.costPrice)} · utilidad {formatMXN(profit)}
                        </span>
                      </span>
                    </div>
                    {product.compatibleModels.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {product.compatibleModels.slice(0, 3).map(m => (
                          <span key={m} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>{m}</span>
                        ))}
                        {product.compatibleModels.length > 3 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? "text-slate-500" : "text-slate-400"}`}>+{product.compatibleModels.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modals & Drawer */}
      <CreateProductModal open={creating} onClose={() => setCreating(false)} isDark={isDark} vendors={vendors} />
      <ReceiveOrderModal open={receiving} onClose={() => setReceiving(false)} isDark={isDark} orders={orders} />
      <ProductDrawer product={selectedProduct} onClose={() => setSelectedProduct(null)} isDark={isDark} vendors={vendors} />
    </CrmShell>
  );
}
