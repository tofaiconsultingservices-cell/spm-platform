# SPM Platform — Documento de Handoff
**Fecha:** 2026-06-01  
**Rama:** `master` — desplegado en https://spm-platform.vercel.app  
**Stack:** Next.js 16 App Router · TypeScript · Firebase/Firestore · Stripe (live) · Tailwind CSS v4

---

## 1. Estado actual del proyecto

### Módulos operativos (en producción)

| Módulo | Ruta | Estado |
|---|---|---|
| Landing page pública | `/` | ✅ Operativa con chat IA, cotizador y tracking |
| Auth (Google OAuth) | `/login` | ✅ popup en desktop, redirect en mobile |
| Portal de clientes | `/portal/*` | ✅ Ver tickets, moto, perfil, pagar |
| Tracking en vivo | `/tracking/:ticketId` | ✅ Mapa GPS público sin login |
| CRM — Dashboard | `/crm/dashboard` | ✅ KPIs en tiempo real |
| CRM — Tickets | `/crm/tickets` | ✅ CRUD completo + stepper de estados |
| CRM — Clientes | `/crm/clientes` | ✅ Historial + datos de moto |
| CRM — Mecánicos | `/crm/mecanicos` | ✅ Asignación y disponibilidad |
| CRM — Inventario | `/crm/inventario` | ✅ Catálogo, stock, proveedores, órdenes de compra |
| CRM — Pagos | `/crm/pagos` | ✅ fix aplicado esta sesión |
| CRM — Facturas | `/crm/facturas` | ✅ PDF con jsPDF |
| CRM — Reportes | `/crm/reportes` | ✅ Gráficas Recharts |
| CRM — Asistente IA | Botón en header CRM | ✅ Mistral AI con voz (Web Speech API) |
| Tienda pública | `/tienda` | ✅ Vitrina + carrito + checkout Stripe |
| Pagos Stripe | `/api/payments/*` | ✅ Checkout Sessions + OXXO + webhook live |
| PWA / iOS | Manifest + meta tags | ✅ Instalable en iOS y Android |

### Problemas corregidos en esta sesión

| Error | Archivo | Fix aplicado |
|---|---|---|
| React error #130 — componente `undefined` | `app/(crm)/crm/pagos/page.tsx:607` | `METHOD_ICONS[p.method as PaymentMethod] ?? CreditCard` — fallback cuando Firestore tiene un método de pago con valor desconocido |
| COOP warnings en consola del browser | `next.config.ts` | Header `Cross-Origin-Opener-Policy: same-origin-allow-popups` aplicado solo a rutas `/crm/pagos` y `/portal/pagar` |

### Archivos sin commitear

```
lib/firestore/store-orders.ts       ← helper de pedidos de tienda
public/images/Elevenlabs+whatsaap.png
marketplaceSPM/                     ← documentos raw del proveedor MotoCruz (PDFs, fotos)
PLATAFORMA_SPM.md                   ← documento descriptivo de la plataforma v1.3.0
tarea pendiente.txt                 ← contexto de sesión anterior
contexto tarea pendiente 2.txt      ← log de implementación marketplace
```

---

## 2. Archivos clave — rutas exactas

### Core del proyecto

```
next.config.ts                          ← Headers CSP + COOP + Firebase proxy rewrites
firestore.rules                         ← Reglas de seguridad Firestore por colección
firestore.indexes.json                  ← Índices compuestos (products, purchase_orders, etc.)
types/index.ts                          ← Todos los tipos TypeScript del proyecto (~600 líneas)
```

### Autenticación

```
contexts/AuthContext.tsx                ← signInWithPopup (desktop) / redirect (mobile)
lib/firebase.ts                         ← init Firebase client SDK
lib/firebase-admin.ts                   ← init Admin SDK (server-side)
lib/auth-server.ts                      ← getSessionUser, hasMinimumRole (para API routes)
app/api/auth/session/route.ts           ← Crea sesión cookie tras login
```

### Pagos Stripe

```
lib/payments/stripe-client.ts           ← createCheckoutSession + createStoreCheckoutSession
app/api/payments/create-link/route.ts   ← POST → crea sesión Stripe + envía WhatsApp
app/api/payments/webhook/route.ts       ← Stripe webhook → actualiza Firestore
app/(crm)/crm/pagos/page.tsx            ← Módulo de pagos del CRM ← MODIFICADO esta sesión
app/(portal)/portal/pagar/page.tsx      ← Portal de cliente para pagar
lib/invoice-pdf.ts                      ← generateInvoicePDF + generatePaymentReceiptPDF
```

### Inventario / Marketplace

