# Documentación Técnica — SanPedroMotoCare Platform

**Versión:** 1.3.0  
**Fecha:** 18 de abril de 2026  
**Producción:** https://spm-platform.vercel.app  
**Repositorio:** https://github.com/tofaiconsultingservices-cell/spm-platform

---

## 1. Visión general de la arquitectura

### Del caos a la plataforma unificada

Antes de esta plataforma, SPM operaba con tres sistemas desconectados:

```
ANTES                                  AHORA
─────────────────────────────────      ───────────────────────────────────────
sanpedromotocare.web.app               spm-platform.vercel.app/
 └─ PWA vanilla HTML5 (tracking)        ├── /              (landing)
                                        ├── /tracking      (tracking público)
spm-crm-three.vercel.app               ├── /cotizar       (cotizador)
 ├── /              (landing)           ├── /portal        (cliente autenticado)
 └── /dashboard     (CRM)              ├── /mecanico      (app de campo)
                                        └── /crm/*          (operadores/admin)
render.com (FastAPI / SPM-Voice)
 └── Integración telefónica            Firebase ←── fuente única de datos
```

### Principios de diseño

1. **Un solo dominio** — toda la audiencia entra por `spm-platform.vercel.app`
2. **Un solo repositorio** — monolito organizado con route groups de Next.js App Router
3. **Una sola fuente de verdad** — Firebase (Firestore + Realtime DB + Auth + FCM)
4. **Separación por audiencia** — route groups `(public)`, `(auth)`, `(portal)`, `(crm)`, `(field)`
5. **Sin secretos en código** — 100% variables de entorno encriptadas en Vercel

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| Framework | Next.js | 16.2.3 | App Router, SSR/SSG, API Routes |
| Lenguaje | TypeScript | 5.x | Tipos en toda la base de código |
| Estilos | Tailwind CSS | 4.x | CSS-first config con `@theme` |
| Animaciones | Framer Motion | 12.x | Transiciones y microinteracciones |
| Forms | React Hook Form | 7.x | Validación declarativa |
| Íconos | Lucide React | 1.x | Íconos consistentes |
| Charts | Recharts | 3.x | Analytics del CRM |
| Server state | TanStack Query | 5.x | Caché y sincronización de datos |
| Fechas | date-fns | 4.x | Formateo y cálculo de fechas |
| Auth | Firebase Authentication | 12.x | Google OAuth + email/password |
| Database | Firebase Firestore | 12.x | NoSQL — tickets, usuarios, mecánicos |
| Realtime | Firebase Realtime DB | 12.x | Posición GPS del mecánico en ruta |
| Push | Firebase Cloud Messaging | 12.x | Notificaciones push (web + móvil) |
| IA Chatbot | Google Gemini | gemini-2.0-flash-exp | Atención al cliente 24/7 |
| Pagos | Stripe | 22.x | Cobros en línea + webhooks |
| Voz | Twilio | 5.x | Call center automatizado |
| PWA | Web App Manifest + next-pwa | — | Instalable en móvil |
| Hosting | Vercel | — | Edge network, CI/CD automático |

---

## 3. Estructura del proyecto

