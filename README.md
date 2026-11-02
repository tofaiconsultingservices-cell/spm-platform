# SanPedroMotoCare — Plataforma Unificada

> Mecánicos certificados a domicilio en San Pedro Garza García y área metropolitana de Monterrey.

**Producción:** https://spm-platform.vercel.app  
**Repositorio:** https://github.com/tofaiconsultingservices-cell/spm-platform<br>
**Stack:** Next.js 16 · TypeScript · Tailwind CSS v4 · Firebase · Gemini AI · Stripe · Twilio · Vercel  
**Versión:** 1.3.0  
**CI:** ![CI](https://github.com/tofaiconsultingservices-cell/spm-platform/actions/workflows/ci.yml/badge.svg)

---

## Arquitectura

Plataforma monolítica organizada con Next.js App Router route groups, Firebase como fuente única de datos, y 11 API Routes server-side.

```
spm-platform.vercel.app
├── /              Landing page pública
├── /cotizar       Cotizador → genera ticket SPM-XXXX
├── /tracking      Rastreo público por ID
├── /portal/*      Portal autenticado del cliente
├── /mecanico      App de campo (GPS, fotos, status)
└── /crm/*         CRM completo (operadores/admin)
```

---

## Módulos

| URL | Módulo | Audiencia |
|-----|--------|-----------|
| `/` | Landing Page | Público |
| `/cotizar` | Cotizador en línea | Público |
| `/tracking` | Rastreo SPM-XXXX | Público |
| `/portal` | Portal de Cliente | Clientes (auth) |
| `/portal/servicios` | Historial de servicios | Clientes (auth) |
| `/portal/pagar` | Pagos con Stripe | Clientes (auth) |
| `/portal/moto` | Datos del vehículo | Clientes (auth) |
| `/portal/perfil` | Perfil de usuario | Clientes (auth) |
| `/mecanico` | App de campo | Mecánicos (auth) |
| `/crm/dashboard` | Dashboard con métricas | Operadores+ |
| `/crm/tickets` | Gestión de tickets | Operadores+ |
| `/crm/clientes` | Base de clientes | Operadores+ |
| `/crm/mecanicos` | Gestión de mecánicos | Operadores+ |
| `/crm/pagos` | Pagos y cobros | Operadores+ |
| `/crm/facturas` | Facturación + PDF | Operadores+ |
| `/crm/reportes` | Analytics y reportes | Managers+ |
| `/crm/contact-center` | Call center Twilio | Operadores+ |
| `/crm/configuracion` | Configuración | Admin |
| `/login` | Autenticación (Email + Google) | Todos |
| `/privacidad` | Aviso de privacidad | Público |
| `/terminos` | Términos y condiciones | Público |

---

## Capacidades principales

- **Cotización en línea** — formulario público que genera ticket `SPM-XXXX` automáticamente
- **Rastreo en tiempo real** — GPS del mecánico vía Firebase Realtime Database
- **Pipeline de tickets** — 7 estados con historial, notas y timestamps por transición
- **Pagos flexibles** — Stripe (tarjeta), efectivo, anticipos, pagos parciales y finales
- **Recibos PDF** — generación con branding SPM desde facturas y tickets
- **Chatbot IA** — atención al cliente 24/7 con Google Gemini
- **Notificaciones push** — FCM para cambios de estado del ticket
- **Call center** — llamadas salientes con Twilio (voz + WhatsApp)
- **CRM completo** — tickets, clientes, mecánicos, pagos, facturas, reportes
- **PWA** — instalable en móvil con shortcuts nativos
- **Bilingue** — Espanol / English (285+ strings traducidos)
- **Dark mode** — predeterminado, con toggle usuario
- **Poliza de mantenimiento** — suscripcion mensual $99/mes para repartidores (Stripe)

---

## API Routes

| Endpoint | Metodo | Autenticacion | Descripcion |
|----------|--------|---------------|-------------|
| `/api/auth/session` | POST/DELETE | Publica | Crear/eliminar session cookie |
| `/api/quotes` | POST | Publica (rate limit 5/min) | Crear cotizacion → ticket |
| `/api/tracking/[ticketId]` | GET | Publica (rate limit 30/min) | Estado publico de ticket |
| `/api/chat` | POST | Publica (rate limit 20/min) | Proxy Gemini chatbot |
| `/api/payments/create-link` | POST | Operador+ | Crear Stripe Payment Link |
| `/api/payments/webhook` | POST | Firma Stripe | Webhook pagos completados |
| `/api/notifications/push` | POST | Interna | Push notifications FCM |
| `/api/notifications/whatsapp` | POST | Interna | Mensajes WhatsApp |
| `/api/voice/outbound` | POST | Operador+ | Llamada saliente Twilio |
| `/api/voice/say` | POST | Twilio | TwiML respuesta de voz |
| `/api/voice/status` | POST | Twilio | Webhook estado de llamada |

---

## Testing

La plataforma cuenta con infraestructura de testing profesional:

```bash
npm test              # Ejecutar 110 tests
npm run test:watch    # Watch mode para desarrollo
npm run test:coverage # Coverage completo con thresholds
```

**Stack de testing:** Vitest + happy-dom + @vitest/coverage-v8

**Coverage actual (abril 2026):**

| Metrica | Cobertura | Threshold |
|---------|-----------|-----------|
| Statements | 87.85% | 70% |
| Branches | 73.09% | 70% |
| Functions | 74.50% | 70% |
| Lines | 89.86% | 70% |

**14 archivos de test** cubriendo:
- Firestore CRUD (tickets, clientes, mecanicos, facturas)
- API endpoints (auth, quotes, tracking, webhooks, voice)
- Rate limiter (sliding window, aislamiento por IP)
- Stripe (checkout sessions, webhooks, verificacion de firma)
- Notificaciones (mensajes por status, push copy, voice scripts)
- Tipos y constantes del sistema

---

## CI/CD

### GitHub Actions

El pipeline CI se ejecuta en cada push a `master` y en cada pull request:

1. **Lint & TypeCheck** — `tsc --noEmit` + ESLint
2. **Tests & Coverage** — `vitest run --coverage` con gates de 70% minimo
3. **Coverage en PRs** — comentario automatico con tabla de metricas
4. **Artifacts** — reporte de coverage almacenado 14 dias

### Deploy

```
git push origin master → GitHub Actions CI → Vercel (deploy automatico)
```

Deploy a produccion en ~45 segundos via integracion Vercel.

---

## Setup local

```bash
git clone https://github.com/tofaiconsultingservices-cell/spm-platform.git
cd spm-platform
npm install
cp .env.example .env.local   # completar credenciales
npm run dev
```

Requiere Node.js 20+.

---

## Variables de entorno requeridas

```
# Firebase (cliente)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_DATABASE_URL
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY

# Firebase Admin (server-side)
FIREBASE_SERVICE_ACCOUNT_KEY   # JSON completo de la service account

# Google Gemini (server-side)
GEMINI_API_KEY

# Stripe (server-side)
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# Twilio (server-side)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER

# App
NEXT_PUBLIC_APP_URL
```

---

## Seguridad

- CSP headers completos (script, style, img, connect, frame)
- Rate limiting en todas las API Routes publicas
- HttpOnly session cookie via Firebase Admin SDK
- Validacion y sanitizacion de inputs en server-side
- Webhooks de Stripe verificados con firma HMAC
- Firebase Admin SDK exclusivamente en API Routes
- Firestore Security Rules activas
- HSTS en produccion
- X-Frame-Options DENY, X-Content-Type-Options nosniff

---

## Documentacion

- [TECHNICAL.md](./TECHNICAL.md) — Arquitectura, modelo de datos, APIs, integraciones
- [RELEASE.md](./RELEASE.md) — Documento tecnico de lanzamiento v1.3.0

---

2026 SanPedroMotoCare. Todos los derechos reservados.