```
lib/firestore/products.ts               ← CRUD + subscriptions + adjustStock
lib/firestore/vendors.ts                ← CRUD proveedores
lib/firestore/purchase-orders.ts        ← Órdenes de compra + recepción de stock
lib/firestore/store-orders.ts           ← Pedidos de tienda ← SIN COMMITEAR
app/(crm)/crm/inventario/page.tsx       ← Módulo inventario CRM (CRUD completo)
app/(public)/tienda/page.tsx            ← Tienda pública con carrito
app/api/products/route.ts               ← GET/POST productos
app/api/products/[id]/route.ts          ← PUT/DELETE producto individual
app/api/vendors/route.ts                ← GET/POST proveedores
app/api/store/checkout/route.ts         ← Checkout de tienda → Stripe
scripts/seed-motocruz.ts                ← Seed catálogo MotoCruz (758 líneas) ← tiene bug
```

### IA y notificaciones

```
app/api/crm/ai/route.ts                 ← Asistente IA CRM (Mistral + Firestore Admin)
components/crm/CrmAiPanel.tsx           ← Panel visual del asistente IA con voz
app/api/chat/route.ts                   ← Chatbot público de la landing page
app/api/notifications/whatsapp/route.ts ← Envío WhatsApp via Twilio
```

### Componentes compartidos

```
components/crm/CrmShell.tsx             ← Layout del CRM (sidebar, header, IA button)
contexts/ThemeContext.tsx               ← Dark/Light mode global
contexts/LanguageContext.tsx            ← i18n ES/EN
```

---

## 3. Decisiones técnicas importantes (historial de sesiones)

### Auth — popup vs redirect
**Decisión:** `signInWithPopup` en desktop, `signInWithRedirect` como fallback en mobile/popup-bloqueado.  
**Por qué:** `signInWithRedirect` guarda el resultado en el dominio de Firebase, lo que genera un loop cross-origin en ciertos navegadores. El popup resuelve esto directamente.  
**Trade-off:** Los warnings COOP de Chrome son cosméticos e inevitables mientras Google mantenga `COOP: same-origin` en sus páginas de auth. No se puede poner `same-origin-allow-popups` global sin romper el popup. Se aplica solo a páginas de pagos donde no hay popup de Google.

### Stripe — Checkout Sessions (no Payment Links fijos)
**Decisión:** Crear una Checkout Session dinámica por ticket (con monto y metadata únicos).  
**Por qué:** Los Payment Links son estáticos. Las Sessions permiten registrar `ticketId`, `clientPhone`, `type` (anticipo/parcial/final) en metadata, y que el webhook actualice Firestore automáticamente.  
**Idempotencia:** Key = `checkout_{ticketId}_{type}_{hora_UTC}` — evita sesiones duplicadas por retry dentro de la misma hora.

### Inventario — Firestore Nativo (no Supabase/Algolia)
**Decisión:** Todo en Firestore (productos, proveedores, órdenes de compra, movimientos).  
**Por qué:** Zero fricción de integración, auth unificado, reglas existentes. Para ~500-2000 SKUs y tráfico de PyME, Firestore es suficiente. Algolia/Supabase sería over-engineering.

### OXXO como método de pago
**Decisión:** Habilitado con `expires_after_days: 3` en todas las Checkout Sessions.  
**Por qué:** El perfil de cliente (repartidores) tiene alta tasa de desbancarización. OXXO amplía conversiones.

### `adjustStock` — transacción atómica
**Decisión:** `lib/firestore/products.ts:adjustStock` usa `runTransaction` de Firestore.  
**Por qué:** Las actualizaciones de stock desde el webhook, tienda y CRM pueden ocurrir concurrentemente. Sin transacción, el stock puede quedar inconsistente.

---

## 4. Siguiente tarea exacta pendiente

### Tarea: Corregir seed-motocruz.ts y hacer el primer commit de inventario

**Problema:** `scripts/seed-motocruz.ts` importa `dotenv` que no está instalado:
```
scripts/seed-motocruz.ts(14,25): error TS2307: Cannot find module 'dotenv'
```

**Pasos exactos:**
```bash
# 1. Instalar dependencia
npm install dotenv --save-dev

# 2. Verificar que TypeScript compile sin errores
npx tsc --noEmit

# 3. Correr el seed contra Firestore live (necesita .env.local con vars Firebase Admin)
npm run seed:motocruz

# 4. Commitear los archivos sin rastrear
git add lib/firestore/store-orders.ts
git add public/images/Elevenlabs+whatsaap.png
git add PLATAFORMA_SPM.md
git add app/(crm)/crm/pagos/page.tsx
git add next.config.ts
git commit -m "feat: inventario marketplace fases 1-4 + fix módulo pagos COOP/React#130"
```