```
spm-platform/
├── app/                              Next.js App Router
│   ├── (public)/                     Rutas públicas (sin auth requerida)
│   │   ├── page.tsx                  Landing page principal
│   │   ├── tracking/page.tsx         /tracking — rastreo por SPM-XXXX
│   │   ├── cotizar/page.tsx          /cotizar — formulario de cotización
│   │   ├── privacidad/page.tsx       /privacidad — aviso de privacidad
│   │   └── terminos/page.tsx         /terminos — términos y condiciones
│   │
│   ├── (auth)/
│   │   └── login/page.tsx            /login — Email + Google Sign-In
│   │
│   ├── (portal)/                     Auth: role viewer+
│   │   └── portal/
│   │       ├── page.tsx              /portal — resumen de servicios del cliente
│   │       ├── servicios/            /portal/servicios — historial
│   │       ├── pagar/                /portal/pagar — checkout con Stripe
│   │       ├── moto/                 /portal/moto — datos del vehículo
│   │       └── perfil/               /portal/perfil — perfil de usuario
│   │
│   ├── (field)/                      Auth: role mecanico
│   │   └── mecánico/                 App de campo para mecánicos
│   │
│   ├── (crm)/                        Auth: role operador+
│   │   └── crm/
│   │       ├── dashboard/            Métricas generales + mapa en tiempo real
│   │       ├── tickets/              Gestión completa de tickets
│   │       ├── clientes/             Base de datos de clientes
│   │       ├── mecanicos/            Gestión de mecánicos y disponibilidad
│   │       ├── facturas/             Facturación y pagos
│   │       ├── contact-center/       Cola de llamadas + historial Twilio
│   │       ├── pagos/                Cobros y pagos
│   │       ├── reportes/             Reportes y analytics
│   │       └── configuracion/        Configuración del sistema
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   └── session/route.ts      POST/DELETE — cookie HttpOnly __session
│   │   ├── chat/route.ts             POST — proxy Gemini chatbot
│   │   ├── quotes/route.ts           POST — crear lead + ticket SPM-XXXX
│   │   ├── tickets/route.ts          CRUD de tickets (autenticado)
│   │   ├── tracking/[ticketId]/      GET — estado público de un ticket
│   │   ├── notifications/            FCM push notifications
│   │   ├── payments/
│   │   │   ├── create-link/          POST — crear Stripe Payment Link
│   │   │   └── webhook/              POST — webhooks de Stripe (checkout.session.completed)
│   │   ├── og/                       GET — Open Graph image dinámica
│   │   └── voice/
│   │       ├── outbound/             POST — llamada saliente Twilio
│   │       ├── say/                  POST — TwiML respuesta de voz
│   │       └── status/               POST — webhook de estado de llamada
│   │
│   ├── layout.tsx                    Root layout + providers + anti-FOUC
│   ├── globals.css                   Design system (Tailwind v4 @theme)
│   ├── not-found.tsx                 Página 404 personalizada
│   └── firebase-messaging-sw.js     Service Worker para FCM
│
├── components/
│   ├── landing/
│   │   ├── Navbar.tsx                Navegación sticky — theme/lang toggles
│   │   ├── HeroSection.tsx           Video de fondo + estadísticas animadas
│   │   ├── ServicesSection.tsx       Grid de 8+ servicios con imágenes
│   │   ├── TrackingSection.tsx       Widget de rastreo inline
│   │   ├── QuoteSection.tsx          Formulario de cotización
│   │   ├── ContactSection.tsx        Canales de contacto + mapa
│   │   ├── Footer.tsx                Footer corporativo
│   │   └── PWAInstallBanner.tsx      Banner de instalación PWA
│   ├── chatbot/
│   │   └── ChatWidget.tsx            Widget flotante Gemini
│   ├── crm/                          Componentes del CRM
│   ├── portal/                       Componentes del portal de cliente
│   └── ui/                           Componentes genéricos reutilizables
│
├── contexts/
│   ├── AuthContext.tsx               Firebase Auth + RBAC completo
│   ├── ThemeContext.tsx              Dark/light mode (dark por defecto)
│   └── LanguageContext.tsx           i18n ES/EN (285+ strings)
│
├── lib/
│   ├── firebase.ts                   Client SDK singleton (inicialización lazy)
│   ├── firebase-admin.ts             Admin SDK lazy init — solo server-side
│   ├── rate-limit.ts                 Sliding window rate limiter en memoria
│   ├── firestore/
│   │   ├── tickets.ts                CRUD helpers — service_tickets
│   │   ├── clients.ts                CRUD helpers — clients
│   │   └── mechanics.ts              CRUD helpers — mechanics
│   ├── payments/
│   │   └── stripe-client.ts          Stripe SDK singleton (server-side)
│   └── notifications/
│       ├── push.ts                   FCM helper — envío de push notifications
│       ├── messages.ts               Plantillas de mensajes por evento
│       ├── voice.ts                  Twilio helper — llamadas salientes
│       └── whatsapp.ts               Helper WhatsApp Business (Twilio)
│
├── types/
│   └── index.ts                      Todos los tipos TypeScript del proyecto
│
├── public/
│   ├── images/                       Assets de marca
│   ├── videos/hero-bg-desktop.mp4    Video hero desktop (1280×720, landscape, ~35KB)
│   ├── videos/hero-bg-mobile.mp4     Video hero mobile (540×960, portrait, ~447KB)
│   ├── videos/hero-poster.jpg        Frame poster LCP (1280×720, ~5KB)
│   ├── icons/                        PWA icons (192x192, 512x512)
│   ├── favicon.png                   Logo SPM como favicon
│   └── manifest.json                 PWA Web App Manifest
│
├── tests/                            Suite de tests (Vitest)
│   ├── setup.ts                      Mocks globales (Firebase SDK)
│   ├── api/                          Tests de API Routes
│   ├── lib/                          Tests de lógica de negocio
│   └── types/                        Tests de constantes y tipos
│
├── .github/workflows/ci.yml          Pipeline CI (GitHub Actions)
├── vitest.config.ts                  Configuración de Vitest
├── proxy.ts                          Protección de rutas (Next.js 16)
├── next.config.ts                    Configuración + CSP headers de seguridad
├── .env.example                      Plantilla de variables de entorno
└── package.json
```

