"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { useTheme } from "@/contexts/ThemeContext";
import { subscribeActiveProducts } from "@/lib/firestore/products";
import type { Product, ProductCategory } from "@/types";
import { PRODUCT_CATEGORY_LABELS, PRODUCT_UNIT_LABELS } from "@/types";
import {
  Search, Package, ShoppingCart, X, ChevronRight, Bike,
  Star, AlertTriangle, Tag, Filter,
} from "lucide-react";

// ── Cart types ────────────────────────────────────────────────────────────────

interface CartItem {
  product: Product;
  qty: number;
}

// ── Format helpers ────────────────────────────────────────────────────────────

function formatMXN(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// ── Product Detail Modal ──────────────────────────────────────────────────────

function ProductModal({
  product, onClose, isDark, onAddToCart,
}: {
  product: Product | null;
  onClose: () => void;
  isDark: boolean;
  onAddToCart: (product: Product) => void;
}) {
  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? "bg-slate-900" : "bg-white"}`}>
        {/* Image */}
        <div className={`relative w-full h-48 rounded-t-2xl overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
          {product.imageUrls?.[0] ? (
            <Image src={product.imageUrls[0]} alt={product.name} fill className="object-contain p-4" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={48} className="text-slate-500" />
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
            <X size={16} />
          </button>
          {product.isFeatured && (
            <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 text-white text-xs font-bold">
              <Star size={10} fill="white" />Destacado
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <p className={`font-mono text-xs mb-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{product.sku}</p>
            <h2 className={`font-display font-bold text-xl leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>{product.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                {PRODUCT_CATEGORY_LABELS[product.category]}
              </span>
              <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{PRODUCT_UNIT_LABELS[product.unit]}</span>
            </div>
          </div>

          {/* Price */}
          <div className={`p-4 rounded-2xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
            <p className={`text-3xl font-display font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{formatMXN(product.salePrice)}</p>
            <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>precio unitario · IVA incluido</p>
          </div>

          {/* Compatible models */}
          {product.compatibleModels.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Bike size={13} className="text-[var(--color-spm-red)]" />
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Modelos compatibles</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {product.compatibleModels.map(m => (
                  <span key={m} className={`px-2.5 py-1 rounded-full text-xs font-medium ${isDark ? "bg-blue-500/15 text-blue-300" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Stock */}
          <div className="flex items-center gap-2">
            {product.stock > 0 ? (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Disponible · {product.stock} {PRODUCT_UNIT_LABELS[product.unit].toLowerCase()}(s) en stock
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-red-400">
                <AlertTriangle size={14} />Sin stock
              </span>
            )}
          </div>

          {/* Tags */}
          {(product.tags ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(product.tags ?? []).map(t => (
                <span key={t} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${isDark ? "text-slate-400 bg-slate-800" : "text-slate-500 bg-slate-100"}`}>
                  <Tag size={9} />{t}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-200 text-slate-600 hover:bg-gray-50"}`}>
              Cerrar
            </button>
            <button
              disabled={product.stock === 0}
              onClick={() => { onAddToCart(product); onClose(); }}
              className="flex-1 py-3 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <ShoppingCart size={15} />
              Agregar al carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cart Drawer ───────────────────────────────────────────────────────────────

function CartDrawer({
  open, onClose, items, onUpdateQty, onRemove, isDark,
}: {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  isDark: boolean;
}) {
  const total = items.reduce((s, i) => s + i.product.salePrice * i.qty, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-sm h-full flex flex-col shadow-2xl ${isDark ? "bg-slate-900" : "bg-white"}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-white/5" : "border-gray-100"}`}>
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-[var(--color-spm-red)]" />
            <h2 className={`font-display font-bold text-base ${isDark ? "text-white" : "text-slate-900"}`}>
              Carrito ({items.length})
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200"><X size={18} /></button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart size={36} className="mx-auto text-slate-600 mb-3" />
              <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>Tu carrito está vacío</p>
            </div>
          ) : (
            items.map(({ product, qty }) => (
              <div key={product.id} className={`flex items-start gap-3 p-3 rounded-2xl ${isDark ? "bg-slate-800/60" : "bg-slate-50"}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-slate-700" : "bg-slate-200"}`}>
                  {product.imageUrls?.[0]
                    ? <Image src={product.imageUrls[0]} alt={product.name} width={48} height={48} className="object-contain rounded-xl" />
                    : <Package size={18} className="text-slate-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>{product.shortName ?? product.name}</p>
                  <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>{formatMXN(product.salePrice)} c/u</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <button onClick={() => onUpdateQty(product.id, qty - 1)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-slate-700"}`}>−</button>
                    <span className={`text-sm font-semibold w-6 text-center ${isDark ? "text-white" : "text-slate-900"}`}>{qty}</span>
                    <button onClick={() => onUpdateQty(product.id, qty + 1)}
                      disabled={qty >= product.stock}
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors disabled:opacity-40 ${isDark ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-slate-700"}`}>+</button>
                    <button onClick={() => onRemove(product.id)} className="w-6 h-6 rounded-md flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors ml-auto">
                      <X size={12} />
                    </button>
                  </div>
                </div>
                <p className={`text-sm font-bold flex-shrink-0 ${isDark ? "text-white" : "text-slate-900"}`}>{formatMXN(product.salePrice * qty)}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className={`p-4 border-t space-y-3 ${isDark ? "border-white/5" : "border-gray-100"}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Total</span>
              <span className={`text-xl font-display font-bold ${isDark ? "text-white" : "text-slate-900"}`}>{formatMXN(total)}</span>
            </div>
            <a
              href={`https://wa.me/528133880010?text=${encodeURIComponent(
                `Hola, quiero comprar:\n${items.map(i => `• ${i.qty}x ${i.product.shortName ?? i.product.name} — ${formatMXN(i.product.salePrice * i.qty)}`).join("\n")}\n\nTotal: ${formatMXN(total)}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[var(--color-spm-orange)] hover:bg-[var(--color-spm-orange-dark)] text-white text-sm font-bold transition-all"
            >
              Pedir por WhatsApp
            </a>
            <p className={`text-xs text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Un asesor confirmará disponibilidad y coordina el envío o recogida
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const MOTO_MODELS = ["FT150", "FT125", "DM200", "DM250", "DM500", "125Z", "GN125", "CB160", "AT110", "Pulsar", "FZ", "TC200", "Tornado"];

export default function TiendaPage() {
  const { isDark } = useTheme();
  const [products, setProducts]       = useState<Product[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [category, setCategory]       = useState<ProductCategory | "todos">("todos");
  const [modelFilter, setModelFilter] = useState("");
  const [featured, setFeatured]       = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen]       = useState(false);
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [filterOpen, setFilterOpen]   = useState(false);

  useEffect(() => {
    const unsub = subscribeActiveProducts(p => { setProducts(p); setLoading(false); });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    let list = products.filter(p => p.isActive);
    if (featured) list = list.filter(p => p.isFeatured);
    if (category !== "todos") list = list.filter(p => p.category === category);
    if (modelFilter) list = list.filter(p => p.compatibleModels.some(m => m.toLowerCase().includes(modelFilter.toLowerCase())));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.shortName ?? "").toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.compatibleModels.some(m => m.toLowerCase().includes(q)) ||
        (p.tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [products, search, category, modelFilter, featured]);

  const cartTotal = cart.reduce((s, i) => s + i.product.salePrice * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.findIndex(i => i.product.id === product.id);
      if (existing >= 0) {
        return prev.map((i, idx) => idx === existing ? { ...i, qty: Math.min(i.qty + 1, product.stock) } : i);
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function updateCartQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId));
    } else {
      setCart(prev => prev.map(i => i.product.id === productId ? { ...i, qty } : i));
    }
  }

  const cardBase = `rounded-2xl border transition-all cursor-pointer ${isDark ? "bg-slate-900 border-white/5 hover:border-[var(--color-spm-red)]/40 hover:bg-slate-800/70" : "bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-[var(--color-spm-red)]/30"}`;

  return (
    <main className={`min-h-screen ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      <Navbar />

      {/* Hero banner */}
      <section className={`pt-24 pb-10 px-4 ${isDark ? "bg-gradient-to-b from-slate-900 to-slate-950" : "bg-gradient-to-b from-white to-slate-50"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full bg-[var(--color-spm-red)]/10 text-[var(--color-spm-red)] text-xs font-bold uppercase tracking-wider">Tienda</span>
          </div>
          <h1 className={`font-display font-bold text-3xl lg:text-4xl mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            Refacciones y Accesorios
          </h1>
          <p className={`text-base ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Catálogo oficial SPM — {products.length} productos disponibles
          </p>
        </div>
      </section>

      {/* Sticky toolbar */}
      <div className={`sticky top-16 z-30 border-b ${isDark ? "bg-slate-950/95 border-white/5 backdrop-blur-md" : "bg-white/95 border-gray-200 backdrop-blur-md shadow-sm"}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--color-spm-red)]/30 focus:border-[var(--color-spm-red)] ${
                isDark ? "bg-slate-800 border-white/10 text-white placeholder:text-slate-500" : "bg-white border-gray-200 text-slate-900 placeholder:text-slate-400"
              }`}
              placeholder="Buscar refacción, modelo de moto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Filter toggle */}
          <button onClick={() => setFilterOpen(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
              filterOpen || category !== "todos" || modelFilter || featured
                ? "border-[var(--color-spm-red)] text-[var(--color-spm-red)] bg-[var(--color-spm-red)]/10"
                : isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-200 text-slate-600 hover:bg-gray-50"
            }`}>
            <Filter size={14} />
            <span className="hidden sm:inline">Filtros</span>
            {(category !== "todos" || modelFilter || featured) && (
              <span className="w-4 h-4 rounded-full bg-[var(--color-spm-red)] text-white text-[10px] flex items-center justify-center font-bold">
                {[category !== "todos", !!modelFilter, featured].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Cart button */}
          <button onClick={() => setCartOpen(true)} className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all">
            <ShoppingCart size={15} />
            <span className="hidden sm:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-bold flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className={`border-t px-4 py-4 ${isDark ? "border-white/5 bg-slate-900/80" : "border-gray-100 bg-slate-50/80"}`}>
            <div className="max-w-6xl mx-auto space-y-3">
              {/* Category */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Categoría</p>
                <div className="flex flex-wrap gap-1.5">
                  {[{ value: "todos", label: "Todas" }, ...Object.entries(PRODUCT_CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }))].map(opt => (
                    <button key={opt.value} onClick={() => setCategory(opt.value as ProductCategory | "todos")}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        category === opt.value
                          ? "bg-[var(--color-spm-red)] text-white"
                          : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-white text-slate-500 hover:text-slate-900 border border-gray-200"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model filter */}
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Modelo de moto</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setModelFilter("")}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      !modelFilter ? "bg-[var(--color-spm-red)] text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-white text-slate-500 hover:text-slate-900 border border-gray-200"
                    }`}>
                    <Bike size={11} />Todas
                  </button>
                  {MOTO_MODELS.map(m => (
                    <button key={m} onClick={() => setModelFilter(m === modelFilter ? "" : m)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                        modelFilter === m ? "bg-[var(--color-spm-red)] text-white" : isDark ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-white text-slate-500 hover:text-slate-900 border border-gray-200"
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured toggle */}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} className="rounded" />
                <span className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>Solo productos destacados</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Results count */}
        <div className="flex items-center justify-between mb-5">
          <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {loading ? "Cargando catálogo..." : `${filtered.length} producto${filtered.length !== 1 ? "s" : ""} encontrado${filtered.length !== 1 ? "s" : ""}`}
          </p>
          {(search || category !== "todos" || modelFilter || featured) && (
            <button onClick={() => { setSearch(""); setCategory("todos"); setModelFilter(""); setFeatured(false); }}
              className="text-xs text-[var(--color-spm-red)] hover:underline font-semibold flex items-center gap-1">
              <X size={12} />Limpiar filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`rounded-2xl h-52 animate-pulse ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="mx-auto text-slate-500 mb-3" />
            <p className={`text-base font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>Sin resultados</p>
            <p className={`text-sm mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>Intenta con otros filtros o términos de búsqueda</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(product => (
              <div key={product.id} className={cardBase} onClick={() => setSelectedProduct(product)}>
                {/* Image area */}
                <div className={`relative h-36 rounded-t-2xl overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                  {product.imageUrls?.[0] ? (
                    <Image src={product.imageUrls[0]} alt={product.name} fill className="object-contain p-3" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={32} className={isDark ? "text-slate-600" : "text-slate-400"} />
                    </div>
                  )}
                  {product.isFeatured && (
                    <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                      <Star size={10} className="text-slate-900" fill="currentColor" />
                    </div>
                  )}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-2xl">
                      <span className="text-white text-xs font-bold px-2 py-1 rounded-full bg-red-500/80">Sin stock</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className={`text-xs mb-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{PRODUCT_CATEGORY_LABELS[product.category]}</p>
                  <p className={`text-sm font-semibold leading-tight line-clamp-2 mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
                    {product.shortName ?? product.name}
                  </p>
                  {product.compatibleModels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {product.compatibleModels.slice(0, 2).map(m => (
                        <span key={m} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-600"}`}>{m}</span>
                      ))}
                      {product.compatibleModels.length > 2 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? "text-slate-500" : "text-slate-400"}`}>+{product.compatibleModels.length - 2}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className={`text-base font-display font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {formatMXN(product.salePrice)}
                    </p>
                    <button
                      disabled={product.stock === 0}
                      onClick={e => { e.stopPropagation(); addToCart(product); }}
                      className="w-7 h-7 rounded-lg bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white flex items-center justify-center transition-all disabled:opacity-40"
                    >
                      <ShoppingCart size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA section */}
        {!loading && (
          <div className={`mt-12 p-6 rounded-2xl text-center ${isDark ? "bg-slate-900 border border-white/5" : "bg-white border border-gray-100 shadow-sm"}`}>
            <p className={`font-display font-bold text-lg mb-1 ${isDark ? "text-white" : "text-slate-900"}`}>¿No encuentras lo que buscas?</p>
            <p className={`text-sm mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Contáctanos y buscamos la refacción específica para tu moto</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/cotizar"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-spm-red)] hover:bg-[var(--color-spm-red-dark)] text-white text-sm font-bold transition-all">
                Cotizar servicio
                <ChevronRight size={14} />
              </Link>
              <a href="https://wa.me/528133880010" target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${isDark ? "border-white/10 text-slate-300 hover:bg-white/5" : "border-gray-200 text-slate-700 hover:bg-gray-50"}`}>
                Contactar por WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      <Footer />

      {/* Modals */}
      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        isDark={isDark}
        onAddToCart={addToCart}
      />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQty={updateCartQty}
        onRemove={id => setCart(prev => prev.filter(i => i.product.id !== id))}
        isDark={isDark}
      />

      {/* Floating cart button (mobile) */}
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-[var(--color-spm-red)] text-white shadow-lg shadow-[var(--color-spm-red)]/30 font-bold text-sm transition-all hover:scale-105"
        >
          <ShoppingCart size={16} />
          {formatMXN(cartTotal)}
          <span className="w-5 h-5 rounded-full bg-white text-[var(--color-spm-red)] text-[10px] font-bold flex items-center justify-center">{cartCount}</span>
        </button>
      )}
    </main>
  );
}