**Siguiente feature prioritaria después del commit:**
Implementar el módulo de **pedidos de tienda en CRM** (`/crm/pedidos`) — ver y gestionar los pedidos de la tienda online, con estados: pendiente-pago → pago-confirmado → preparando → enviado → entregado. El helper `lib/firestore/store-orders.ts` ya existe pero no hay UI en el CRM.

---

## 5. Variables de entorno

### Requeridas en `.env.local` y en Vercel → Settings → Environment Variables

```env
# ── Firebase (Client SDK) ────────────────────────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=       # RTDB para GPS tracking

# ── Firebase (Admin SDK — solo server-side) ──────────────────────────────────
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=                   # Service account
FIREBASE_PRIVATE_KEY=                    # Con saltos de línea escapados \n

# ── Stripe (Live) ────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=rk_live_...            # Restricted key — cuenta acct_1TN2KvFenduTmzTx
STRIPE_WEBHOOK_SECRET=whsec_...          # Webhook ID: we_1TTMZUFenduTmzTxvugWCQvN
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51TN2KvFenduTmzTx...
NEXT_PUBLIC_STRIPE_MAINTENANCE_LINK=https://buy.stripe.com/00w9ATegQ3x1h0U439cIE02

# ── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://spm-platform.vercel.app

# ── Twilio (WhatsApp + Voz) ──────────────────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=                     # Número Twilio para WhatsApp
TWILIO_WHATSAPP_NUMBER=                  # whatsapp:+1415...

# ── Mistral AI (CRM Assistant) ───────────────────────────────────────────────
MISTRAL_API_KEY=                         # Para app/api/crm/ai/route.ts

# ── Rate limiting ────────────────────────────────────────────────────────────
# No vars adicionales — usa memoria en proceso (no persiste entre serverless invocations)
```

### Pendiente de configurar en Vercel
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — ya está en `.env.local` pero confirmar que esté en Vercel

---

## 6. Errores conocidos y workarounds aplicados

### COOP warnings en consola de Chrome
**Error:** `Cross-Origin-Opener-Policy policy would block the window.closed call`  
**Causa:** Firebase `signInWithPopup` abre un popup de `accounts.google.com` (COOP: same-origin). El SDK de Firebase sondea `window.closed` en ese popup, y Chrome advierte por la incompatibilidad de políticas.  
**Workaround actual:** No se puede eliminar completamente. Se limita a las páginas de pagos con `same-origin-allow-popups` (aplicado esta sesión). En páginas de login queda el warning por diseño — es cosmético y no rompe el flujo.  
**Solución definitiva (si se quiere eliminar):** Usar `signInWithRedirect` en todos los entornos, eliminando el popup. Requiere cambiar `AuthContext.tsx:220`.

### React error #130 en módulo de pagos
**Error:** `Minified React error #130 — Element type is invalid: got undefined`  
**Causa:** `METHOD_ICONS[p.method]` devuelve `undefined` cuando Firestore contiene un pago con `method` con valor fuera de los 3 esperados (datos legacy o edge case).  
**Fix aplicado:** `METHOD_ICONS[p.method as PaymentMethod] ?? CreditCard` en `pagos/page.tsx:607`.

### TypeScript error en seed script
**Error:** `Cannot find module 'dotenv'` en `scripts/seed-motocruz.ts`  
**Causa:** `dotenv` no está en `devDependencies`.  
**Fix pendiente:** `npm install dotenv --save-dev`

### Stripe Webhook — no registra en modo test
**Contexto:** El webhook está configurado en modo **live** únicamente (`we_1TTMZUFenduTmzTxvugWCQvN`). Las Checkout Sessions de test no disparan eventos al webhook live.  
**Workaround:** Para testing usar `stripe listen --forward-to localhost:3000/api/payments/webhook` con el CLI de Stripe.

### `store-orders.ts` sin commitear
**Contexto:** `lib/firestore/store-orders.ts` existe en disco pero no está en git. El módulo de tienda (`/tienda`) funciona y crea pedidos en Firestore, pero si otro desarrollador clona el repo, faltará este helper.  
**Acción pendiente:** Incluir en el próximo commit.

### Stripe API version fija
**Contexto:** `lib/payments/stripe-client.ts` usa `apiVersion: "2026-03-25.dahlia"`. Si Stripe depreca esta versión, el SDK lanzará error.  
**Monitor:** Revisar https://stripe.com/docs/upgrades periodicamente.

---

## 7. Comandos útiles

```bash
# Desarrollo local
npm run dev

# TypeScript check
npm run typecheck

# Tests (Vitest)
npm test

# Seed catálogo MotoCruz a Firestore
npm run seed:motocruz

# Escuchar webhook Stripe en local
stripe listen --forward-to localhost:3000/api/payments/webhook

# Despliegue (automático via push a master)
git push origin master
```