---

## 4. Sistema de autenticación y autorización

### Flujo completo

```
Usuario → /login
    │
    ├── Google OAuth (signInWithPopup)
    │       └── Firebase Auth crea/autentica usuario
    │
    └── Email + Password (signInWithEmailAndPassword)
            └── Firebase Auth autentica usuario
                    │
                    ▼
            AuthContext.fetchOrCreateUser(fbUser)
                    │
                    ├── Busca doc en Firestore: users/{uid}
                    │
                    ├── [Existe] → Actualiza lastLogin, devuelve SPMUser
                    │
                    └── [No existe] → Crea con role: "viewer", devuelve SPMUser
                                │
                                ▼
                        POST /api/auth/session
                        (Firebase Admin verifica idToken → HttpOnly cookie __session)
                                │
                                ▼
                        Redirect según rol:
                        - mecanico  → /mecánico
                        - viewer    → /portal
                        - operador+ → /crm/dashboard
```

### Jerarquía de roles

```typescript
const ROLE_WEIGHTS = {
  viewer:   1,   // Clientes — portal de seguimiento y pago
  mecanico: 2,   // Mecánicos — app de campo
  operador: 3,   // Agentes — CRM completo
  manager:  4,   // Supervisores — reportes y configuración
  admin:    5,   // Administradores — acceso total
}

// hasRole("operador") → true si el usuario es operador, manager o admin
function hasRole(minimum: UserRole): boolean {
  return ROLE_WEIGHTS[user.role] >= ROLE_WEIGHTS[minimum];
}
```

### Route protection

`proxy.ts` (Next.js 16 — equivalente al `middleware.ts` en versiones anteriores) lee la cookie `__session` y redirige:
- Rutas protegidas sin sesión → `/login?from=<ruta>`
- Usuarios autenticados en `/login` → `/portal`

La validación de rol completa ocurre en el cliente (`AuthContext`) y en los componentes de página.

---

## 5. Firebase — modelo de datos

### Colección `service_tickets`

```typescript
interface ServiceTicket {
  id: string                    // Firestore doc ID
  ticketId: string              // SPM-0001 (display ID, generado atómicamente)
  status: ServiceTicketStatus
  clientId?: string             // Ref a clients/
  clientName: string
  clientPhone: string
  clientEmail?: string
  mechanicId?: string           // Ref a mechanics/
  mechanicName?: string
  mechanicPhone?: string
  serviceType: ServiceType
  serviceDescription: string
  diagnosis?: string
  workDone?: string
  serviceAddress: Address
  estimatedCost?: number
  anticipo?: number
  finalCost?: number
  parts?: PartItem[]
  source: LeadSource            // "web" | "whatsapp" | "phone" | "crm"
  statusHistory: TicketEvent[]
  rating?: number               // 1-5, evaluación del cliente
  photosBefore?: string[]       // URLs Firebase Storage
  photosAfter?: string[]
  stripePaymentLinkId?: string  // Enlace de pago Stripe
  stripeSessionId?: string      // ID de sesión de pago completada
  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt?: Timestamp
}
```

### Flujo de estados del ticket

```
lead-recibido
    │
    ▼
diagnostico-pendiente
    │
    ▼
en-camino  ────────────────→  GPS activo en Realtime DB
    │                         Notificación push al cliente
    ▼
en-servicio ───────────────→  Mecánico en sitio
    │                         Teléfono del mecánico expuesto en API pública
    ▼
completado
    │
    ▼
pagado  ←────────────────────  webhook de Stripe (checkout.session.completed)

[cancelado]  puede ocurrir en cualquier estado previo a "completado"
```

### Colección `users`

```typescript
interface SPMUser {
  id: string          // = uid de Firebase Auth
  uid: string
  email: string
  displayName: string
  role: UserRole
  phone?: string
  photoURL?: string
  mechanicId?: string // Si role === "mecanico"
  fcmToken?: string   // Token FCM para push notifications
  isActive: boolean
  lastLogin: Timestamp
  createdAt: Timestamp
}
```

### Colección `mechanics`

```typescript
interface Mechanic {
  id: string
  mechanicId: string          // MEC-001
  name: string
  phone?: string
  status: "disponible" | "en-servicio" | "descanso" | "inactivo"
  zona: string[]              // ["San Pedro", "Valle Oriente"]
  skills: ServiceType[]
  location?: {
    lat: number
    lng: number
    updatedAt: Timestamp
  }
  totalServicesCompleted: number
  averageRating?: number
}
```

### Firebase Realtime Database — GPS tracking

```
mechanics/
  {mechanicId}/
    lat: number
    lng: number
    updatedAt: number    // Unix timestamp
    ticketId: string     // Ticket activo
```

### Colección `_counters`

```typescript
// doc: "service_tickets"
{ count: number }
// Incrementado atómicamente con Firestore Transaction
// Genera SPM-0001, SPM-0002, etc.
```

---

## 6. API Routes

### POST /api/auth/session

Recibe el `idToken` de Firebase del cliente, lo verifica con Firebase Admin SDK y crea la cookie HttpOnly `__session` (Secure, SameSite=Lax, 5 días).

**DELETE /api/auth/session** — Borra la cookie en sign-out.

---

### POST /api/quotes

Recibe datos del formulario de cotización. Crea un documento en `leads` y genera automáticamente un `service_ticket` con status `lead-recibido`.

**Autenticación:** Ninguna (pública).  
**Rate limit:** 5 requests/minuto por IP.  
**Validación:** Sanitización, truncado y whitelist explícita de campos (sin object spread del body).  
**ID de ticket:** Firestore Transaction atómica en `_counters` → `SPM-XXXX`.

---

### GET /api/tracking/[ticketId]

Consulta pública del estado de un ticket por su ID legible (ej: `SPM-0042`).

**Rate limit:** 30 requests/minuto por IP.  
**Campos expuestos públicamente:**
- `ticketId`, `status`, `clientName`, `serviceType`
- `serviceAddress` (calle, colonia y ciudad)
- `estimatedCost`, `mechanicName`
- `mechanicPhone` — **solo si status es `en-camino` o `en-servicio`**

---

### POST /api/chat

Proxy hacia Google Gemini con system prompt especializado en SPM.

**Rate limit:** 20 requests/minuto por IP.  
**Modelo:** `gemini-2.0-flash-exp`  
**Historial:** Se envían los últimos 10 mensajes de la conversación.

---

### POST /api/payments/create-link

Crea un Stripe Payment Link para un ticket existente. Requiere `ticketId` y monto. Guarda el `stripePaymentLinkId` en Firestore.

**Autenticación:** Requiere sesión activa (operador+).

---

### POST /api/payments/webhook

Recibe webhooks de Stripe firmados con `STRIPE_WEBHOOK_SECRET`. Al recibir `checkout.session.completed`, actualiza el ticket a status `pagado` y registra el `stripeSessionId`.

**Autenticación:** Verificación de firma Stripe (`stripe.webhooks.constructEvent`).

---

### POST /api/voice/outbound

Inicia una llamada saliente vía Twilio con el número configurado en `TWILIO_PHONE_NUMBER`. Recibe el número de destino y el mensaje a pronunciar.

**Autenticación:** Requiere sesión activa (operador+).

---

### POST /api/voice/say & POST /api/voice/status

Endpoints TwiML para el flujo de llamada y webhook de estado de Twilio.

---

### POST /api/notifications

Envía push notifications vía FCM a uno o varios tokens registrados. Usado internamente al cambiar el estado de un ticket.

---

## 7. Integraciones externas

### Stripe (pagos en línea)

- **SDK:** `stripe` v22.x (server-side únicamente)
- **Flujo:** Operador crea payment link → cliente paga → webhook actualiza ticket a `pagado`
- **Webhook:** Firmado con `STRIPE_WEBHOOK_SECRET` — validado con `stripe.webhooks.constructEvent`

### Twilio (voz y WhatsApp)

- **SDK:** `twilio` v5.x (server-side únicamente)
- **Llamadas:** Salientes para seguimiento y contact center
- **WhatsApp:** Helper disponible en `lib/notifications/whatsapp.ts` (en integración)

### Firebase Cloud Messaging (notificaciones push)

- **Service Worker:** `firebase-messaging-sw.js` registrado en el root del dominio
- **Token:** Guardado en `users/{uid}.fcmToken` al aceptar permisos
- **Eventos:** Cambios de estado del ticket (en-camino, completado, pagado)

### Google Gemini (IA)

- **SDK:** `@google/generative-ai` v0.24.1 (server-side únicamente)
- **Modelo:** `gemini-2.0-flash-exp`
- **Rol:** Atención al cliente 24/7 con conocimiento de servicios, zonas y precios SPM

---

## 8. Design System

### Tailwind CSS v4 — configuración en CSS

Tailwind v4 elimina `tailwind.config.ts`. La configuración vive en `globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-spm-red: #DC2626;
  --color-spm-orange: #F97316;
  --font-display: "Poppins", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
}
```

### Dark mode (predeterminado)

El tema oscuro es el **default absoluto** de la plataforma:

1. Sin preferencia guardada → **dark**
2. Usuario eligió `light` explícitamente → light
3. Script inline en `<head>` previene FOUC antes de que React hidrate

```javascript
// layout.tsx — anti-FOUC
var t = localStorage.getItem('spm-theme');
if (t !== 'light') document.documentElement.classList.add('dark');
```

### Variables CSS semánticas

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #0f172a;
  --border-color: #e2e8f0;
}

.dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --text-primary: #f1f5f9;
  --border-color: #334155;
}
```

---

## 9. Internacionalización (i18n)

Sistema manual sin dependencias externas:

- **Idiomas:** Español (es-MX) y English
- **Persistencia:** `localStorage.getItem("spm-lang")`
- **Implementación:** `LanguageContext` con objeto `translations` de 285+ strings
- **Toggle:** Botón en la navbar (ES ↔ EN)

```typescript
const { t, lang, toggleLang } = useLanguage();
<h1>{t("hero_title")}</h1>
```

---

## 10. PWA

### manifest.json

```json
{
  "name": "SanPedroMotoCare — Mecánico a Domicilio",
  "short_name": "SPM Mecánico",
  "display": "standalone",
  "theme_color": "#DC2626",
  "background_color": "#0f172a",
  "shortcuts": [
    { "name": "Rastrear", "url": "/tracking" },
    { "name": "Cotizar",  "url": "/cotizar" }
  ]
}
```

### Install Banner

`PWAInstallBanner.tsx` captura `beforeinstallprompt`, lo cancela y tras 3 segundos muestra el banner. La preferencia de "dismiss" se persiste en `localStorage`.

---

## 11. Chatbot Gemini

```
Cliente (ChatWidget.tsx)
    │
    ├── Historial en estado local (useState)
    │
    └── POST /api/chat  ← mensaje + últimos 10 del historial
                │
                └── Google Generative AI SDK
                        └── gemini-2.0-flash-exp + system prompt SPM
```

**System prompt cubre:**
- Servicios disponibles y precios aproximados
- Zonas de cobertura (San Pedro, MTY, Guadalupe, Apodaca, etc.)
- Horarios: Lun–Dom 7am–9pm, urgencias 24/7
- Tiempo de respuesta: ~45 minutos
- Formas de pago: efectivo, tarjeta, transferencia
- Responde en el idioma del usuario

---

## 12. Testing

### Stack de testing

| Herramienta | Versión | Propósito |
|-------------|---------|-----------|
| Vitest | 3.x | Test runner ESM-nativo |
| happy-dom | — | Entorno DOM ligero |
| @vitest/coverage-v8 | — | Coverage con V8 |

### Ejecución

```bash
npm test              # 110 tests (~5 segundos)
npm run test:watch    # Watch mode para desarrollo
npm run test:coverage # Coverage completo con thresholds
```

### Coverage (abril 2026)

| Métrica | Cobertura | Threshold |
|---------|-----------|-----------|
| Statements | 87.85% | 70% |
| Branches | 73.09% | 70% |
| Functions | 74.50% | 70% |
| Lines | 89.86% | 70% |

### Archivos de test

```
tests/
├── setup.ts                          Mocks globales (Firebase Client + Admin SDK)
├── api/
│   ├── auth-session.test.ts          Session cookie CRUD
│   ├── quotes.test.ts               Cotizaciones + validación + rate limit
│   ├── tracking.test.ts             Tracking público + campos ocultos
│   ├── voice-say.test.ts            TwiML XML + XSS escaping
│   ├── voice-status.test.ts         Callback Twilio
│   └── webhook.test.ts              Webhooks Stripe + firma
├── lib/
│   ├── firestore-tickets.test.ts    CRUD tickets + pipeline + pagos (17 tests)
│   ├── firestore-clients.test.ts    CRUD clientes + campos moto
│   ├── firestore-mechanics.test.ts  CRUD mecánicos
│   ├── firestore-invoices.test.ts   Listener facturas
│   ├── notifications-messages.test.ts  Mensajes por status (16 tests)
│   ├── rate-limit.test.ts           Sliding window + IP isolation (10 tests)
│   └── stripe-client.test.ts        Checkout + firma + MXN→centavos
└── types/
    └── index.test.ts                Constantes del sistema
```

---

## 13. Deploy y CI/CD

### GitHub Actions (`.github/workflows/ci.yml`)

```
Push to master / Pull Request
         │
         ▼
  ┌──────────────────┐
  │ Lint & TypeCheck  │  tsc --noEmit + ESLint
  └──────────────────┘
         │
         ▼
  ┌──────────────────┐
  │ Tests & Coverage  │  vitest run --coverage
  └──────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Coverage   Upload        En PRs: comentario
 gates      artifacts     automático con tabla
 (70% min)  (14 días)     de métricas
```

### Deploy a producción

```
Desarrollador
    │
    └── git push origin master
            │
            ├── GitHub Actions (lint + tests + coverage)
            │
            └── Vercel (build automático)
                    │
                    ├── Build: next build (Turbopack)
                    ├── Región: Washington D.C. (iad1)
                    └── Deploy a producción en ~45 segundos
```

### Variables de entorno en Vercel

Todas las variables están configuradas como `Encrypted` en scope `Production`. Ver `.env.example` para la lista completa.

```bash
vercel env add NUEVA_VARIABLE production
vercel env ls production
vercel --prod
```

### Rollback

```bash
vercel rollback   # Vuelve al deploy anterior
vercel ls         # Lista todos los deploys con su URL
```

---

## 14. Seguridad

### Implementado y activo

| Recurso | Protección |
|---------|-----------|
| Variables de entorno | Encriptadas en Vercel, nunca en código fuente |
| Firebase Admin SDK | Server-side exclusivamente (API Routes) |
| Rutas CRM | `proxy.ts` + validación de rol en AuthContext |
| Session cookie | HttpOnly, Secure, SameSite=Lax, 5 días |
| API `/api/quotes` | Rate limit 5 req/min por IP + sanitización |
| API `/api/chat` | Rate limit 20 req/min por IP |
| API `/api/tracking` | Rate limit 30 req/min por IP |
| Tracking API | Teléfono del mecánico solo en estado `en-camino`/`en-servicio` |
| Pagos Stripe | Webhook verificado con firma `STRIPE_WEBHOOK_SECRET` |
| Firestore | Security Rules activas |
| CSP | Headers completos: script-src, style-src, img-src, connect-src, frame-src |
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | camera=(), microphone=(), geolocation=(), payment=() |
| HSTS | max-age=63072000; includeSubDomains; preload (solo producción) |
| Inputs | Truncado + whitelist de campos (sin object spread del body) |

### Pendientes (próximas versiones)

- [ ] CAPTCHA en formulario de cotización (hCaptcha o Cloudflare Turnstile)
- [ ] Firebase App Check
- [ ] Rate limiting distribuido con Redis/Upstash (multi-instancia)
- [ ] Validación de webhook con `WEBHOOK_SECRET` en integraciones externas

---

## 15. Guía de contribución

### Agregar una nueva ruta al CRM

1. Crear el directorio: `app/(crm)/crm/nueva-seccion/`
2. Crear `page.tsx` con el componente de página
3. Agregar el link en la navegación del CRM
4. Si requiere permisos especiales, agregar validación con `hasRole()`

### Agregar una nueva colección a Firestore

1. Definir el tipo en `types/index.ts`
2. Crear el helper en `lib/firestore/nueva-coleccion.ts`
3. Agregar las reglas de seguridad en Firebase Console (Firestore Rules)

### Agregar un nuevo idioma

1. Agregar el código al tipo `Lang` en `LanguageContext.tsx`
2. Crear el objeto de traducciones con todas las keys del idioma `es`
3. Actualizar el toggle en la navbar para ciclar entre más de 2 opciones

---

## 16. Dependencias principales

```json
{
  "next": "16.2.3",
  "react": "19.2.4",
  "firebase": "12.12.0",
  "firebase-admin": "13.8.0",
  "@google/generative-ai": "0.24.1",
  "stripe": "22.0.1",
  "twilio": "5.13.1",
  "framer-motion": "12.38.0",
  "lucide-react": "1.8.0",
  "react-hook-form": "7.72.1",
  "react-hot-toast": "2.6.0",
  "recharts": "3.8.1",
  "@tanstack/react-query": "5.99.0",
  "date-fns": "4.1.0",
  "next-pwa": "5.6.0"
}
```

---

*Documentación actualizada el 18 de abril de 2026. Versión 1.3.0*
